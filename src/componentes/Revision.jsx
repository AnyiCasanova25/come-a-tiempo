import { useState } from 'react'
import { Check, ArrowLeft, Camera, Plus, RefreshCw } from 'lucide-react'
import { CATEGORIAS, categoria } from '../categorias'
import { guardarProducto, agregarLote, ajustarPorPaquete, descontarProducto } from '../db'
import { textoVence, pesos, hoyISO, sumarDias } from '../fechas'
import EscanerFecha from './EscanerFecha'
import { avisar } from './Aviso'

// Revisión de varios productos antes de guardarlos (de una lista pegada o de una tirilla).
// Dos clases de renglón:
//   compra nueva: nombre, paquetes × unidades, [precio], categoría, fecha (📷) y lo ya gastado
//   ajuste (accion 'actualizar'): algo que ya está en la casa → unidades por paquete y lo gastado
export default function Revision({ titulo, subtitulo, filas, setFilas, conPrecio, totalTirilla, enCasa = [], onVolver, onListo }) {
  const [guardando, setGuardando] = useState(false)
  const [escaneando, setEscaneando] = useState(null) // fila a la que se le escanea la fecha
  const [compra, setCompra] = useState(hoyISO()) // cuándo se compró lo nuevo

  const cambiar = (clave, cambios) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)))
  const fechaReal = (vence) => ({ vence, estimada: false, aviso: null, advertencia: false })

  // Al cambiar la fecha de compra, las fechas estimadas se recalculan desde ese día
  const cambiarCompra = (fecha) => {
    if (!fecha) return
    setCompra(fecha)
    setFilas((fs) => fs.map((f) => (f.estimada && f.vidaDias ? { ...f, vence: sumarDias(fecha, f.vidaDias) } : f)))
  }

  // Fila en blanco para un producto que el lector se saltó
  const agregarFila = () =>
    setFilas((fs) => [
      ...fs,
      {
        clave: `nueva-${Date.now()}`,
        accion: 'nuevo',
        nombre: '',
        productoId: null,
        categoria: 'otros',
        vence: sumarDias(compra, categoria('otros').dias),
        vidaDias: categoria('otros').dias,
        estimada: true,
        aviso: 'Escribe el nombre, el precio y la fecha',
        advertencia: false,
        cantidad: 1,
        porPaquete: 1,
        precio: null,
        incluir: true,
      },
    ])

  const esAjuste = (f) => f.accion === 'actualizar'
  const incluidas = filas.filter((f) => f.incluir && (esAjuste(f) ? f.objetivos?.length : f.nombre.trim() && f.vence))
  const hayNuevos = filas.some((f) => !esAjuste(f))

  const guardar = async () => {
    setGuardando(true)
    try {
      const creados = new Map() // mismo nombre en varias filas → un solo producto
      for (const f of incluidas) {
        if (esAjuste(f)) {
          if (f.porPaquete) for (const id of f.objetivos) await ajustarPorPaquete(id, f.porPaquete)
          if (f.gastados > 0) await descontarProducto(f.objetivos[0], f.gastados)
          continue
        }
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
          porPaquete: f.porPaquete ?? 1,
          vence: f.vence,
          venceEstimada: f.estimada,
          precio: f.precio || null,
          ubicacion: categoria(f.categoria).ubicacion,
          compradoEl: compra,
        })
        if (f.gastados > 0) await descontarProducto(producto.id, f.gastados)
      }
      avisar(`✔ ${incluidas.length} ${incluidas.length === 1 ? 'producto' : 'productos'} al día`)
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

      {hayNuevos && (
        <label className="campo">
          <span>¿Cuándo compraste lo nuevo?</span>
          <input type="date" max={hoyISO()} value={compra} onChange={(e) => cambiarCompra(e.target.value)} />
          <small className="nota">Las fechas estimadas se calculan desde ese día.</small>
        </label>
      )}

      <div className="revision">
        {filas.map((f) =>
          esAjuste(f) ? (
            <FilaAjuste key={f.clave} fila={f} enCasa={enCasa} cambiar={cambiar} />
          ) : (
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
                {enCasa.length > 0 && <span className="insignia insignia-nuevo">Nuevo</span>}
              </div>
              {/* "1 paquete de 25 unidades": el stock queda en unidades para irlas descontando */}
              <div className="fila unidades-fila">
                <input
                  className="revision-cantidad"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={f.cantidad}
                  onChange={(e) => cambiar(f.clave, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                  aria-label="Paquetes"
                />
                <span>{f.cantidad === 1 ? 'paquete' : 'paquetes'} de</span>
                <input
                  className="revision-cantidad"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={f.porPaquete ?? 1}
                  onChange={(e) => cambiar(f.clave, { porPaquete: Math.max(1, Number(e.target.value) || 1) })}
                  aria-label="Unidades por paquete"
                />
                <span>{(f.porPaquete ?? 1) === 1 ? 'unidad' : 'unidades'}</span>
              </div>
              {'gastados' in f && (
                <div className="fila unidades-fila">
                  <span>Ya gastaron</span>
                  <input
                    className="revision-cantidad"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={f.gastados}
                    onChange={(e) => cambiar(f.clave, { gastados: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label="Ya gastaron"
                  />
                  <span>· quedan {Math.max(0, f.cantidad * (f.porPaquete ?? 1) - f.gastados)}</span>
                </div>
              )}
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
          ),
        )}
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

// Ajuste de algo que ya está en la casa: "Queso en lonchas: paquete de 25, gastadas 5 → quedan 20"
function FilaAjuste({ fila: f, enCasa, cambiar }) {
  const productos = f.objetivos.map((id) => enCasa.find((p) => p.id === id)).filter(Boolean)
  // Cómo queda: las unidades actuales se pasan al nuevo tamaño de paquete y se resta lo gastado
  const resultado = productos.map((p, i) => {
    const por = f.porPaquete || p.porPaquete || 1
    const unidades = +((p.stock / (p.porPaquete || 1)) * por).toFixed(2)
    const despues = Math.max(0, +(unidades - (i === 0 ? f.gastados : 0)).toFixed(2))
    return { nombre: p.nombre, despues, de: +((p.stock / (p.porPaquete || 1)) * por).toFixed(2), por }
  })

  return (
    <div className={`revision-fila fila-ajuste ${f.incluir ? '' : 'excluida'}`}>
      <div className="fila gasto-encabezado">
        <label className="fila ajuste-titulo">
          <input
            type="checkbox"
            className="revision-check"
            checked={f.incluir}
            onChange={(e) => cambiar(f.clave, { incluir: e.target.checked })}
            aria-label={`Aplicar ${f.nombre}`}
          />
          <span>
            <RefreshCw size={14} /> Ya está en la casa: <strong>{productos.map((p) => p.nombre).join(' y ')}</strong>
          </span>
        </label>
      </div>
      <p className="gasto-texto">“{f.texto}”</p>
      <div className="fila unidades-fila">
        <span>Cada paquete trae</span>
        <input
          className="revision-cantidad"
          type="number"
          min="1"
          inputMode="numeric"
          value={f.porPaquete ?? ''}
          placeholder={String(productos[0]?.porPaquete ?? 1)}
          onChange={(e) => cambiar(f.clave, { porPaquete: e.target.value === '' ? null : Math.max(1, Number(e.target.value) || 1) })}
          aria-label="Unidades por paquete"
        />
        <span>unidades</span>
      </div>
      <div className="fila unidades-fila">
        <span>Ya gastaron</span>
        <input
          className="revision-cantidad"
          type="number"
          min="0"
          inputMode="numeric"
          value={f.gastados}
          onChange={(e) => cambiar(f.clave, { gastados: Math.max(0, Number(e.target.value) || 0) })}
          aria-label="Ya gastaron"
        />
      </div>
      <p className="revision-nota">
        {resultado.map((r) => `${r.nombre}: quedan ${r.despues} de ${r.de}`).join(' · ')}
      </p>
    </div>
  )
}
