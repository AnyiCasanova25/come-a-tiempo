import { useEffect, useRef, useState } from 'react'
import { BarcodeDetector } from 'barcode-detector/ponyfill'
import { X, Keyboard } from 'lucide-react'

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']

// Cámara trasera leyendo códigos de barras. En Android usa el lector nativo de
// Chrome; donde no existe (iPhone, PC) usa ZXing compilado a WebAssembly.
export default function Escaner({ onCodigo, onCerrar }) {
  const videoRef = useRef(null)
  const onCodigoRef = useRef(onCodigo)
  useEffect(() => {
    onCodigoRef.current = onCodigo
  })
  const [error, setError] = useState(null)
  const [manual, setManual] = useState('')
  const [verManual, setVerManual] = useState(false)

  useEffect(() => {
    let stream
    let timer
    let activo = true
    const detector = new BarcodeDetector({ formats: FORMATOS })

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (!activo) return stream.getTracks().forEach((t) => t.stop())
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        const ciclo = async () => {
          if (!activo) return
          try {
            if (video.readyState >= 2) {
              const encontrados = await detector.detect(video)
              if (encontrados.length && activo) {
                activo = false
                navigator.vibrate?.(80)
                onCodigoRef.current(encontrados[0].rawValue)
                return
              }
            }
          } catch {
            // un cuadro ilegible no es un error: se sigue intentando
          }
          timer = setTimeout(ciclo, 180)
        }
        ciclo()
      } catch (e) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'No hay permiso para usar la cámara. Actívalo en el candado de la barra de direcciones.'
            : 'No se pudo abrir la cámara. Puedes escribir el código a mano.',
        )
        setVerManual(true)
      }
    })()

    return () => {
      activo = false
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const enviarManual = (e) => {
    e.preventDefault()
    const codigo = manual.replace(/\D/g, '')
    if (codigo.length >= 6) onCodigoRef.current(codigo)
  }

  return (
    <div className="escaner">
      <div className="escaner-visor">
        <video ref={videoRef} playsInline muted />
        {!error && <div className="escaner-marco"><span /></div>}
        <button className="boton-icono escaner-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <X size={22} />
        </button>
      </div>
      <p className="escaner-ayuda">
        {error ?? 'Apunta al código de barras del producto'}
      </p>
      {verManual ? (
        <form className="fila" onSubmit={enviarManual}>
          <input
            inputMode="numeric"
            placeholder="Código de barras"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoFocus
          />
          <button className="boton">Buscar</button>
        </form>
      ) : (
        <button className="boton-texto" onClick={() => setVerManual(true)}>
          <Keyboard size={18} /> Escribir el código
        </button>
      )}
    </div>
  )
}
