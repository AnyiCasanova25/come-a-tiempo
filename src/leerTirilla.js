import { adivinarCategoria, categoria } from './categorias.js'
import { sumarDias } from './fechas.js'

// Convierte el texto que lee el OCR de una tirilla de supermercado en productos.
//
// Formatos típicos que entiende:
//   Éxito:  "1 7702001041 LECHE ENTERA ALPINA    4.590 A"   (índice + código + nombre + precio + letra de IVA)
//   D1:     "2 ATUN EN ACEITE 160G    7.980"                  (cantidad + nombre + precio)
//   Ara:    "7709876543210 YOGURT FRESA 1000G 1 UN 5.290 G"   (código + nombre + cantidad UN + precio)
//   Cantidad o peso en el renglón de abajo:  "2 X 3.250    6.500"  ·  "0,845 KG X 2.980 /KG   2.518"
//   Descuentos:  "DESCUENTO -2.000"  (se restan al producto de arriba)

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

// Renglones que no son productos
const EXCLUIR = new RegExp(
  [
    'SUB ?TOTAL', '\\bTOTAL', '\\bIVA\\b', 'IMPUESTO', 'IMPOCONSUMO', '\\bINC\\b', 'BASE (GRAV|IVA|IMP)',
    'CAMBIO', 'EFECTIVO', 'TARJETA', 'DEBITO', 'CREDITO', '\\bNIT\\b', 'RESOLUCI', '\\bDIAN\\b', 'FACTURA',
    'CAJER[OA]', '\\bCAJA ?(N|NO|#|:|\\d)', '\\bFECHA', '\\bHORA\\b', 'CLIENTE', 'CEDULA', 'PUNTOS',
    'REDONDEO', 'ITEMS', 'ARTICULOS', 'GRACIAS', 'VUELTO', 'RECIBIDO', '\\bPAGO', 'VALOR PAGADO',
    'DOMICILIO', 'PROPINA', '\\bCUFE', '\\bCUDE', '\\bTEL\\b', 'TELEFONO', 'DIRECCION', 'REGIMEN',
    'AUTORRETENEDOR', 'PREFIJO', 'VENDEDOR', 'SERIAL', 'TERMINAL', 'AUTORIZACION', 'APROBACION',
    'DONACION', 'IMP\\.? ?BOLSA', 'BOLSA PLASTICA', '\\bICUI', 'DESCRIPCION', '\\bPLU\\b', '\\bCANT\\b',
    'S\\.A\\.S|\\bS\\.A\\.', 'WWW\\.', '\\.COM', 'NEQUI', 'DAVIPLATA', 'BANCOLOMBIA', 'DATAFONO',
  ].join('|'),
)
const DESCUENTO = /\b(DESC|DCTO|DSCTO|DESCUENTO|AHORRO|PROMO|OFERTA)\b/

// Precio al final del renglón: 4.590 · 4,590 · 21900 · $ 4.590 · 4.590,00 · -2.000 · seguido de letra de IVA
// Con punto de miles la letra del IVA puede ir pegada ("6.500A"); un número suelto
// necesita espacio antes de la letra, para que "QUESO 500G" no se tome como precio 500
const PRECIO_FINAL =
  /(-)?\s*\$?\s*(?:(\d{1,3}(?:[.,]\d{3})+)(?:[.,]\d{2})?\s*-?\s*[A-Z*%#]{0,2}|(\d{3,7})(?:[.,]\d{2})?\s*-?(?:\s+[A-Z]{1,2}|\s*[*%#])?)\s*$/
const valor = (m) => aNumero(m[2] ?? m[3])

// Renglón de cantidad o peso: "2 X 3.250", "0,845 KG X 2.980 /KG  2.518", "3 UN X 1.200"
const CANTIDAD = /^\s*(\d+(?:[.,]\d{1,3})?)\s*(UN|UND|UNID|UNDS|KG|KGS|KILO|GR|GRS|G|LB)?\.?\s*[X*]\s*\$?\s*(\d[\d.,]*)/
const ES_PESO = /\b(KG|KGS|KILO|GR|GRS|G|LB)\b|\/KG|\/LB/

// Precios: los puntos o comas de miles se quitan ("4.590" → 4590)
const aNumero = (s) => Number(String(s).replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))
// Cantidades y pesos: la coma o el punto es decimal ("0,845" → 0.845)
const aCantidad = (s) => Number(String(s).replace(',', '.'))

function limpiarNombre(nombre) {
  const n = nombre
    .replace(/[|_=~"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/**
 * Separa el comienzo del renglón: números sueltos (índice, cantidad) y códigos (EAN/PLU).
 * "1 7702001041 LECHE ENTERA" → { lider: 1, resto: "LECHE ENTERA" }
 */
function quitarCodigos(texto) {
  const tokens = texto.trim().split(' ')
  let lider = null
  while (tokens.length && /^\d+$/.test(tokens[0])) {
    const t = tokens.shift()
    if (t.length <= 3 && lider === null) lider = Number(t)
  }
  return { lider, resto: tokens.join(' ') }
}

/**
 * @param {string} texto  texto crudo del OCR (puede ser de varias fotos seguidas)
 * @param {string} hoy    'AAAA-MM-DD'
 * @param {Array} conocidos productos ya guardados (para reusar nombre, categoría y vida útil)
 */
export function interpretarTirilla(texto, hoy, conocidos = []) {
  const items = []
  let pendiente = null // nombre sin precio que espera su renglón de cantidad/peso

  for (const crudo of texto.split(/\r?\n/)) {
    const linea = sinTildes(crudo)
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim()
      // El OCR confunde la O con el cero dentro de los números: "4.59O" → "4.590"
      .replace(/(?<=\d[.,]?\d*)O|O(?=\d)/g, '0')
    if (!linea || !/[A-Z0-9]/.test(linea)) continue

    // Descuento: se le resta al producto anterior
    const precioDesc = linea.match(PRECIO_FINAL)
    if (DESCUENTO.test(linea) && precioDesc) {
      const anterior = items.at(-1)
      if (anterior?.precio) anterior.precio = Math.max(0, anterior.precio - valor(precioDesc))
      continue
    }
    if (EXCLUIR.test(linea)) {
      pendiente = null
      continue
    }

    // Renglón de cantidad o peso
    const cant = linea.match(CANTIDAD)
    if (cant) {
      const porPeso = ES_PESO.test(linea) || /[.,]/.test(cant[1])
      const cantidad = porPeso ? 1 : Number(cant[1])
      // El total suele venir al final; si no, se calcula cantidad × precio unitario
      const resto = linea.slice(cant.index + cant[0].length)
      const total = resto.match(PRECIO_FINAL)
      const precio = total ? valor(total) : Math.round(aCantidad(cant[1]) * aNumero(cant[3]))
      if (pendiente) {
        items.push({ nombre: pendiente.nombre, lider: pendiente.lider, cantidad, cantidadFija: true, precio })
        pendiente = null
      } else if (items.length) {
        const anterior = items.at(-1)
        anterior.cantidad = cantidad
        anterior.cantidadFija = true
        if (total) anterior.precio = precio
      }
      continue
    }

    // Renglón de producto con precio al final
    const precio = linea.match(PRECIO_FINAL)
    const cuerpo = precio ? linea.slice(0, precio.index) : linea
    let { lider, resto } = quitarCodigos(cuerpo)
    // Cantidad antes del precio: "YOGURT FRESA 1000G 1 UN"
    let cantidad = null
    const unidades = resto.match(/\s(\d{1,3})\s*(UN|UND|UNID|UNDS)\.?$/)
    if (unidades) {
      cantidad = Number(unidades[1])
      resto = resto.slice(0, unidades.index)
    }
    const letras = (resto.match(/[A-Z]/g) ?? []).length
    if (letras < 3) {
      pendiente = null
      continue
    }
    if (!precio) {
      pendiente = { nombre: resto, lider }
      continue
    }
    pendiente = null
    if (precio[1]) continue // precio negativo suelto: no es un producto
    items.push({ nombre: resto, lider, cantidad: cantidad ?? 1, cantidadFija: cantidad !== null, precio: valor(precio) })
  }

  // El número del comienzo: si solo va subiendo (1, 2, 3, 5… puede faltar un renglón
  // que el OCR no leyó) es el índice del renglón (Éxito); si no, es la cantidad (D1)
  const lideres = items.map((i) => i.lider)
  // (una foto de la mitad de una tirilla larga empieza en 4, 12…: basta con que suban;
  // con solo dos renglones se exige además que empiece abajo, para no confundir "1, 2" de D1)
  const subiendo = lideres.every((l, k) => l !== null && (k === 0 || l > lideres[k - 1]))
  const esIndice = subiendo && (items.length >= 3 || (items.length === 2 && lideres[0] <= 3))
  if (!esIndice) {
    for (const i of items) if (!i.cantidadFija && i.lider && i.lider <= 50) i.cantidad = i.lider
  }

  // Mismo producto en varios renglones → se suma
  const porNombre = new Map(conocidos.map((p) => [p.nombre.toLowerCase(), p]))
  const filas = []
  for (const i of items) {
    const nombre = limpiarNombre(i.nombre)
    const igual = filas.find((f) => f.nombre.toLowerCase() === nombre.toLowerCase())
    if (igual) {
      igual.cantidad += i.cantidad
      igual.precio = (igual.precio ?? 0) + (i.precio ?? 0)
      continue
    }
    const conocido = porNombre.get(nombre.toLowerCase())
    const cat = conocido?.categoria ?? adivinarCategoria(nombre)
    filas.push({
      clave: `${filas.length}-${nombre}`,
      nombre,
      productoId: conocido?.id ?? null,
      categoria: cat,
      vence: sumarDias(hoy, conocido?.vidaUtilDias ?? categoria(cat).dias),
      estimada: true,
      aviso: categoria(cat).sinFecha ? 'Dura años: fecha estimada' : 'Fecha estimada: escanéala con 📷',
      advertencia: false,
      cantidad: i.cantidad,
      precio: i.precio ?? null,
      incluir: true,
    })
  }
  return filas
}
