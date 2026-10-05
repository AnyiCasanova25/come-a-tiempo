// Convierte el texto que lee el OCR de un empaque en la fecha de vencimiento.
//
// Formatos que entiende (con / . - o espacios):
//   12/03/2027  12.03.27  2027-03-12  03/2027  03/27  12MAR27  12 MAR 2027  MAR 2027
// Si el empaque trae varias fechas (fabricación y vencimiento), usa las palabras
// clave (VENCE, F.V., EXP, CAD… / FAB, ELAB, F.P.…) y si no hay, la más lejana.
// Las fechas sin día (03/2027) se toman como el último día del mes.

// Cada mes con sus formas: completo, abreviado y a medias ("MARZ", "SEPT")
const FORMAS_MES = [
  ['ENERO ENER ENE JANUARY JAN', 1],
  ['FEBRERO FEBR FEB FEBRUARY', 2],
  ['MARZO MARZ MAR MARCH', 3],
  ['ABRIL ABR APRIL APR', 4],
  ['MAYO MAY', 5],
  ['JUNIO JUN JUNE', 6],
  ['JULIO JUL JULY', 7],
  ['AGOSTO AGOS AGO AUGUST AUG', 8],
  ['SEPTIEMBRE SETIEMBRE SEPT SEP SET SEPTEMBER', 9],
  ['OCTUBRE OCTU OCT OCTOBER', 10],
  ['NOVIEMBRE NOVI NOV NOVEMBER', 11],
  ['DICIEMBRE DICI DIC DECEMBER DEC', 12],
]
const MESES = Object.fromEntries(FORMAS_MES.flatMap(([formas, n]) => formas.split(' ').map((f) => [f, n])))
// Las formas largas primero, para que "MARZO" no se lea como "MAR" + "ZO"
const NOMBRE_MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|')

// Palabras que suelen ir antes de cada tipo de fecha
const CLAVE_VENCE = /(VENCE|VENC|VTO|VEN|F\.?\s?V|F\.?\s?VTO|EXP|CAD|CONSUMIR|ANTES|BEST|BB|USE BY|V\s?:)/
const CLAVE_FABRICA = /(FAB|ELAB|F\.?\s?E\b|F\.?\s?P\b|PROD|MFG|EMP|ENV)/

const SEP = '[\\/.\\-\\s]'

// Arreglos típicos del OCR en zonas numéricas: O→0, I/l/|→1, S→5, B→8, Z→2
// El OCR a veces lee "0CT" o "N0V": un mes escrito con números parecidos a letras
const MES_CON_NUMEROS = new RegExp(
  `(?<![A-Z])(${Object.keys(MESES)
    .sort((a, b) => b.length - a.length)
    .map((f) => f.replace(/O/g, '[O0]').replace(/I/g, '[I1]').replace(/S/g, '[S5]'))
    .join('|')})(?![A-Z])`,
  'g',
)

export function normalizar(texto) {
  let t = texto.toUpperCase().replace(/[“”"'`´,]/g, ' ').replace(/\s+/g, ' ')
  t = t.replace(MES_CON_NUMEROS, (m) => m.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S'))
  // "10 - NOV - 2026" → "10-NOV-2026"
  t = t.replace(/\s*([/.-])\s*/g, '$1')
  // "10 DE NOVIEMBRE DE 2026" → "10 NOVIEMBRE 2026" (solo el DE que está dentro de una fecha)
  t = t
    .replace(new RegExp(`(\\d) DEL? (?=(${NOMBRE_MES})\\b)`, 'g'), '$1 ')
    .replace(new RegExp(`\\b(${NOMBRE_MES}) DEL? (?=\\d)`, 'g'), '$1 ')
  const cerca = /(?<=[\d/.\-])[OQDILSBZ|]|[OQDILSBZ|](?=[\d/.\-])/g
  const mapa = { O: '0', Q: '0', D: '0', I: '1', L: '1', '|': '1', S: '5', B: '8', Z: '2' }
  const esLetra = (c) => /[A-Z]/.test(c ?? '')
  // Dos pasadas para cadenas como "O3/O5/2O27". Una letra pegada a otra letra
  // no se toca: es parte de una palabra (OCT, DIC, LOTE, BB…)
  for (let i = 0; i < 2; i++) {
    t = t.replace(cerca, (c, pos, todo) =>
      esLetra(todo[pos - 1]) || esLetra(todo[pos + 1]) ? c : mapa[c],
    )
  }
  return t
}

const anioCompleto = (a) => (a < 100 ? 2000 + a : a)

function diasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate()
}

function crear(anio, mes, dia, exacta = true) {
  anio = anioCompleto(anio)
  if (mes < 1 || mes > 12 || anio < 2000 || anio > 2099) return null
  const ultimo = diasDelMes(anio, mes)
  if (dia == null) dia = ultimo
  if (dia < 1 || dia > ultimo) return null
  const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  return { iso, exacta }
}

// Encuentra todas las fechas candidatas con su posición en el texto
function candidatas(t) {
  const res = []
  const agregar = (m, fecha) => {
    if (fecha) res.push({ ...fecha, pos: m.index, fin: m.index + m[0].length })
  }
  const usados = []
  const libre = (m) => !usados.some(([a, b]) => m.index < b && m.index + m[0].length > a)
  const marcar = (m) => usados.push([m.index, m.index + m[0].length])

  const patrones = [
    // 2027-03-12 (año primero; el separador se repite: \2)
    [new RegExp(`\\b(20\\d{2})(${SEP})(\\d{1,2})\\2(\\d{1,2})\\b`, 'g'), (m) => crear(+m[1], +m[3], +m[4])],
    // 12/03/2027 o 12/03/27 (día primero; si el "mes" pasa de 12, es formato gringo MM/DD)
    [new RegExp(`\\b(\\d{1,2})(${SEP})(\\d{1,2})\\2(20\\d{2}|\\d{2})\\b`, 'g'), (m) => {
      const [a, b, anio] = [+m[1], +m[3], +m[4]]
      return b > 12 && a <= 12 ? crear(anio, a, b) : crear(anio, b, a)
    }],
    // 12MAR27, 12 MAR 2027, 12-MAR-2027
    [new RegExp(`\\b(\\d{1,2})${SEP}?(${NOMBRE_MES})${SEP}?(20\\d{2}|\\d{2})\\b`, 'g'), (m) => crear(+m[3], MESES[m[2]], +m[1])],
    // MAR 12 2027 (estilo inglés)
    [new RegExp(`\\b(${NOMBRE_MES})${SEP}?(\\d{1,2})${SEP}(20\\d{2})\\b`, 'g'), (m) => crear(+m[3], MESES[m[1]], +m[2])],
    // MAR 2027, MAR/27 (sin día)
    [new RegExp(`\\b(${NOMBRE_MES})${SEP}?(20\\d{2}|\\d{2})\\b`, 'g'), (m) => crear(+m[2], MESES[m[1]], null, false)],
    // "IBENE27": el día salió ilegible (tinta de puntos) pero el mes y el año sí se leen
    [new RegExp(`(?<=[A-Z0-9])(${NOMBRE_MES})(20\\d{2}|\\d{2})\\b`, 'g'), (m) => crear(+m[2], MESES[m[1]], null, false), { parcial: true }],
    // 03/2027 (sin día)
    [new RegExp(`\\b(\\d{1,2})${SEP}(20\\d{2})\\b`, 'g'), (m) => crear(+m[2], +m[1], null, false)],
    // 03/27 (sin día) — solo con / o - para no confundir con horas (12.30) o pesos
    [/\b(\d{1,2})[/-](\d{2})\b/g, (m) => crear(+m[2], +m[1], null, false)],
    // 12032027 o 120327 pegados, solo si van junto a una palabra clave (se valida después)
    [/\b(\d{2})(\d{2})(20\d{2}|\d{2})\b/g, (m) => crear(+m[3], +m[2], +m[1]), { pegada: true }],
  ]

  for (const [re, fn, extra] of patrones) {
    for (const m of t.matchAll(re)) {
      if (!libre(m)) continue
      // Se marca aunque sea inválida (31/02/2027): así un patrón más corto
      // no rescata un pedazo ("02/2027") de algo que ya se vio que no es fecha
      marcar(m)
      // Las inválidas se guardan igual (iso: null) para saber dónde empieza la fecha en un renglón
      agregar(m, { ...(fn(m) ?? { iso: null, invalida: true }), ...extra })
    }
  }
  return res.sort((a, b) => a.pos - b.pos)
}

// Qué dice el texto justo antes de una fecha (hasta la fecha anterior o 14 caracteres)
function contexto(t, c, anterior) {
  const desde = Math.max(anterior ? anterior.fin : 0, c.pos - 14)
  return t.slice(desde, c.pos)
}

/**
 * @param {string} texto  texto crudo del OCR
 * @param {string} hoy    fecha de hoy 'AAAA-MM-DD' (para descartar fechas imposibles)
 * @returns {{ iso: string, exacta: boolean } | null}
 */
export function extraerFecha(texto, hoy = new Date().toISOString().slice(0, 10)) {
  if (!texto) return null
  const t = normalizar(texto)
  const lista = candidatas(t)

  // Rango razonable para un vencimiento: hasta 2 meses atrás y 6 años adelante
  const minimo = restarMeses(hoy, 2)
  const maximo = `${+hoy.slice(0, 4) + 6}${hoy.slice(4)}`

  const evaluadas = lista.map((c, i) => {
    const antes = contexto(t, c, lista[i - 1])
    return {
      ...c,
      vence: CLAVE_VENCE.test(antes),
      fabrica: CLAVE_FABRICA.test(antes) && !CLAVE_VENCE.test(antes),
    }
  }).filter((c) => c.iso && (!c.pegada || c.vence) && !c.fabrica && c.iso >= minimo && c.iso <= maximo)

  if (!evaluadas.length) return null
  const conClave = evaluadas.filter((c) => c.vence)
  const pool = conClave.length ? conClave : evaluadas
  // La de vencimiento es la más lejana (la de fabricación siempre es anterior)
  const elegida = pool.reduce((a, b) => (b.iso > a.iso ? b : a))
  return elegida.parcial
    ? { iso: elegida.iso, exacta: false, parcial: true }
    : { iso: elegida.iso, exacta: elegida.exacta }
}

/**
 * Para listas escritas a mano ("Queso en lonchas 10 - nov - 2026"):
 * separa el nombre del producto de su fecha.
 * @returns {{ nombre: string, fecha: { iso: string, exacta: boolean } | null, fechaInvalida: boolean }}
 *   nombre en mayúsculas (texto normalizado); fechaInvalida = tenía algo con forma de
 *   fecha pero no existe o no es razonable (p. ej. 29 feb 2027)
 */
export function separarRenglon(texto, hoy = new Date().toISOString().slice(0, 10)) {
  const t = normalizar(texto)
  const lista = candidatas(t).filter((c) => !c.pegada)
  const fecha = extraerFecha(texto, hoy)
  const inicio = lista.length ? lista[0].pos : t.length
  return { nombre: t.slice(0, inicio), fecha, fechaInvalida: !fecha && lista.length > 0 }
}

function restarMeses(iso, n) {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1 - n, d)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}
