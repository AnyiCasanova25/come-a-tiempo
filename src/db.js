import Dexie from 'dexie'
import { hoyISO, sumarDias, diasEntre } from './fechas'
import { estimarVidaUtil } from './categorias'

// Base local (IndexedDB) del celular. Los ids son UUID y cada fila lleva
// `actualizado` para poder sincronizar después con la familia (Supabase).
export const db = new Dexie('despensa')

db.version(1).stores({
  // codigo = código de barras (puede faltar en productos a granel)
  productos: 'id, codigo, nombre, categoria, actualizado',
  // estado: activo | agotado | botado | eliminado
  lotes: 'id, productoId, estado, vence, actualizado',
  // tipo: compra | consumo | botado  (base para el consumo mes a mes)
  movimientos: 'id, productoId, loteId, tipo, fecha',
  lista: 'id, productoId, hecho, borrado, actualizado',
  // preferencias del celular; también las lee el service worker de las alertas
  ajustes: 'clave',
})

export async function leerAjuste(clave, defecto) {
  const fila = await db.ajustes.get(clave)
  return fila ? fila.valor : defecto
}

export const guardarAjuste = (clave, valor) => db.ajustes.put({ clave, valor })

export function nuevoId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  // Respaldo para contextos no seguros (http en la red local)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const ahora = () => new Date().toISOString()

// ---------- Productos ----------

export async function buscarPorCodigo(codigo) {
  if (!codigo) return null
  return db.productos.where('codigo').equals(codigo).first()
}

// Crea o actualiza el producto (por id, o por código de barras si ya existe)
export async function guardarProducto(datos) {
  const existente = datos.id
    ? await db.productos.get(datos.id)
    : await buscarPorCodigo(datos.codigo)
  const producto = {
    ...existente,
    ...datos,
    id: existente?.id ?? nuevoId(),
    nombre: datos.nombre.trim(),
    actualizado: ahora(),
  }
  await db.productos.put(producto)
  return producto
}

// ---------- Lotes (cada compra de un producto con su fecha de vencimiento) ----------

export async function agregarLote({ producto, cantidad, vence, venceEstimada, precio, ubicacion }) {
  const compradoEl = hoyISO()
  const lote = {
    id: nuevoId(),
    productoId: producto.id,
    cantidad: Number(cantidad),
    cantidadInicial: Number(cantidad),
    vence,
    venceEstimada: !!venceEstimada,
    precio: precio ? Number(precio) : null,
    ubicacion,
    compradoEl,
    estado: 'activo',
    actualizado: ahora(),
  }
  await db.transaction('rw', db.lotes, db.movimientos, db.productos, db.lista, async () => {
    await db.lotes.add(lote)
    await registrarMovimiento(lote, 'compra', lote.cantidad)
    // Si la fecha es real, el producto "aprende" cuánto le dura (para estimar la próxima vez)
    if (!venceEstimada) {
      const dias = diasEntre(compradoEl, vence)
      if (dias > 0) await db.productos.update(producto.id, { vidaUtilDias: dias, actualizado: ahora() })
    }
    // Lo que estaba en la lista de compras para este producto queda comprado
    await db.lista
      .where('productoId').equals(producto.id)
      .filter((i) => !i.hecho && !i.borrado)
      .modify({ hecho: 1, actualizado: ahora() })
  })
  return lote
}

function registrarMovimiento(lote, tipo, cantidad) {
  return db.movimientos.add({
    id: nuevoId(),
    productoId: lote.productoId,
    loteId: lote.id,
    tipo,
    cantidad,
    // valor proporcional del lote, para medir la plata perdida en vencidos
    valor: lote.precio ? (lote.precio * cantidad) / lote.cantidadInicial : null,
    fecha: ahora(),
  })
}

// "Usé N": descuenta del lote; si llega a 0 queda agotado
export async function consumir(loteId, cantidad = 1) {
  await db.transaction('rw', db.lotes, db.movimientos, async () => {
    const lote = await db.lotes.get(loteId)
    if (!lote || lote.estado !== 'activo') return
    const usado = Math.min(cantidad, lote.cantidad)
    const restante = +(lote.cantidad - usado).toFixed(2)
    await db.lotes.update(loteId, {
      cantidad: restante,
      estado: restante <= 0 ? 'agotado' : 'activo',
      actualizado: ahora(),
    })
    await registrarMovimiento(lote, 'consumo', usado)
  })
}

// "Se acabó": consume todo lo que quedaba
export async function seAcabo(loteId) {
  const lote = await db.lotes.get(loteId)
  if (lote) await consumir(loteId, lote.cantidad)
}

// "Lo boté": lo que quedaba se cuenta como pérdida
export async function botar(loteId) {
  await db.transaction('rw', db.lotes, db.movimientos, async () => {
    const lote = await db.lotes.get(loteId)
    if (!lote || lote.estado !== 'activo') return
    await db.lotes.update(loteId, { cantidad: 0, estado: 'botado', actualizado: ahora() })
    await registrarMovimiento(lote, 'botado', lote.cantidad)
  })
}

// Corregir un error de digitación: no cuenta como consumo ni como pérdida
export async function eliminarLote(loteId) {
  await db.lotes.update(loteId, { estado: 'eliminado', actualizado: ahora() })
  await db.movimientos.where('loteId').equals(loteId).delete()
}

export async function cambiarVence(loteId, vence) {
  await db.lotes.update(loteId, { vence, venceEstimada: false, actualizado: ahora() })
}

// Fecha sugerida cuando no se sabe la real
export function estimarVence(producto, categoria) {
  const dias = producto?.vidaUtilDias ?? estimarVidaUtil(categoria)
  return sumarDias(hoyISO(), dias)
}

// ---------- Lista de compras ----------

export async function agregarALista({ nombre, productoId = null, cantidad = 1 }) {
  // No duplicar un producto que ya está pendiente
  if (productoId) {
    const ya = await db.lista
      .where('productoId').equals(productoId)
      .filter((i) => !i.hecho && !i.borrado)
      .first()
    if (ya) return ya
  }
  const item = {
    id: nuevoId(),
    productoId,
    nombre: nombre.trim(),
    cantidad,
    hecho: 0,
    borrado: 0,
    actualizado: ahora(),
  }
  await db.lista.add(item)
  return item
}

export function marcarItem(id, hecho) {
  return db.lista.update(id, { hecho: hecho ? 1 : 0, actualizado: ahora() })
}

export function borrarItem(id) {
  return db.lista.update(id, { borrado: 1, actualizado: ahora() })
}

export async function limpiarComprados() {
  await db.lista
    .filter((i) => i.hecho && !i.borrado)
    .modify({ borrado: 1, actualizado: ahora() })
}

// ---------- Respaldo ----------

export async function exportarTodo() {
  return {
    app: 'despensa',
    version: 1,
    exportado: ahora(),
    productos: await db.productos.toArray(),
    lotes: await db.lotes.toArray(),
    movimientos: await db.movimientos.toArray(),
    lista: await db.lista.toArray(),
  }
}

export async function importarTodo(datos) {
  if (datos?.app !== 'despensa') throw new Error('El archivo no es un respaldo de Come a tiempo')
  await db.transaction('rw', db.productos, db.lotes, db.movimientos, db.lista, async () => {
    await db.productos.bulkPut(datos.productos ?? [])
    await db.lotes.bulkPut(datos.lotes ?? [])
    await db.movimientos.bulkPut(datos.movimientos ?? [])
    await db.lista.bulkPut(datos.lista ?? [])
  })
}

export { hoyISO }
