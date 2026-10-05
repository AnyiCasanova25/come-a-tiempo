import { useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { interpretarLista } from '../pegarLista'
import { hoyISO } from '../fechas'
import Revision from './Revision'
import { avisar } from './Aviso'

const EJEMPLO = `Queso en lonchas 10 - nov - 2026
Pan tajado 20 oct 2026
Leche 12/10/26
Atún`

// Registrar un mercado completo pegando una lista escrita (WhatsApp, notas…)
export default function PegarLista({ productos, onListo, onCancelar }) {
  const [texto, setTexto] = useState('')
  const [filas, setFilas] = useState(null)

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
        subtitulo={`Encontré ${filas.length} productos. Corrige lo que haga falta.`}
        filas={filas}
        setFilas={setFilas}
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
          Un producto por renglón, con su fecha como la escribas: “10 nov 2026”, “10/11/26”, “10 de noviembre”.
          Lo que no tenga fecha se estima.
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
          onClick={() => setFilas(interpretarLista(texto, hoyISO(), productos))}
        >
          Revisar
        </button>
      </div>
    </div>
  )
}
