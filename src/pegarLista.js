import { separarRenglon } from './leerFecha.js'
import { adivinarCategoria, categoria, vidaUtilPorNombre, vidaEnCongelador } from './categorias.js'
import { sumarDias } from './fechas.js'
import { detectarPorPaquete } from './unidades.js'
import { coincidencia } from './leerGastos.js'

// Convierte una lista escrita a mano (WhatsApp, notas…) en productos. Un renglón por
// producto, escrito como salga:
//   "Queso en lonchas 10 - nov - 2026"                     compra con fecha
//   "el queso en lonchas vienen 25 lonchas ya gastamos 5"  paquete de 25, gastadas 5
//   "atun son dos paquetes cada uno trae 3 laticas"       2 paquetes de 3
//   "mantequilla viene en tarrito, es una unidad"         1 unidad
// Si el producto YA ESTÁ en la casa y el renglón no trae fecha, no es una compra nueva:
// es un ajuste (cuántas unidades trae el paquete y cuánto se ha gastado).

const VINETA = /^\s*(?:[-•*·–]|\d{1,2}[.)])\s*/
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 }
const NUM_RE = `\\d+|${Object.keys(NUM).join('|')}`
const aNum = (s) => (s in NUM ? NUM[s] : Number(s))

// Dónde termina el nombre y empieza la explicación ("vienen 6…", "ya gastamos…", "x7")
const CORTE = new RegExp(
  `\\s(?:vienen|viene|trae|traen|son|cada|ya|gastamos|gaste|usamos|comimos|que|tarro|tarrito|bolsita|bolsa|` +
    `papeleta|libra|libras|kilo|kilos|marca|sabor|ese|esa|entonces|congelador|congelada|congelado|congeladas|congelados|nevera|x\\s?\\d+|` +
    `(?:${NUM_RE})\\s+(?:paquetes?|unidad(?:es)?|laticas|latas|lonchas|bolsitas|tarros?))\\b`,
  'i',
)
// Comienzo que no es nombre: "del", "el", "1 paquete de", "paquete de 6 latas de"
const INICIO = new RegExp(
  `^(?:(?:del|de la|el|la|los|las)\\s+)?(?:(?:${NUM_RE})\\s+)?(?:(?:paquetes?|bolsitas?|tarros?|cajas?)\\s+(?:de\\s+)?)?(?:\\d+\\s+\\S+\\s+de\\s+)?`,
  'i',
)
const RELLENO_FINAL = /(?:\s+(?:de|del|en|el|la|los|las|y|con|un|una|paquete|que))+$/i

const GASTADOS = new RegExp(`\\b(?:ya\\s+)?(?:gastamos|gaste|gastaron|usamos|comimos|tomamos)\\s+(${NUM_RE})\\b`)
const PAQUETES = new RegExp(`\\b(${NUM_RE})\\s+paquetes?\\b`)
const UNA_UNIDAD = /\b(es una unidad|una unidad|un tarro|una bolsita|una sola|^.*\s(una|un)$)/

function limpiarNombre(nombre) {
  let n = nombre.replace(VINETA, '').replace(/\([^)]*\)?/g, ' ').replace(/\s+/g, ' ').trim()
  n = n.replace(INICIO, '')
  // "Atún - son dos paquetes…": lo que va después del guion es la explicación
  n = n.split(/\s*-\s*/)[0]
  const corte = n.match(CORTE)
  if (corte) n = n.slice(0, corte.index)
  n = n.replace(/[\s\-/.:,;]+$/, '').replace(RELLENO_FINAL, '').trim().toLowerCase()
  return n.charAt(0).toUpperCase() + n.slice(1)
}

const numerosDe = (s) => new Set((s.match(/\d+/g) ?? []).map(Number))

/**
 * @param {string} texto
 * @param {string} hoy  'AAAA-MM-DD'
 * @param {Array} conocidos  todos los productos guardados (para reusar nombre, categoría y vida útil)
 * @param {Array<{id, nombre, categoria, porPaquete, stock}>} enCasa  productos con algo en la casa
 */
export function interpretarLista(texto, hoy, conocidos = [], enCasa = []) {
  const porNombre = new Map(conocidos.map((p) => [p.nombre.toLowerCase(), p]))
  const filas = []
  const ajustes = [] // renglones que hablan de algo que ya está en la casa

  for (const renglon of texto.split(/\r?\n/)) {
    if (!renglon.trim()) continue
    const { nombre: crudo, fecha, fechaInvalida } = separarRenglon(renglon, hoy)
    const nombre = limpiarNombre(crudo)
    if (!nombre || !/[a-záéíóúñ]{2}/i.test(nombre)) continue

    const minus = sinTildes(renglon.toLowerCase())
    const gastados = aNum(minus.match(GASTADOS)?.[1] ?? 0)
    const paquetes = aNum(minus.match(PAQUETES)?.[1] ?? 1)
    const porDetectado = detectarPorPaquete(renglon) ?? (UNA_UNIDAD.test(minus) ? 1 : null)
    // "carne molida, en el congelador": dura meses en vez de días
    const enCongelador = /\bcongelad/.test(minus)

    // ¿Ya está en la casa? Sin fecha, basta con que el nombre coincida. Con fecha, puede
    // ser una compra nueva del mismo producto: solo es ajuste si ya hay un lote con esa
    // misma fecha, o si es el mismo nombre comprado hace pocos días (la misma compra
    // descrita otra vez). Así una lista se puede pegar dos veces sin duplicar nada.
    if (enCasa.length) {
      const numeros = numerosDe(minus)
      const hace10 = sumarDias(hoy, -10)
      const candidatos = enCasa
        .map((p) => {
          const c = coincidencia(nombre, p.nombre)
          // "salchicha x7" → "Salchicha 7" antes que "Salchicha 14"
          const bonoNumero = [...numerosDe(p.nombre)].some((n) => numeros.has(n)) ? 1 : 0
          // Es el mismo si todas las palabras de uno están en el otro:
          // "chocolate instantáneo" ↔ "Chocolate", pero "salsa mayo" ✗ "Salsa bbc"
          const parecido = c.cubreConsulta === 1 || c.cubreProducto === 1
          let ok = parecido
          if (fecha) {
            const mismaFecha = (p.vences ?? []).includes(fecha.iso)
            const mismaPrimera = coincidencia(nombre.split(' ')[0], p.nombre.split(' ')[0]).cubreConsulta === 1
            const mismoNombre = c.cubreConsulta === 1 && c.cubreProducto === 1
            ok = (mismaFecha && (parecido || mismaPrimera)) || (mismoNombre && (p.ultimaCompra ?? '') >= hace10)
          }
          return { id: p.id, ok, puntos: c.puntos + bonoNumero + (fecha && (p.vences ?? []).includes(fecha.iso) ? 2 : 0) }
        })
        .filter((c) => c.ok)
      if (candidatos.length) {
        ajustes.push({ orden: filas.length, renglon, nombre, candidatos, porPaquete: porDetectado, gastados, paquetes, vence: fecha?.iso ?? null, enCongelador })
        filas.push(null) // se llena al final, cuando se sabe a qué producto le toca
        continue
      }
    }
    const nueva = filaNueva({ nombre, fecha, fechaInvalida, gastados, paquetes, porDetectado, enCongelador }, hoy, porNombre, filas.length)

    // Mismo producto y misma fecha en otro renglón → una unidad más
    const igual = filas.find((f) => f?.accion === 'nuevo' && f.nombre.toLowerCase() === nombre.toLowerCase() && f.vence === nueva.vence)
    if (igual) {
      igual.cantidad++
      continue
    }
    filas.push(nueva)
  }

  // Cada producto de la casa se asigna a UN renglón: primero los renglones que más se
  // parecen ("bonyourt mini" se lleva el mini; luego "bonyourt" se lleva el grande).
  // Si un renglón empata entre varios libres ("empanadas" ↔ los dos paquetes), aplica a todos.
  const tomados = new Set()
  const mejor = (a) => Math.max(...a.candidatos.map((c) => c.puntos))
  for (const a of [...ajustes].sort((x, y) => mejor(y) - mejor(x))) {
    const libres = a.candidatos.filter((c) => !tomados.has(c.id))
    const tope = Math.max(...libres.map((c) => c.puntos))
    const objetivos = libres.filter((c) => c.puntos === tope).map((c) => c.id)
    objetivos.forEach((id) => tomados.add(id))
    filas[a.orden] = objetivos.length
      ? {
          clave: `${a.orden}-${a.nombre}`,
          accion: 'actualizar',
          texto: a.renglon.trim(),
          nombre: a.nombre,
          objetivos,
          porPaquete: a.porPaquete,
          vence: a.vence, // si el renglón trae fecha real, se corrige la del lote
          congelar: a.enCongelador,
          paquetes: a.paquetes,
          gastados: a.gastados,
          incluir: true,
        }
      : // ya otro renglón se llevó ese producto: entonces es algo nuevo
        filaNueva(
          { ...a, porDetectado: a.porPaquete, fecha: a.vence ? { iso: a.vence, exacta: true } : null, fechaInvalida: false },
          hoy,
          porNombre,
          a.orden,
        )
  }
  return filas.filter(Boolean)
}

function filaNueva({ nombre, fecha, fechaInvalida, gastados, paquetes, porDetectado, enCongelador }, hoy, porNombre, orden) {
  const conocido = porNombre.get(nombre.toLowerCase())
  const cat = conocido?.categoria ?? adivinarCategoria(nombre)
  // Carnes, pollo y pescado duran mucho menos que su categoría en la nevera
  const vidaDias = enCongelador
    ? vidaEnCongelador(nombre, cat)
    : (conocido?.vidaUtilDias ?? vidaUtilPorNombre(nombre) ?? categoria(cat).dias)
  const vence = fecha ? fecha.iso : sumarDias(hoy, vidaDias)

  let aviso = null
  if (fechaInvalida) aviso = 'Esa fecha no existe: se estimó, corrígela'
  else if (!fecha && categoria(cat).sinFecha) aviso = 'Dura años: fecha estimada'
  else if (!fecha && enCongelador) aviso = `En el congelador dura ~${Math.round(vidaDias / 30)} meses: fecha estimada`
  else if (!fecha && vidaUtilPorNombre(nombre)) aviso = `En la nevera dura ~${vidaDias} días (congelado, meses): fecha estimada`
  else if (!fecha) aviso = 'Sin fecha: estimada'
  else if (!fecha.exacta) aviso = 'Solo mes y año: último día del mes'

  return {
    clave: `${orden}-${nombre}`,
    accion: 'nuevo',
    nombre,
    productoId: conocido?.id ?? null,
    categoria: cat,
    vence,
    vidaDias,
    estimada: !fecha,
    aviso,
    advertencia: fechaInvalida,
    cantidad: paquetes,
    porPaquete: porDetectado ?? conocido?.porPaquete ?? 1,
    ubicacion: enCongelador ? 'congelador' : categoria(cat).ubicacion,
    gastados,
    incluir: true,
  }
}
