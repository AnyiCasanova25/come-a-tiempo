import { useLiveQuery } from 'dexie-react-hooks'
import { db, leerAjuste } from './db'
import { diasParaVencer, hoyISO } from './fechas'

export const DIAS_AVISO_DEFECTO = 3

async function conProducto(lotes) {
  const ids = [...new Set(lotes.map((l) => l.productoId))]
  const productos = await db.productos.bulkGet(ids)
  const mapa = Object.fromEntries(productos.filter(Boolean).map((p) => [p.id, p]))
  return lotes.map((l) => ({ ...l, producto: mapa[l.productoId] }))
}

// Todo lo que hay en la casa, de lo que vence primero a lo que vence último
export function useLotesActivos() {
  return useLiveQuery(async () => {
    const lotes = await db.lotes.where('estado').equals('activo').toArray()
    const res = await conProducto(lotes)
    return res.sort((a, b) => a.vence.localeCompare(b.vence))
  }, [])
}

export function useAjuste(clave, defecto) {
  return useLiveQuery(() => leerAjuste(clave, defecto), [clave], defecto)
}

export function useProductos() {
  return useLiveQuery(() => db.productos.orderBy('nombre').toArray(), [], [])
}

// Plata y unidades botadas por vencimiento en el mes actual
export function usePerdidasMes() {
  return useLiveQuery(async () => {
    const inicioMes = hoyISO().slice(0, 8) + '01'
    const botados = await db.movimientos
      .where('tipo').equals('botado')
      .filter((m) => m.fecha.slice(0, 10) >= inicioMes)
      .toArray()
    return {
      productos: botados.length,
      valor: botados.reduce((s, m) => s + (m.valor || 0), 0),
    }
  }, [])
}

export function useLista() {
  return useLiveQuery(
    () => db.lista.filter((i) => !i.borrado).toArray()
      .then((items) => items.sort((a, b) => a.hecho - b.hecho || a.nombre.localeCompare(b.nombre))),
    [],
  )
}

// Sugerencias para la próxima lista de compras:
// - lo que se acabó (o se botó) en los últimos 90 días y no se ha vuelto a comprar
// - lo que queda poco (menos de la cuarta parte de lo que se compró)
// (En la fase 3 esto se calcula con el ritmo de consumo de cada producto)
export function useSugerencias() {
  return useLiveQuery(async () => {
    const hace90 = new Date(Date.now() - 90 * 86400000).toISOString()
    const [productos, lotes, pendientes] = await Promise.all([
      db.productos.toArray(),
      db.lotes.where('estado').anyOf('activo', 'agotado', 'botado').toArray(),
      db.lista.filter((i) => !i.hecho && !i.borrado).toArray(),
    ])
    const enLista = new Set(pendientes.map((i) => i.productoId))
    const sugerencias = []
    for (const p of productos) {
      if (enLista.has(p.id)) continue
      const suyos = lotes.filter((l) => l.productoId === p.id)
      if (!suyos.length) continue
      const activos = suyos.filter((l) => l.estado === 'activo')
      if (!activos.length) {
        const ultimo = suyos.sort((a, b) => b.actualizado.localeCompare(a.actualizado))[0]
        if (ultimo.actualizado < hace90) continue
        sugerencias.push({
          producto: p,
          motivo: ultimo.estado === 'botado' ? 'Se venció: quizá compra menos' : 'Se acabó',
          tipo: ultimo.estado === 'botado' ? 'botado' : 'agotado',
        })
        continue
      }
      const queda = activos.reduce((s, l) => s + l.cantidad, 0)
      const compra = Math.max(...activos.map((l) => l.cantidadInicial))
      if (compra > 1 && queda <= compra / 4) {
        sugerencias.push({ producto: p, motivo: `Queda poco (${queda} de ${compra})`, tipo: 'poco' })
      }
    }
    return sugerencias.sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre))
  }, [])
}

// Resumen para las alertas: lo vencido y lo que vence dentro de los días de aviso
export function resumenAlertas(lotes, diasAviso) {
  const vencidos = lotes.filter((l) => diasParaVencer(l.vence) < 0)
  const pronto = lotes.filter((l) => {
    const d = diasParaVencer(l.vence)
    return d >= 0 && d <= diasAviso
  })
  return { vencidos, pronto }
}
