// Convierte lo que se escribe o dicta ("hoy gastamos 3 quesitos y 2 ponis") en
// descuentos del inventario. Entiende:
//   cantidades: "3 quesitos", "dos ponis", "media docena de huevos", sin número = 1
//   todo:       "se acabó la mantequilla", "ya no hay pan"
//   pérdidas:   "boté 2 yogures", "se dañó el queso", "se venció la leche"
//   paquetes:   "1 paquete de salchichas" (= las unidades que trae el paquete)
//   fechas:     un renglón "07/10" vale para los de abajo; "ayer", "antier";
//               mensajes copiados de WhatsApp: "[7/10, 8:15 p. m.] Anyi: 3 quesitos"
// y busca cada producto en el inventario aunque se escriba distinto
// ("quesitos" → "Queso en lonchas", "ponis" → "Pony malta").

import { sumarDias } from './fechas.js'

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

const NUMEROS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, medio: 0.5, media: 0.5,
}

// Palabras que no son parte del nombre del producto
const RELLENO = new Set(
  ('hoy ayer antier anteayer gaste gastamos gasto gastaron use usamos uso usaron comi comimos comio comieron ' +
    'tome tomamos tomaron consumimos consumi saque sacamos sacaron se me nos le les de del la las el los lo al ' +
    'con para y que ya no hay queda quedan quedo acabo acabaron acabamos termine terminamos termino terminaron ' +
    'bote botamos boto botaron dano danaron danado danada vencio vencieron vencido vencida podrido podrida ' +
    'unidad unidades und uds paquete paquetes paq bolsa bolsas mas otra otro otras otros total todo toda todos todas ' +
    'en por fue fueron')
    .split(' '),
)

const TODO = /\b(se acabo|se acabaron|se termino|se terminaron|acabamos|terminamos|ya no hay|no queda|no hay mas|todo el|toda la|todos los|todas las)\b/
const BOTADO = /\b(bote|botamos|boto|botaron|se dano|se danaron|danado|danada|se vencio|se vencieron|vencido|vencida|podrido|podrida|se perdio)\b/
const PAQUETE = /\b(paquete|paquetes|paq|bolsa|bolsas|caja|cajas|six ?pack|sixpack)\b/

// "[7/10, 8:15 p. m.] Anyi: …" o "7/10/26 20:15 - Anyi: …" (mensajes copiados de WhatsApp)
const WHATSAPP = /^\[?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?,?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?[^:]{1,40}:\s*/i
const FECHA = /(?:^|\s)(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?=\s|$|[,:;])/

function fechaDe(dia, mes, anio, hoy) {
  const a = anio ? (+anio < 100 ? 2000 + +anio : +anio) : +hoy.slice(0, 4)
  if (+mes < 1 || +mes > 12 || +dia < 1 || +dia > 31) return null
  let iso = `${a}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  // Sin año y en el futuro → es del año pasado (una lista de diciembre leída en enero)
  if (!anio && iso > hoy) iso = `${a - 1}${iso.slice(4)}`
  return iso
}

// Dos formas de cada palabra para comparar:
//   base: sin plural y con y→i     ("ponis"/"pony" → "poni", "yogures" → "yogur")
//   dim:  además sin diminutivo     ("quesitos" → "ques", "panitos" → "pan")
function formas(palabra) {
  let base = sinTildes(palabra.toLowerCase()).replace(/[^a-z0-9ñ]/g, '')
  if (base.length > 4 && base.endsWith('es') && !/[aeiou]es$/.test(base)) base = base.slice(0, -2)
  else if (base.length > 3 && base.endsWith('s')) base = base.slice(0, -1)
  base = base.replace(/y$/, 'i')
  // Solo -ito/-ita: "-illa" casi siempre es otra palabra (manzanilla, tortilla, mantequilla)
  const dim = base.replace(/c?it[oa]$/, '')
  return { base, dim: dim.length >= 3 ? dim : base }
}

// Nombres distintos para lo mismo (en la tirilla los productos van con su marca)
const EQUIVALENTES = [
  ['yogur', 'yogurt', 'yurt', 'bonyurt', 'bonyourt', 'yourt', 'yout', 'yogo', 'alpinito'],
  ['salchicha', 'salch'],
  ['gaseosa', 'coca', 'cola'],
  ['papel', 'higienico'],
  ['jabon', 'jab'],
  ['galleta', 'gall'],
]
const grupoDe = new Map(EQUIVALENTES.flatMap((g, i) => g.map((p) => [formas(p).base, i])))

function palabrasDe(nombre) {
  return sinTildes(nombre.toLowerCase())
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length >= 3 && !/\d/.test(p))
    .map(formas)
}

// Cuánto se parecen dos palabras: 3 iguales, 2 por diminutivo o equivalente, 1 empieza igual
function parecido(q, t) {
  if (q.base === t.base) return 3
  const cerca = (a, b) => a === b || (b.startsWith(a) && b.length - a.length <= 1)
  if (cerca(q.dim, t.base) || cerca(t.dim, q.base)) return 2
  const g = grupoDe.get(q.base)
  // (por el comienzo de la palabra: "cola" no debe encontrarse dentro de "chocolate")
  if (g !== undefined && (grupoDe.get(t.base) === g || EQUIVALENTES[g].some((e) => t.base.startsWith(e)))) return 2
  if (Math.min(q.base.length, t.base.length) >= 4 && (t.base.startsWith(q.base) || q.base.startsWith(t.base))) return 1
  return 0
}

/**
 * Busca el producto más parecido ("quesitos" → "Queso en lonchas", "pan" → "Pan tajado"
 * antes que "Panitos"). Si coincide la primera palabra del producto, suma un poco más:
 * es la que dice qué es ("Queso…" antes que "Arepa rellena de queso").
 * @returns {Array<{id, puntos}>} candidatos de mejor a peor
 */
export function buscarProducto(consulta, productos) {
  const q = palabrasDe(consulta)
  if (!q.length) return []
  const candidatos = []
  for (const prod of productos) {
    const palabras = palabrasDe(prod.nombre)
    let puntos = 0
    for (const w of q) {
      const mejor = Math.max(0, ...palabras.map((t) => parecido(w, t)))
      puntos += mejor
      if (mejor && palabras[0] && parecido(w, palabras[0]) === mejor) puntos += 0.5
    }
    if (puntos > 0) candidatos.push({ id: prod.id, puntos: puntos / q.length })
  }
  return candidatos.sort((a, b) => b.puntos - a.puntos)
}

/**
 * @param {string} texto
 * @param {Array<{id, nombre, stock, porPaquete}>} productos  lo que hay en la casa
 * @param {string} hoy 'AAAA-MM-DD'
 */
export function interpretarGastos(texto, productos, hoy) {
  const filas = []
  let fecha = hoy

  for (let renglon of texto.split(/\r?\n/)) {
    renglon = renglon.trim()
    if (!renglon) continue

    // Mensaje de WhatsApp: la fecha del mensaje vale para ese renglón
    const wa = renglon.match(WHATSAPP)
    if (wa) {
      fecha = fechaDe(wa[1], wa[2], wa[3], hoy) ?? fecha
      renglon = renglon.slice(wa[0].length)
    }
    // Fecha suelta en el renglón ("07/10", "7/10/26")
    const f = renglon.match(FECHA)
    if (f) {
      const iso = fechaDe(f[1], f[2], f[3], hoy)
      if (iso) {
        fecha = iso
        renglon = (renglon.slice(0, f.index) + ' ' + renglon.slice(f.index + f[0].length)).trim()
      }
    }
    const minus = sinTildes(renglon.toLowerCase())
    let fechaRenglon = fecha
    if (/\bayer\b/.test(minus)) fechaRenglon = sumarDias(hoy, -1)
    if (/\b(antier|anteayer)\b/.test(minus)) fechaRenglon = sumarDias(hoy, -2)
    if (/\bhoy\b/.test(minus)) fechaRenglon = hoy

    // Varios productos en un renglón: "3 quesitos, 2 ponis y 1 pan"
    const partes = minus.split(/\s*(?:,|;|\+|\by\b|\be\b)\s*/).filter((p) => /[a-z]/.test(p))
    for (const parte of partes) {
      const fila = interpretarParte(parte, productos)
      if (fila) filas.push({ ...fila, fecha: fechaRenglon })
    }
  }
  return filas
}

function interpretarParte(parte, productos) {
  const todo = TODO.test(parte)
  const tipo = BOTADO.test(parte) ? 'botado' : 'consumo'
  const enPaquetes = PAQUETE.test(parte)

  // Cantidad: número o palabra ("3", "1,5", "tres", "media docena")
  let cantidad = null
  let resto = parte
  if (/\bmedia docena\b/.test(resto)) {
    cantidad = 6
    resto = resto.replace(/\bmedia docena\b/, ' ')
  } else if (/\bdocena\b/.test(resto)) {
    cantidad = 12
    resto = resto.replace(/\bdocena\b/, ' ')
  }
  if (cantidad === null) {
    const num = resto.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?=\s|$)/)
    if (num) {
      cantidad = Number(num[1].replace(',', '.'))
      resto = resto.replace(num[0], ' ')
    } else {
      const palabra = resto.split(/\s+/).find((p) => p in NUMEROS)
      if (palabra) {
        cantidad = NUMEROS[palabra]
        resto = resto.replace(new RegExp(`\\b${palabra}\\b`), ' ')
      }
    }
  }

  const consulta = resto
    .split(/\s+/)
    .filter((p) => p && !RELLENO.has(p) && !(p in NUMEROS))
    .join(' ')
  if (!/[a-z]{3}/.test(consulta)) return null

  const candidatos = buscarProducto(consulta, productos)
  const elegido = candidatos[0] ? productos.find((p) => p.id === candidatos[0].id) : null

  // Unidades a descontar
  let unidades
  if (todo) unidades = elegido?.stock ?? cantidad ?? 1
  else unidades = (cantidad ?? 1) * (enPaquetes && elegido?.porPaquete > 1 ? elegido.porPaquete : 1)

  return {
    texto: parte.trim(),
    consulta,
    cantidad: unidades,
    todo,
    tipo,
    productoId: elegido?.id ?? null,
    // otros que también podrían ser (para que se pueda escoger en la revisión)
    alternativas: candidatos.slice(1, 4).map((c) => c.id),
  }
}

/**
 * Qué tanto se parecen un texto y el nombre de un producto, para decidir si un renglón
 * habla de algo que ya está en la casa: cuántas palabras del texto están en el nombre
 * (cubreConsulta) y cuántas del nombre están en el texto (cubreProducto), de 0 a 1.
 */
export function coincidencia(consulta, nombre) {
  const q = palabrasDe(consulta)
  const t = palabrasDe(nombre)
  if (!q.length || !t.length) return { cubreConsulta: 0, cubreProducto: 0, puntos: 0 }
  const fuerte = (a, lista, alReves) => lista.some((b) => (alReves ? parecido(b, a) : parecido(a, b)) >= 2)
  return {
    cubreConsulta: q.filter((w) => fuerte(w, t)).length / q.length,
    cubreProducto: t.filter((w) => fuerte(w, q, true)).length / t.length,
    puntos: q.reduce((s, w) => s + Math.max(0, ...t.map((x) => parecido(w, x))), 0) / q.length,
  }
}
