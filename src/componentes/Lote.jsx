import { useState } from 'react'
import { MinusCircle, PackageCheck, Trash2, CalendarDays, Eraser } from 'lucide-react'
import Hoja from './Hoja'
import { categoria } from '../categorias'
import { nivel, textoVence, fechaCorta } from '../fechas'
import { consumir, seAcabo, botar, eliminarLote, cambiarVence } from '../db'
import { avisar } from './Aviso'

export function FilaLote({ lote, diasAviso, onAbrir }) {
  const cat = categoria(lote.producto?.categoria)
  const n = nivel(lote.vence, diasAviso)
  return (
    <button className="lote" onClick={() => onAbrir(lote)}>
      <span className="lote-emoji" aria-hidden>{cat.emoji}</span>
      <span className="lote-info">
        <span className="lote-nombre">{lote.producto?.nombre ?? 'Producto'}</span>
        <span className="lote-detalle">
          {lote.cantidad} {lote.cantidad === 1 ? 'unidad' : 'unidades'}
          {lote.venceEstimada && ' · fecha estimada'}
        </span>
      </span>
      <span className={`etiqueta etiqueta-${n}`}>{textoVence(lote.vence)}</span>
    </button>
  )
}

// Acciones sobre un lote: usar, se acabó, botar, corregir fecha, eliminar
export function AccionesLote({ lote, onCerrar }) {
  const [editando, setEditando] = useState(false)
  const [fecha, setFecha] = useState(lote?.vence ?? '')

  if (!lote) return null
  const nombre = lote.producto?.nombre ?? 'Producto'
  const hacer = (fn, mensaje) => async () => {
    await fn()
    avisar(mensaje)
    onCerrar()
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={nombre}>
      <p className="hoja-sub">
        {lote.cantidad} {lote.cantidad === 1 ? 'unidad' : 'unidades'} · {textoVence(lote.vence)}
        {lote.venceEstimada ? ' (estimada)' : ''} · comprado el {fechaCorta(lote.compradoEl)}
      </p>
      {editando ? (
        <div className="pila">
          <label className="campo">
            <span>Fecha de vencimiento</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <button
            className="boton"
            disabled={!fecha}
            onClick={hacer(() => cambiarVence(lote.id, fecha), 'Fecha actualizada')}
          >
            Guardar fecha
          </button>
        </div>
      ) : (
        <div className="acciones">
          {lote.cantidad > 1 && (
            <button className="accion" onClick={hacer(() => consumir(lote.id, 1), `Usaste 1 · quedan ${lote.cantidad - 1}`)}>
              <MinusCircle /> Usé 1
            </button>
          )}
          <button className="accion" onClick={hacer(() => seAcabo(lote.id), `${nombre}: se acabó`)}>
            <PackageCheck /> Se acabó
          </button>
          <button className="accion accion-peligro" onClick={hacer(() => botar(lote.id), `${nombre}: botado`)}>
            <Trash2 /> Lo boté (vencido)
          </button>
          <button className="accion" onClick={() => setEditando(true)}>
            <CalendarDays /> {lote.venceEstimada ? 'Poner la fecha real' : 'Cambiar fecha'}
          </button>
          <button className="accion accion-suave" onClick={hacer(() => eliminarLote(lote.id), 'Registro eliminado')}>
            <Eraser /> Eliminar (lo registré por error)
          </button>
        </div>
      )}
    </Hoja>
  )
}
