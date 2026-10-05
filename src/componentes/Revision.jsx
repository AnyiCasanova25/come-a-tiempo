import { useState } from 'react'
import { Check, ArrowLeft, Camera, Plus } from 'lucide-react'
import { CATEGORIAS, categoria } from '../categorias'
import { guardarProducto, agregarLote } from '../db'
import { textoVence, pesos, hoyISO, sumarDias } from '../fechas'
import EscanerFecha from './EscanerFecha'
import { avisar } from './Aviso'

// Revisión de varios productos antes de guardarlos (de una lista pegada o de una tirilla).
// Cada fila: incluir, nombre, cantidad, [precio], categoría, fecha y 📷 para escanear la fecha.
export default function Revision({ titulo, subtitulo, filas, setFilas, conPrecio, totalTirilla, onVolver, onListo }) {
  const [guardando, setGuardando] = useState(false)
  const [escaneando, setEscaneando] = useState(null) // fila a la que se le escanea la fecha

  const cambiar = (clave, cambios) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)))
  const fechaReal = (vence) => ({ vence, estimada: false, aviso: null, advertencia: false })

  // Fila en blanco para un producto que el lector se saltó
  const agregarFila = () =>
    setFilas((fs) => [
      ...fs,
      {
        clave: `nueva-${Date.now()}`,
        nombre: '',
        productoId: null,
        categoria: 'otros',
        vence: sumarDias(hoyISO(), categoria('otros').dias),
        estimada: true,
        aviso: 'Escribe el nombre, el precio y la fecha',
        advertencia: false,
        cantidad: 1,
        precio: null,
        incluir: true,
      },
    ])

  const incluidas = filas.filter((f) => f.incluir && f.nombre.trim() && f.vence)

  const guardar = async () => {
    setGuardando(true)
    try {
      const creados = new Map() // mismo nombre en varias filas → un solo producto
      for (const f of incluidas) {
        const llave = f.nombre.trim().toLowerCase()
        let producto = creados.get(llave)
        if (!producto) {
          producto = await guardarProducto({
            id: f.productoId ?? undefined,
            codigo: null,
            nombre: f.nombre,
            categoria: f.categoria,
          })
          creados.set(llave, producto)
        }
        await agregarLote({
          producto,
          cantidad: f.cantidad,
          vence: f.vence,
          venceEstimada: f.estimada,
          precio: f.precio || null,
          ubicacion: categoria(f.categoria).ubicacion,
        })
      }
      avisar(`✔ ${incluidas.length} productos guardados`)
      onListo()
    } finally {
      setGuardando(false)
    }
  }

  if (escaneando) {
    return (
      <EscanerFecha
        titulo={`Fecha de vencimiento de: ${escaneando.nombre}`}
        onFecha={(fecha) => {
          cambiar(escaneando.clave, {
            ...fechaReal(fecha.iso),
            aviso: fecha.parcial ? 'No se leyó bien el día: revísalo' : '📷 Leída con la cámara',
            advertencia: !!fecha.parcial,
          })
          setEscaneando(null)
        }}
        onCerrar={() => setEscaneando(null)}
      />
    )
  }

  const total = incluidas.reduce((s, f) => s + (Number(f.precio) || 0), 0)
  // Comparación con el TOTAL impreso: si cuadra, el lector no se saltó ningún producto
  const sumaLeida = filas.reduce((s, f) => s + (Number(f.precio) || 0), 0)
  const diferencia = totalTirilla ? totalTirilla - sumaLeida : null

  return (
    <div className="pila">
      <header className="encabezado">
        <h1>{titulo}</h1>
        <p className="nota">{subtitulo}</p>
        {diferencia !== null &&
          (Math.abs(diferencia) <= 100 ? (
            <p className="cuadre cuadre-ok">✅ Cuadra con el total de la tirilla ({pesos(totalTirilla)})</p>
          ) : (
            <p className="cuadre cuadre-mal">
              ⚠️ La tirilla dice {pesos(totalTirilla)} y aquí suman {pesos(sumaLeida)}:{' '}
              {diferencia > 0
                ? `faltan ${pesos(diferencia)}. Puede que se haya saltado algún producto o un precio se leyó mal.`
                : `sobran ${pesos(-diferencia)}. Revisa los precios.`}
            </p>
          ))}
      </header>

      <div className="revision">
        {filas.map((f) => (
          <div key={f.clave} className={`revision-fila ${f.incluir ? '' : 'excluida'}`}>
            <div className="fila">
              <input
                type="checkbox"
                className="revision-check"
                checked={f.incluir}
                onChange={(e) => cambiar(f.clave, { incluir: e.target.checked })}
                aria-label={`Incluir ${f.nombre}`}
              />
              <input
                className="crece"
                value={f.nombre}
                onChange={(e) => cambiar(f.clave, { nombre: e.target.value })}
                aria-label="Producto"
              />
              <input
                className="revision-cantidad"
                type="number"
                min="1"
                inputMode="numeric"
                value={f.cantidad}
                onChange={(e) => cambiar(f.clave, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                aria-label="Cantidad"
              />
            </div>
            <div className="fila">
              <select
                className="crece"
                value={f.categoria}
                onChange={(e) => cambiar(f.clave, { categoria: e.target.value })}
                aria-label="Categoría"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>
                ))}
              </select>
              {conPrecio && (
                <input
                  className="revision-precio"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="50"
                  placeholder="$"
                  value={f.precio ?? ''}
                  onChange={(e) => cambiar(f.clave, { precio: e.target.value === '' ? null : Number(e.target.value) })}
                  aria-label="Precio"
                />
              )}
            </div>
            <div className="fila">
              <input
                className="crece"
                type="date"
                value={f.vence}
                onChange={(e) => cambiar(f.clave, fechaReal(e.target.value))}
                aria-label="Vence"
              />
              <button
                type="button"
                className="boton-icono"
                onClick={() => setEscaneando(f)}
                aria-label={`Escanear la fecha de ${f.nombre}`}
              >
                <Camera size={20} />
              </button>
            </div>
            <p className={`revision-nota ${f.advertencia ? 'alerta' : ''}`}>
              {f.aviso ? `${f.advertencia ? '⚠️' : 'ℹ️'} ${f.aviso} · ` : ''}
              {f.vence && textoVence(f.vence)}
            </p>
          </div>
        ))}
      </div>

      {conPrecio && (
        <button className="boton boton-secundario" onClick={agregarFila}>
          <Plus size={18} /> Agregar un producto que faltó
        </button>
      )}

      <div className="fila barra-acciones">
        <button className="boton boton-secundario" onClick={onVolver}>
          <ArrowLeft size={18} /> Volver
        </button>
        <button className="boton crece" disabled={!incluidas.length || guardando} onClick={guardar}>
          <Check /> Guardar {incluidas.length}
          {conPrecio && total > 0 && ` · $${total.toLocaleString('es-CO')}`}
        </button>
      </div>
    </div>
  )
}
