import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, X, Loader2, ScanText, Copy } from 'lucide-react'
import { prepararFoto, leerTirilla, obtenerLectorTirilla } from '../ocr'
import { interpretarTirilla } from '../leerTirilla'
import { hoyISO } from '../fechas'
import Revision from './Revision'
import { avisar } from './Aviso'

// Foto(s) de la tirilla del súper → productos con cantidad y precio → revisión.
// Todo se lee en el celular (Tesseract): gratis y sin enviar las fotos a ningún lado.
export default function Tirilla({ productos, onListo, onCancelar }) {
  const [fotos, setFotos] = useState([]) // { id, archivo, url }
  const [estado, setEstado] = useState('fotos') // fotos | leyendo | revision | error
  const [progreso, setProgreso] = useState({ foto: 0, de: 0, avance: 0 })
  const [texto, setTexto] = useState('')
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const camara = useRef(null)
  const galeria = useRef(null)

  // Mientras se toman las fotos, se va descargando el lector en español (solo la primera vez)
  useEffect(() => {
    obtenerLectorTirilla().catch(() => {})
  }, [])

  // Liberar las vistas previas al salir
  const fotosRef = useRef(fotos)
  useEffect(() => {
    fotosRef.current = fotos
  })
  useEffect(() => () => fotosRef.current.forEach((f) => URL.revokeObjectURL(f.url)), [])

  const agregarFotos = (e) => {
    const nuevas = [...(e.target.files ?? [])].map((archivo) => ({
      id: crypto.randomUUID?.() ?? String(Math.random()),
      archivo,
      url: URL.createObjectURL(archivo),
    }))
    setFotos((fs) => [...fs, ...nuevas])
    e.target.value = ''
  }

  const quitarFoto = (id) =>
    setFotos((fs) => {
      const f = fs.find((x) => x.id === id)
      if (f) URL.revokeObjectURL(f.url)
      return fs.filter((x) => x.id !== id)
    })

  const leer = async () => {
    setEstado('leyendo')
    try {
      const partes = []
      for (let i = 0; i < fotos.length; i++) {
        setProgreso({ foto: i + 1, de: fotos.length, avance: 0 })
        const lienzo = await prepararFoto(fotos[i].archivo)
        partes.push(await leerTirilla(lienzo, (avance) => setProgreso((p) => ({ ...p, avance }))))
      }
      const todo = partes.join('\n')
      setTexto(todo)
      setFilas(interpretarTirilla(todo, hoyISO(), productos))
      setEstado('revision')
    } catch (e) {
      setError(
        e?.name === 'InvalidStateError' || /decod/i.test(e?.message ?? '')
          ? 'No se pudo abrir una de las fotos. Quítala y tómala de nuevo.'
          : 'No se pudo leer. Revisa la conexión a internet (la primera vez descarga el lector) e intenta de nuevo.',
      )
      setEstado('error')
    }
  }

  if (estado === 'revision' && filas) {
    if (!filas.length) {
      return (
        <div className="pila">
          <header className="encabezado">
            <h1>No encontré productos</h1>
            <p className="nota">
              La foto quizá quedó borrosa, con reflejos o de lado. Prueba otra vez con la tirilla
              estirada sobre una mesa, con buena luz y de frente.
            </p>
          </header>
          <TextoLeido texto={texto} />
          <button className="boton" onClick={() => setEstado('fotos')}>Volver a las fotos</button>
        </div>
      )
    }
    return (
      <div className="pila">
        <Revision
          titulo="Revisa la tirilla"
          subtitulo={`Encontré ${filas.length} productos. Las fechas son estimadas: escanéalas con 📷 o corrígelas.`}
          filas={filas}
          setFilas={setFilas}
          conPrecio
          onVolver={() => setEstado('fotos')}
          onListo={onListo}
        />
        <TextoLeido texto={texto} />
      </div>
    )
  }

  if (estado === 'leyendo') {
    const pct = Math.round(((progreso.foto - 1 + progreso.avance) / Math.max(1, progreso.de)) * 100)
    return (
      <div className="pila centrado">
        <Loader2 className="girando" size={40} />
        <p>Leyendo la tirilla… {pct}%</p>
        {progreso.de > 1 && <p className="nota">Foto {progreso.foto} de {progreso.de}</p>}
        <div className="progreso"><span style={{ width: `${pct}%` }} /></div>
        <p className="nota">La primera vez tarda más porque descarga el lector.</p>
      </div>
    )
  }

  return (
    <div className="pila">
      <header className="encabezado">
        <h1>Foto de la tirilla</h1>
        <p className="nota">
          Estírala sobre una mesa, con buena luz y sin sombras, y tómale foto de frente.
          Si es larga, toma varias fotos de arriba hacia abajo.
        </p>
      </header>

      {estado === 'error' && <p className="nota alerta-texto">{error}</p>}

      {fotos.length > 0 && (
        <div className="miniaturas">
          {fotos.map((f, i) => (
            <div key={f.id} className="miniatura">
              <img src={f.url} alt={`Foto ${i + 1} de la tirilla`} />
              <span className="miniatura-numero">{i + 1}</span>
              <button className="boton-icono miniatura-quitar" onClick={() => quitarFoto(f.id)} aria-label={`Quitar foto ${i + 1}`}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={agregarFotos} />
      <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={agregarFotos} />
      <div className="fila">
        <button className="boton boton-secundario crece" onClick={() => camara.current.click()}>
          <Camera size={18} /> {fotos.length ? 'Otra foto' : 'Tomar foto'}
        </button>
        <button className="boton boton-secundario crece" onClick={() => galeria.current.click()}>
          <ImagePlus size={18} /> De la galería
        </button>
      </div>

      <div className="fila">
        <button className="boton boton-secundario" onClick={onCancelar}>Cancelar</button>
        <button className="boton crece" disabled={!fotos.length} onClick={leer}>
          <ScanText size={18} /> Leer {fotos.length > 1 ? `${fotos.length} fotos` : 'tirilla'}
        </button>
      </div>
    </div>
  )
}

// Lo que leyó el OCR tal cual, por si algo no salió (sirve para entender qué pasó)
function TextoLeido({ texto }) {
  if (!texto) return null
  return (
    <details className="texto-leido">
      <summary>Ver el texto que se leyó</summary>
      <pre>{texto}</pre>
      <button className="boton boton-secundario" onClick={() => copiar(texto)}>
        <Copy size={18} /> Copiar el texto
      </button>
    </details>
  )
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    avisar('Texto copiado')
  } catch {
    avisar('Mantén presionado el texto para copiarlo')
  }
}
