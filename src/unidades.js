// Cuántas unidades trae un paquete, sacado del nombre del producto tal como viene en
// la tirilla, en una lista escrita o en Open Food Facts:
//   "BONYURT*6und" → 6 · "HUEVOS X30" → 30 · "PAN PERRO*6" → 6 · "Pony malta six pack" → 6
//   "Queso 25 lonchas" → 25 · "6 x 200 ml" → 6
// Los pesos y volúmenes no cuentan: "*1000 GR", "100g", "620 ML" no son unidades.

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

const CONTENEDORES =
  // (no incluye "paquetes": "2 paquetes" son dos paquetes, no 2 unidades por paquete)
  'UND|UNDS|UNID|UNIDS|UNIDADES|UN|LONCHAS|TAJADAS|REBANADAS|SOBRES|BOLSITAS|LATAS|LATICAS|BOTELLAS|PIEZAS|PZAS|' +
  'TABLETAS|TABC|TAB|BARRAS|PORCIONES|PAQUETICOS|PAQUETITOS|EMPANADAS|ARE[PB]AS|TORTILLAS'
const MEDIDA = '(?:G|GR|GRS|KG|ML|L|LT|LTS|MG|CC|OZ|LB|CM|M)\\b'

const REGLAS = [
  // "SIX PACK", "SIXP", "SIXPACK"
  [/\bSIX\s?P(?:ACK)?\b/, () => 6],
  // "DOCENA" / "MEDIA DOCENA"
  [/\bMEDIA DOCENA\b/, () => 6],
  [/\bDOCENA\b/, () => 12],
  // "vienen 7", "viene por 8", "cada uno trae 3"
  [/\b(?:VIENEN|VIENE|TRAE|TRAEN)\s+(?:POR\s+)?(\d{1,3})\b/, (m) => +m[1]],
  // "6UND", "6 UNIDADES", "25 LONCHAS"
  [new RegExp(`(\\d{1,3})\\s*(?:${CONTENEDORES})\\b`), (m) => +m[1]],
  // "X30", "X 4" (pero no "X 200 ML")
  [new RegExp(`\\bX\\s?(\\d{1,3})\\b(?!\\s*${MEDIDA})`), (m) => +m[1]],
  // "6 X 200 ML": las unidades van antes de la X
  [new RegExp(`\\b(\\d{1,3})\\s?X\\s?\\d+\\s*${MEDIDA}`), (m) => +m[1]],
  // "*6" (Surtiplaza), pero no "*1000 GR" ni "*100G"
  [new RegExp(`\\*\\s?(\\d{1,3})\\b(?!\\s*${MEDIDA})`), (m) => +m[1]],
]

/** @returns {number|null} unidades por paquete (2 a 200), o null si no se sabe */
export function detectarPorPaquete(texto) {
  if (!texto) return null
  const t = sinTildes(String(texto)).toUpperCase()
  for (const [re, valor] of REGLAS) {
    const m = t.match(re)
    if (m) {
      const n = valor(m)
      if (n >= 2 && n <= 200) return n
    }
  }
  return null
}

/** "22 de 25" si el paquete trae varias unidades; "2 unidades" si no */
export function textoCantidad(lote) {
  const n = +(+lote.cantidad).toFixed(2)
  if ((lote.porPaquete ?? 1) > 1) return `Quedan ${n} de ${lote.cantidadInicial}`
  return `${n} ${n === 1 ? 'unidad' : 'unidades'}`
}
