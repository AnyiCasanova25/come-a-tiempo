import { db, leerAjuste, guardarAjuste } from './db'
import { hoyISO } from './fechas'
import { DIAS_AVISO_DEFECTO, resumenAlertas } from './consultas'

// Fase 1 (sin servidor, gratis):
//  - al abrir la app se revisan los vencimientos y, una vez al día, sale la notificación
//  - en Android con la app instalada, Chrome además revisa en segundo plano
//    (Periodic Background Sync, ver public/sw-alertas.js) aunque no se abra la app
// Las notificaciones push "de servidor" a toda la familia llegan con Supabase.

export const soportaNotificaciones = () => 'Notification' in window && 'serviceWorker' in navigator

export async function pedirPermiso() {
  if (!soportaNotificaciones()) return 'no-soportado'
  const permiso = await Notification.requestPermission()
  if (permiso === 'granted') await registrarRevisionPeriodica()
  return permiso
}

export async function registrarRevisionPeriodica() {
  try {
    const reg = await navigator.serviceWorker.ready
    if (!('periodicSync' in reg)) return false
    const estado = await navigator.permissions.query({ name: 'periodic-background-sync' })
    if (estado.state !== 'granted') return false
    await reg.periodicSync.register('revisar-vencimientos', { minInterval: 12 * 60 * 60 * 1000 })
    return true
  } catch {
    return false
  }
}

function armarMensaje({ vencidos, pronto }) {
  const nombres = (ls) => ls.slice(0, 3).map((l) => l.producto?.nombre ?? 'Producto').join(', ')
  const partes = []
  if (pronto.length) partes.push(`Por vencer: ${nombres(pronto)}${pronto.length > 3 ? ` y ${pronto.length - 3} más` : ''}`)
  if (vencidos.length) partes.push(`Vencidos: ${vencidos.length}`)
  return partes.join(' · ')
}

// Revisa y notifica como máximo una vez al día (o siempre con forzar=true)
export async function revisarYAvisar({ forzar = false } = {}) {
  if (!soportaNotificaciones() || Notification.permission !== 'granted') return false
  const hoy = hoyISO()
  if (!forzar && (await leerAjuste('ultimoAviso', null)) === hoy) return false

  const diasAviso = await leerAjuste('diasAviso', DIAS_AVISO_DEFECTO)
  const lotes = await db.lotes.where('estado').equals('activo').toArray()
  const productos = await db.productos.bulkGet(lotes.map((l) => l.productoId))
  const conNombre = lotes.map((l, i) => ({ ...l, producto: productos[i] }))
  const resumen = resumenAlertas(conNombre, diasAviso)

  const reg = await navigator.serviceWorker.ready
  if (!resumen.vencidos.length && !resumen.pronto.length) {
    if (forzar) await reg.showNotification('Come a tiempo', { body: 'Todo al día: nada por vencer 🎉', icon: 'icono-192.png', tag: 'vencimientos' })
    return false
  }
  await reg.showNotification('🥛 Úsalo pronto', {
    body: armarMensaje(resumen),
    icon: 'icono-192.png',
    badge: 'icono-192.png',
    tag: 'vencimientos',
  })
  await guardarAjuste('ultimoAviso', hoy)
  return true
}
