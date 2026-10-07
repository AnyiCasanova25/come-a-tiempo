import { useMemo, useState } from 'react'
import { Mic, Check, ArrowLeft, X } from 'lucide-react'
import { useLotesActivos, agruparEnCasa } from '../consultas'
import { interpretarGastos } from '../leerGastos'
import { descontarProducto } from '../db'
import { categoria } from '../categorias'
import { hoyISO, fechaCorta } from '../fechas'
import { avisar } from '../componentes/Aviso'

const EJEMPLO = `3 quesitos, 2 ponis
se acabó la mantequilla
boté 2 yogures`

// "¿Qué gastaron?": se escribe, se dicta o se pega (lista de WhatsApp) y se descuenta
export default function Gastos({ ir }) {
  const lotes = useLotesActivos()
  const enCasa = useMemo(() => agruparEnCasa(lotes), [lotes])
  const [texto, setTexto] = useState('')
  const [filas, setFilas] = useState(null)
  const [guardando, setGuardando] = useState(false)

  if (!lotes) return null

  const revisar = () =>
    setFilas(interpretarGastos(texto, enCasa, hoyISO()).map((f, i) => ({ ...f, clave: `${i}-${f.texto}` })))

  const cambiar = (clave, cambios) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)))
  const quitar = (clave) => setFilas((fs) => fs.filter((f) => f.clave !== clave))

  if (!filas) {
    return (
      <div className="pagina">
        <header className="encabezado">
          <h1>¿Qué gastaron?</h1>
          <p className="nota">
            Escribe lo que se gastó, como lo dirías: “3 quesitos, 2 ponis”, “se acabó la mantequilla”,
            “boté 2 yogures”. También puedes pegar tu lista de WhatsApp con sus fechas.
          </p>
        </header>
        <textarea
          className="area-texto"
          rows={8}
          placeholder={EJEMPLO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus
        />
        <p className="nota consejo-microfono">
          <Mic size={16} /> Para dictar, toca el micrófono del teclado del celular.
        </p>
        <div className="fila">
          <button className="boton boton-secundario" onClick={() => ir('inicio')}>Cancelar</button>
          <button className="boton crece" disabled={!texto.trim()} onClick={revisar}>Revisar</button>
        </div>
      </div>
    )
  }

  // Cómo queda cada producto después de todos los descuentos (en orden)
  const restantes = new Map(enCasa.map((p) => [p.id, p.stock]))
  const resultado = filas.map((f) => {
    if (!f.productoId) return { antes: null, despues: null }
    const antes = restantes.get(f.productoId) ?? 0
    const despues = +(antes - f.cantidad).toFixed(2)
    restantes.set(f.productoId, Math.max(0, despues))
    return { antes, despues }
  })
  const validas = filas.filter((f) => f.productoId && f.cantidad > 0)

  const registrar = async () => {
    setGuardando(true)
    try {
      for (const f of validas) {
        await descontarProducto(f.productoId, f.cantidad, { tipo: f.tipo, fecha: f.fecha })
      }
      avisar(`✔ ${validas.length} ${validas.length === 1 ? 'gasto registrado' : 'gastos registrados'}`)
      ir('despensa')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="pagina">
      <header className="encabezado">
        <h1>Revisa los gastos</h1>
        <p className="nota">Si algún producto no es el correcto, escógelo de la lista.</p>
      </header>

      {filas.length === 0 && <p className="nota">No entendí ningún producto. Vuelve y escríbelo de otra forma.</p>}

      <div className="revision">
        {filas.map((f, i) => {
          const { antes, despues } = resultado[i]
          const producto = enCasa.find((p) => p.id === f.productoId)
          return (
            <div key={f.clave} className={`revision-fila ${f.productoId ? '' : 'sin-producto'}`}>
              <div className="fila gasto-encabezado">
                <span className="gasto-texto">“{f.texto}”</span>
                <button className="boton-icono suave" onClick={() => quitar(f.clave)} aria-label={`Quitar ${f.texto}`}>
                  <X size={18} />
                </button>
              </div>
              <select
                value={f.productoId ?? ''}
                onChange={(e) => cambiar(f.clave, { productoId: e.target.value || null })}
                aria-label="Producto"
              >
                <option value="">— No está en la casa (no se descuenta) —</option>
                {enCasa.map((p) => (
                  <option key={p.id} value={p.id}>
                    {categoria(p.categoria).emoji} {p.nombre} ({p.stock})
                  </option>
                ))}
              </select>
              <div className="fila unidades-fila">
                <input
                  className="revision-cantidad"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={f.cantidad}
                  onChange={(e) => cambiar(f.clave, { cantidad: Math.max(0, Number(e.target.value) || 0) })}
                  aria-label="Unidades"
                />
                <select
                  className="crece"
                  value={f.tipo}
                  onChange={(e) => cambiar(f.clave, { tipo: e.target.value })}
                  aria-label="Qué pasó"
                >
                  <option value="consumo">usadas</option>
                  <option value="botado">botadas</option>
                </select>
                <input
                  className="gasto-fecha"
                  type="date"
                  max={hoyISO()}
                  value={f.fecha}
                  onChange={(e) => cambiar(f.clave, { fecha: e.target.value || hoyISO() })}
                  aria-label="Fecha"
                />
              </div>
              <p className={`revision-nota ${!f.productoId || despues < 0 ? 'alerta' : ''}`}>
                {!f.productoId
                  ? '⚠️ No lo encontré en la casa: escógelo de la lista o regístralo primero en Agregar'
                  : despues < 0
                    ? `⚠️ Solo había ${antes}: se descuenta lo que hay`
                    : `${producto?.nombre}: ${antes} → ${despues}${despues === 0 ? ' (se acaba)' : ''}${
                        f.fecha !== hoyISO() ? ` · ${fechaCorta(f.fecha)}` : ''
                      }`}
              </p>
            </div>
          )
        })}
      </div>

      <div className="fila barra-acciones">
        <button className="boton boton-secundario" onClick={() => setFilas(null)}>
          <ArrowLeft size={18} /> Texto
        </button>
        <button className="boton crece" disabled={!validas.length || guardando} onClick={registrar}>
          <Check /> Descontar {validas.length}
        </button>
      </div>
    </div>
  )
}
