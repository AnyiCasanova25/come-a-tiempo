import { useEffect, useRef, useState } from 'react'
import { X, Flashlight, CalendarX, PenLine, Loader2 } from 'lucide-react'
import { obtenerLector, leerTexto, recortar, VARIANTES } from '../ocr'
import { extraerFecha } from '../leerFecha'
import { hoyISO, fechaCorta } from '../fechas'

// Cuántas lecturas iguales hacen falta para dar la fecha por buena. Si solo se
// leyó mes y año (día ilegible) se pide una más, por si llega una lectura completa
const CONFIRMACIONES = 2
const CONFIRMACIONES_PARCIAL = 3

// Cámara que lee la fecha de vencimiento del empaque, como el escáner de códigos:
// apunta, lee varias veces por segundo y cuando la misma fecha sale dos veces, la toma.
export default function EscanerFecha({ titulo, onFecha, onSinFecha, onCerrar }) {
  const videoRef = useRef(null)
  const recuadroRef = useRef(null)
  const onFechaRef = useRef(onFecha)
  useEffect(() => {
    onFechaRef.current = onFecha
  })
  const pistaRef = useRef(null)
  const [estado, setEstado] = useState('preparando') // preparando | leyendo | error
  const [error, setError] = useState(null)
  const [visto, setVisto] = useState('') // lo último que leyó (para que se vea que trabaja)
  const [candidata, setCandidata] = useState(null)
  const [linterna, setLinterna] = useState(null) // null = el celular no tiene

  useEffect(() => {
    let stream
    let activo = true
    const lienzo = document.createElement('canvas')
    const lecturas = [] // últimas fechas leídas

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (!activo) return stream.getTracks().forEach((t) => t.stop())
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        const pista = stream.getVideoTracks()[0]
        pistaRef.current = pista
        if (pista.getCapabilities?.().torch) setLinterna(false)

        await obtenerLector()
        if (!activo) return
        setEstado('leyendo')

        // Cada intento espera al anterior: el OCR tarda lo que tarde el celular
        for (let intento = 0; activo; intento++) {
          const variante = VARIANTES[intento % VARIANTES.length]
          if (!recortar(video, recuadroRef.current, lienzo, variante)) {
            await new Promise((r) => setTimeout(r, 200))
            continue
          }
          const texto = await leerTexto(lienzo)
          if (!activo) return
          const limpio = texto.replace(/\s+/g, ' ').trim()
          if (limpio) setVisto(limpio.slice(0, 60))

          const fecha = extraerFecha(texto, hoyISO())
          lecturas.push(fecha?.iso ?? null)
          if (lecturas.length > 6) lecturas.shift()
          if (!fecha) continue
          setCandidata(fecha)
          const veces = lecturas.filter((f) => f === fecha.iso).length
          if (veces >= (fecha.parcial ? CONFIRMACIONES_PARCIAL : CONFIRMACIONES)) {
            activo = false
            navigator.vibrate?.([60, 40, 60])
            onFechaRef.current(fecha)
            return
          }
        }
      } catch (e) {
        if (!activo) return
        setEstado('error')
        setError(
          e?.name === 'NotAllowedError'
            ? 'No hay permiso para usar la cámara. Actívalo en el candado de la barra de direcciones.'
            : e?.name === 'NotFoundError' || e?.name === 'NotReadableError'
              ? 'No se pudo abrir la cámara.'
              : 'No se pudo preparar el lector de fechas. Revisa la conexión a internet (la primera vez lo descarga).',
        )
      }
    })()

    return () => {
      activo = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const alternarLinterna = async () => {
    try {
      await pistaRef.current.applyConstraints({ advanced: [{ torch: !linterna }] })
      setLinterna(!linterna)
    } catch {
      setLinterna(null)
    }
  }

  return (
    <div className="escaner">
      {titulo && <p className="escaner-titulo">{titulo}</p>}
      <div className="escaner-visor">
        <video ref={videoRef} playsInline muted />
        <div className="escaner-marco escaner-marco-fecha">
          <span ref={recuadroRef} />
        </div>
        <button className="boton-icono escaner-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <X size={22} />
        </button>
        {linterna !== null && (
          <button
            className={`boton-icono escaner-linterna ${linterna ? 'encendida' : ''}`}
            onClick={alternarLinterna}
            aria-label={linterna ? 'Apagar linterna' : 'Encender linterna'}
          >
            <Flashlight size={22} />
          </button>
        )}
        {estado !== 'error' && (
          <div className="escaner-lectura" aria-live="polite">
            {estado === 'preparando' ? (
              <><Loader2 className="girando" size={16} /> Preparando el lector…</>
            ) : candidata ? (
              <>Leyendo <strong>{fechaCorta(candidata.iso)}</strong>… sostén quieto</>
            ) : visto ? (
              <>Veo: <span className="escaner-texto">{visto}</span></>
            ) : (
              'Buscando la fecha…'
            )}
          </div>
        )}
      </div>
      <p className="escaner-ayuda">
        {error ?? 'Encuadra la fecha dentro del recuadro, derecha (gira el producto si está en diagonal), con buena luz y sin reflejos'}
      </p>
      <div className="fila">
        <button className="boton boton-secundario crece" onClick={onCerrar}>
          <PenLine size={18} /> Escribirla
        </button>
        {onSinFecha && (
          <button className="boton boton-secundario crece" onClick={onSinFecha}>
            <CalendarX size={18} /> No tiene fecha
          </button>
        )}
      </div>
    </div>
  )
}
