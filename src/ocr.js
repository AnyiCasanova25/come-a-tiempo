import { createWorker, PSM } from 'tesseract.js'

// Lector de texto (Tesseract) que corre en el celular: gratis y sin enviar fotos a
// ningún lado. La primera vez descarga el motor y el idioma (unos pocos MB) y
// después quedan guardados en el navegador.
let lector = null

export function obtenerLector() {
  if (!lector) {
    lector = (async () => {
      const w = await createWorker('eng', 1)
      await w.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        user_defined_dpi: '300', // evita que adivine la resolución en cada lectura
        tessedit_char_whitelist: '0123456789/.-: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      })
      return w
    })().catch((e) => {
      lector = null // permitir reintentar (p. ej. si no había internet)
      throw e
    })
  }
  return lector
}

export async function leerTexto(canvas) {
  const w = await obtenerLector()
  const { data } = await w.recognize(canvas)
  return data.text
}

// Variantes de la imagen que se van alternando en cada intento:
//  normal · puntos unidos (tinta de puntos de latas y bolsas, con dos grosores
//  porque la separación cambia con la distancia) · invertida (letra clara sobre oscuro)
export const VARIANTES = [
  { puntos: 0, invertir: false },
  { puntos: 3, invertir: false },
  { puntos: 0, invertir: true },
  { puntos: 5, invertir: false },
]

/**
 * Recorta del video la zona del recuadro y la deja lista para el OCR:
 * escala de grises, contraste estirado y, según la variante, suavizado o invertido.
 * Se hace a mano (no con ctx.filter) para que funcione igual en iPhone.
 */
export function recortar(video, recuadro, destino, variante) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return false

  // El video se muestra con object-fit: cover, así que hay que convertir
  // las coordenadas de pantalla del recuadro a píxeles reales de la cámara
  const rv = video.getBoundingClientRect()
  const rr = recuadro.getBoundingClientRect()
  const escala = Math.max(rv.width / vw, rv.height / vh)
  const offX = (rv.width - vw * escala) / 2
  const offY = (rv.height - vh * escala) / 2
  const sx = (rr.left - rv.left - offX) / escala
  const sy = (rr.top - rv.top - offY) / escala
  const sw = rr.width / escala
  const sh = rr.height / escala

  // Ancho de trabajo ~900 px: suficiente para que la letra quede legible sin hacerlo lento
  const ancho = 900
  const alto = Math.round((sh / sw) * ancho)
  destino.width = ancho
  destino.height = alto
  const ctx = destino.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, ancho, alto)

  const img = ctx.getImageData(0, 0, ancho, alto)
  const px = img.data
  let gris = new Uint8ClampedArray(ancho * alto)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    gris[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
  }
  if (variante.puntos) gris = unirPuntos(gris, ancho, alto, variante.puntos)

  // Estirar el contraste usando los percentiles 2 y 98 (ignora reflejos y sombras extremas)
  const hist = new Uint32Array(256)
  for (const g of gris) hist[g | 0]++
  const total = gris.length
  let bajo = 0
  let alto98 = 255
  for (let acc = 0, v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc < total * 0.02) bajo = v
    if (acc <= total * 0.98) alto98 = v
  }
  const rango = Math.max(1, alto98 - bajo)
  for (let j = 0, i = 0; j < gris.length; j++, i += 4) {
    let v = ((gris[j] - bajo) * 255) / rango
    if (variante.invertir) v = 255 - v
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return true
}

// "Cierre" morfológico para letra oscura de puntos: primero se engordan las zonas
// oscuras (mínimo) hasta que los puntos vecinos se tocan y luego se adelgazan (máximo)
// con el mismo radio. Los huecos entre puntos quedan rellenos y la letra se vuelve continua.
function unirPuntos(g, w, h, r) {
  return filtrar(filtrar(g, w, h, r, Math.min), w, h, r, Math.max)
}

// Mínimo o máximo en una ventana cuadrada de radio r (separable: filas y luego columnas)
function filtrar(g, w, h, r, fn) {
  const tmp = new Uint8ClampedArray(g.length)
  const out = new Uint8ClampedArray(g.length)
  for (let y = 0; y < h; y++) {
    const fila = y * w
    for (let x = 0; x < w; x++) {
      let v = g[fila + x]
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) v = fn(v, g[fila + k])
      tmp[fila + x] = v
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = tmp[y * w + x]
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) v = fn(v, tmp[k * w + x])
      out[y * w + x] = v
    }
  }
  return out
}
