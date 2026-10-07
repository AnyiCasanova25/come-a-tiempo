import { separarRenglon } from './leerFecha.js'
import { adivinarCategoria, categoria } from './categorias.js'
import { sumarDias } from './fechas.js'
import { detectarPorPaquete } from './unidades.js'

// Convierte una lista escrita a mano (WhatsApp, notas…) en productos con fecha.
// Un producto por renglón; la fecha puede ir en casi cualquier formato:
//   "Queso en lonchas 10 - nov - 2026", "Pan perro 8 oct 2026", "Leche 12/10/26", "Atún"
// Los renglones repetidos (mismo producto y fecha) se suman como cantidad.

const VINETA = /^\s*(?:[-•*·–]|\d{1,2}[.)])\s*/

function limpiarNombre(nombre) {
  const n = nombre
    .replace(VINETA, '')
    .replace(/[\s\-/.:,;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/**
 * @param {string} texto
 * @param {string} hoy  'AAAA-MM-DD'
 * @param {Array<{nombre: string, categoria: string}>} conocidos  productos ya guardados
 */
export function interpretarLista(texto, hoy, conocidos = []) {
  const porNombre = new Map(conocidos.map((p) => [p.nombre.toLowerCase(), p]))
  const filas = []

  for (const renglon of texto.split(/\r?\n/)) {
    if (!renglon.trim()) continue
    const { nombre: crudo, fecha, fechaInvalida } = separarRenglon(renglon, hoy)
    const nombre = limpiarNombre(crudo)
    if (!nombre || !/[a-záéíóúñ]/i.test(nombre)) continue

    const conocido = porNombre.get(nombre.toLowerCase())
    const cat = conocido?.categoria ?? adivinarCategoria(nombre)
    const estimada = !fecha
    const vence = fecha ? fecha.iso : sumarDias(hoy, conocido?.vidaUtilDias ?? categoria(cat).dias)

    let aviso = null
    if (fechaInvalida) aviso = 'Esa fecha no existe: se estimó, corrígela'
    else if (!fecha && categoria(cat).sinFecha) aviso = 'Dura años: fecha estimada'
    else if (!fecha) aviso = 'Sin fecha: estimada'
    else if (!fecha.exacta) aviso = 'Solo mes y año: último día del mes'

    // Mismo producto y misma fecha en otro renglón → una unidad más
    const igual = filas.find((f) => f.nombre.toLowerCase() === nombre.toLowerCase() && f.vence === vence)
    if (igual) {
      igual.cantidad++
      continue
    }
    filas.push({
      clave: `${filas.length}-${nombre}`,
      nombre,
      productoId: conocido?.id ?? null,
      categoria: cat,
      vence,
      estimada,
      aviso,
      advertencia: fechaInvalida,
      cantidad: 1,
      porPaquete: detectarPorPaquete(renglon) ?? conocido?.porPaquete ?? 1,
      incluir: true,
    })
  }
  return filas
}
