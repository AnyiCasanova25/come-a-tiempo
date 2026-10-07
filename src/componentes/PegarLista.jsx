import { useMemo, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { interpretarLista } from '../pegarLista'
import { hoyISO } from '../fechas'
import { useLotesActivos, agruparEnCasa } from '../consultas'
import Revision from './Revision'
import { avisar } from './Aviso'

const EJEMPLO = `Queso en lonchas 10 - nov - 2026
Pan tajado 20 oct 2026
el queso en lonchas vienen 25, ya gastamos 5
atún son dos paquetes, cada uno trae 3 laticas`

function resumen(filas) {
  const ajustes = filas.filter((f) => f.accion === 'actualizar').length
  const nuevos = filas.length - ajustes
  const partes = []
  if (ajustes) partes.push(`${ajustes} ya ${ajustes === 1 ? 'estaba' : 'estaban'} en la casa (se ajustan)`)
  if (nuevos) partes.push(`${nuevos} ${nuevos === 1 ? 'es nuevo' : 'son nuevos'}`)
  return `${partes.join(' y ')}. Corrige lo que haga falta.`
}

// Registrar un mercado completo pegando una lista escrita (WhatsApp, notas…)
export default function PegarLista({ productos, onListo, onCancelar }) {
  const [texto, setTexto] = useState('')
  const [filas, setFilas] = useState(null)
  // Lo que ya está en la casa: un renglón sobre esto es un ajuste, no una compra nueva
  const lotes = useLotesActivos()
  const enCasa = useMemo(() => agruparEnCasa(lotes), [lotes])

  const pegarDelPortapapeles = async () => {
    try {
      setTexto(await navigator.clipboard.readText())
    } catch {
      avisar('Mantén presionado el cuadro y elige "Pegar"')
    }
  }

  if (filas) {
    return (
      <Revision
        titulo="Revisa antes de guardar"
        subtitulo={resumen(filas)}
        filas={filas}
        setFilas={setFilas}
        enCasa={enCasa}
        onVolver={() => setFilas(null)}
        onListo={onListo}
      />
    )
  }

  return (
    <div className="pila">
      <header className="encabezado">
        <h1>Pegar una lista</h1>
        <p className="nota">
          Un producto por renglón, como lo escribirías: con su fecha (“10 nov 2026”), cuántas unidades
          trae (“vienen 25”) y lo que ya gastaron (“ya gastamos 5”). Si el producto ya está en la casa,
          se ajusta en vez de agregarse otra vez.
        </p>
      </header>
      <textarea
        className="area-texto"
        rows={12}
        placeholder={EJEMPLO}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      {navigator.clipboard?.readText && (
        <button className="boton boton-secundario" onClick={pegarDelPortapapeles}>
          <ClipboardPaste size={18} /> Pegar lo que copié
        </button>
      )}
      <div className="fila">
        <button className="boton boton-secundario" onClick={onCancelar}>Cancelar</button>
        <button
          className="boton crece"
          disabled={!texto.trim()}
          onClick={() => setFilas(interpretarLista(texto, hoyISO(), productos, enCasa))}
        >
          Revisar
        </button>
      </div>
    </div>
  )
}
