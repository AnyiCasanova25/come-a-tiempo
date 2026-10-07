import { useState } from 'react'
import { MinusCircle, PackageCheck, Trash2, CalendarDays, Eraser, Boxes, Pencil } from 'lucide-react'
import Hoja from './Hoja'
import { categoria } from '../categorias'
import { nivel, textoVence, fechaCorta } from '../fechas'
import { consumir, seAcabo, botar, eliminarLote, cambiarVence, cambiarPorPaquete, renombrarProducto } from '../db'
import { textoCantidad } from '../unidades'
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
          {textoCantidad(lote)}
          {lote.venceEstimada && ' · fecha estimada'}
        </span>
      </span>
      <span className={`etiqueta etiqueta-${n}`}>{textoVence(lote.vence)}</span>
    </button>
  )
}

// Acciones sobre un lote: descontar lo que se usó, se acabó, botar, unidades del paquete,
// corregir fecha, eliminar
export function AccionesLote({ lote, onCerrar }) {
  // modo: acciones | fecha | unidades | nombre
  const [modo, setModo] = useState('acciones')
  const [fecha, setFecha] = useState(lote?.vence ?? '')
  const [usadas, setUsadas] = useState(1)
  const [porPaquete, setPorPaquete] = useState(lote?.porPaquete > 1 ? lote.porPaquete : '')
  const [nuevoNombre, setNuevoNombre] = useState(lote?.producto?.nombre ?? '')

  if (!lote) return null
  const nombre = lote.producto?.nombre ?? 'Producto'
  const hacer = (fn, mensaje) => async () => {
    await fn()
    avisar(mensaje)
    onCerrar()
  }
  const quedan = +(lote.cantidad - usadas).toFixed(2)
  const paquetes = lote.cantidadInicial / (lote.porPaquete ?? 1)

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={nombre}>
      <p className="hoja-sub">
        {textoCantidad(lote)} · {textoVence(lote.vence)}
        {lote.venceEstimada ? ' (estimada)' : ''} · comprado el {fechaCorta(lote.compradoEl)}
      </p>

      {modo === 'fecha' && (
        <div className="pila">
          <label className="campo">
            <span>Fecha de vencimiento</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <button className="boton" disabled={!fecha} onClick={hacer(() => cambiarVence(lote.id, fecha), 'Fecha actualizada')}>
            Guardar fecha
          </button>
        </div>
      )}

      {modo === 'nombre' && (
        <div className="pila">
          <label className="campo">
            <span>Nombre del producto</span>
            <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} autoFocus />
          </label>
          <button
            className="boton"
            disabled={!nuevoNombre.trim()}
            onClick={hacer(() => renombrarProducto(lote.productoId, nuevoNombre), 'Nombre cambiado')}
          >
            Guardar nombre
          </button>
        </div>
      )}

      {modo === 'unidades' && (
        <div className="pila">
          <label className="campo">
            <span>¿Cuántas unidades trae cada paquete?</span>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              placeholder="Ej: 25"
              value={porPaquete}
              onChange={(e) => setPorPaquete(e.target.value)}
              autoFocus
            />
          </label>
          {Number(porPaquete) > 0 && (
            <p className="nota">
              Quedarán {+((lote.cantidad / (lote.porPaquete ?? 1)) * Number(porPaquete)).toFixed(2)} unidades
              {paquetes !== 1 && ` (${paquetes} paquetes)`}. La próxima vez que compres este producto lo recordará.
            </p>
          )}
          <button
            className="boton"
            disabled={!(Number(porPaquete) >= 1)}
            onClick={hacer(() => cambiarPorPaquete(lote.id, porPaquete), `${nombre}: paquete de ${porPaquete}`)}
          >
            Guardar
          </button>
        </div>
      )}

      {modo === 'acciones' && (
        <div className="acciones">
          {lote.cantidad > 1 && (
            <div className="gasto-rapido">
              <span>¿Cuántas usaron?</span>
              <div className="contador-campo">
                <button type="button" onClick={() => setUsadas((n) => Math.max(1, n - 1))} aria-label="Menos">−</button>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={usadas}
                  onChange={(e) => setUsadas(Math.max(1, Math.min(lote.cantidad, Number(e.target.value) || 1)))}
                  aria-label="Unidades usadas"
                />
                <button type="button" onClick={() => setUsadas((n) => Math.min(lote.cantidad, n + 1))} aria-label="Más">+</button>
              </div>
              <button
                className="boton"
                onClick={hacer(() => consumir(lote.id, usadas), quedan > 0 ? `Quedan ${quedan}` : `${nombre}: se acabó`)}
              >
                <MinusCircle size={18} /> Descontar · quedan {Math.max(0, quedan)}
              </button>
            </div>
          )}
          <button className="accion" onClick={hacer(() => seAcabo(lote.id), `${nombre}: se acabó`)}>
            <PackageCheck /> Se acabó
          </button>
          <button className="accion accion-peligro" onClick={hacer(() => botar(lote.id), `${nombre}: botado`)}>
            <Trash2 /> Lo boté (vencido o dañado)
          </button>
          <button className="accion" onClick={() => setModo('unidades')}>
            <Boxes />
            {lote.porPaquete > 1 ? `Paquete de ${lote.porPaquete} unidades (cambiar)` : 'El paquete trae varias unidades'}
          </button>
          <button className="accion" onClick={() => setModo('fecha')}>
            <CalendarDays /> {lote.venceEstimada ? 'Poner la fecha real' : 'Cambiar fecha'}
          </button>
          <button className="accion" onClick={() => setModo('nombre')}>
            <Pencil /> Cambiar nombre
          </button>
          <button className="accion accion-suave" onClick={hacer(() => eliminarLote(lote.id), 'Registro eliminado')}>
            <Eraser /> Eliminar (lo registré por error)
          </button>
        </div>
      )}
    </Hoja>
  )
}
