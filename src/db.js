import Dexie from 'dexie'
import { hoyISO, sumarDias, diasEntre } from './fechas'
import { estimarVidaUtil, vidaEnCongelador } from './categorias'

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

// cantidad = paquetes comprados; porPaquete = unidades que trae cada uno.
// El lote guarda UNIDADES: 1 paquete de 25 lonchas → 25, y de ahí se van descontando.
// compradoEl: cuándo se compró (por defecto hoy; una lista se puede registrar días después)
export async function agregarLote({ producto, cantidad, porPaquete = 1, vence, venceEstimada, precio, ubicacion, compradoEl = hoyISO() }) {
  const por = Math.max(1, Math.round(Number(porPaquete) || 1))
  const unidades = Number(cantidad) * por
  const lote = {
    id: nuevoId(),
    productoId: producto.id,
    cantidad: unidades,
    cantidadInicial: unidades,
    porPaquete: por,
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
    // El producto recuerda cuántas unidades trae su paquete, para la próxima compra
    if (por > 1 && producto.porPaquete !== por) {
      await db.productos.update(producto.id, { porPaquete: por, actualizado: ahora() })
    }
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

// fecha: 'AAAA-MM-DD' si el gasto fue otro día (p. ej. al pasar una lista de WhatsApp)
function registrarMovimiento(lote, tipo, cantidad, fecha = null) {
  return db.movimientos.add({
    id: nuevoId(),
    productoId: lote.productoId,
    loteId: lote.id,
    tipo,
    cantidad,
    // valor proporcional del lote, para medir la plata perdida en vencidos
    valor: lote.precio ? (lote.precio * cantidad) / lote.cantidadInicial : null,
    fecha: fecha && fecha !== hoyISO() ? `${fecha}T12:00:00.000Z` : ahora(),
  })
}

// Descuenta unidades de un lote (gasto o pérdida); si llega a 0 queda agotado/botado
async function descontarLote(lote, cantidad, tipo, fecha) {
  const usado = Math.min(cantidad, lote.cantidad)
  const restante = +(lote.cantidad - usado).toFixed(2)
  await db.lotes.update(lote.id, {
    cantidad: restante,
    estado: restante > 0 ? 'activo' : tipo === 'botado' ? 'botado' : 'agotado',
    actualizado: ahora(),
  })
  await registrarMovimiento(lote, tipo, usado, fecha)
  return usado
}

// "Usé N": descuenta del lote; si llega a 0 queda agotado
export async function consumir(loteId, cantidad = 1) {
  await db.transaction('rw', db.lotes, db.movimientos, async () => {
    const lote = await db.lotes.get(loteId)
    if (!lote || lote.estado !== 'activo') return
    await descontarLote(lote, cantidad, 'consumo')
  })
}

/**
 * Descuenta N unidades de un producto, empezando por el lote que vence primero
 * (lo primero que se debe gastar). tipo: 'consumo' o 'botado'.
 * @returns {Promise<{ descontado: number, faltaron: number }>}
 */
export async function descontarProducto(productoId, cantidad, { tipo = 'consumo', fecha = null } = {}) {
  let falta = cantidad
  await db.transaction('rw', db.lotes, db.movimientos, async () => {
    const lotes = await db.lotes
      .where('productoId').equals(productoId)
      .filter((l) => l.estado === 'activo')
      .toArray()
    lotes.sort((a, b) => a.vence.localeCompare(b.vence))
    for (const lote of lotes) {
      if (falta <= 0) break
      falta -= await descontarLote(lote, falta, tipo, fecha)
    }
  })
  return { descontado: cantidad - Math.max(0, falta), faltaron: Math.max(0, +falta.toFixed(2)) }
}

/**
 * Ajuste de algo que ya está en la casa (desde una lista pegada):
 *   porPaquete: todos sus lotes pasan a paquetes de N unidades
 *   gastados:   lo gastado DESDE LA COMPRA ("ya gastamos 5" de 25 → deben quedar 20).
 *               Si ya quedan 20 o menos, no se descuenta nada: pegar la misma lista
 *               dos veces no descuenta dos veces.
 *   vence:      fecha real que traía el renglón
 */
export async function ajustarProducto(productoId, { porPaquete = null, gastados = 0, vence = null, congelar: alCongelador = false } = {}) {
  const activos = () => db.lotes.where('productoId').equals(productoId).filter((l) => l.estado === 'activo').toArray()
  if (alCongelador) {
    for (const lote of await activos()) if (lote.ubicacion !== 'congelador') await congelar(lote.id)
  }
  if (porPaquete) {
    for (const lote of await activos()) {
      if ((lote.porPaquete ?? 1) !== Number(porPaquete)) await cambiarPorPaquete(lote.id, porPaquete)
    }
  }
  if (vence) {
    for (const lote of await activos()) {
      if (lote.vence !== vence) await cambiarVence(lote.id, vence)
    }
  }
  if (gastados > 0) {
    const lotes = await activos()
    const stock = lotes.reduce((s, l) => s + l.cantidad, 0)
    const inicial = lotes.reduce((s, l) => s + l.cantidadInicial, 0)
    const sobra = +(stock - (inicial - gastados)).toFixed(2)
    if (sobra > 0) await descontarProducto(productoId, sobra)
  }
}

/**
 * "Este paquete trae N unidades": convierte un lote registrado por paquetes a unidades
 * (1 paquete → 25 lonchas) y el producto lo recuerda para la próxima compra.
 */
export async function cambiarPorPaquete(loteId, porPaquete) {
  const por = Math.max(1, Math.round(Number(porPaquete) || 1))
  await db.transaction('rw', db.lotes, db.productos, async () => {
    const lote = await db.lotes.get(loteId)
    if (!lote) return
    const factor = por / (lote.porPaquete ?? 1)
    await db.lotes.update(loteId, {
      cantidad: +(lote.cantidad * factor).toFixed(2),
      cantidadInicial: +(lote.cantidadInicial * factor).toFixed(2),
      porPaquete: por,
      actualizado: ahora(),
    })
    await db.productos.update(lote.productoId, { porPaquete: por, actualizado: ahora() })
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

export async function renombrarProducto(productoId, nombre) {
  if (!nombre.trim()) return
  await db.productos.update(productoId, { nombre: nombre.trim(), actualizado: ahora() })
}

/**
 * "Está en el congelador": pasa el lote al congelador y estima cuánto aguanta allí
 * desde el día de la compra (carne molida ~4 meses). Si ya tenía una fecha más
 * lejana (la de la etiqueta), se deja esa.
 */
export async function congelar(loteId) {
  const lote = await db.lotes.get(loteId)
  if (!lote) return null
  const producto = await db.productos.get(lote.productoId)
  const estimada = sumarDias(lote.compradoEl ?? hoyISO(), vidaEnCongelador(producto?.nombre ?? '', producto?.categoria))
  const vence = estimada > lote.vence ? estimada : lote.vence
  await db.lotes.update(loteId, {
    ubicacion: 'congelador',
    vence,
    venceEstimada: vence === estimada ? true : lote.venceEstimada,
    actualizado: ahora(),
  })
  return vence
}
