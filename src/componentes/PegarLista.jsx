import { useState } from 'react'
import { ClipboardPaste, Check, ArrowLeft } from 'lucide-react'
import { interpretarLista } from '../pegarLista'
import { CATEGORIAS, categoria } from '../categorias'
import { guardarProducto, agregarLote } from '../db'
import { hoyISO, textoVence } from '../fechas'
import { avisar } from './Aviso'

const EJEMPLO = `Queso en lonchas 10 - nov - 2026
Pan tajado 20 oct 2026
Leche 12/10/26
Atún`

// Registrar un mercado completo pegando una lista escrita (WhatsApp, notas…)
export default function PegarLista({ productos, onListo, onCancelar }) {
  const [texto, setTexto] = useState('')
  const [filas, setFilas] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const pegarDelPortapapeles = async () => {
    try {
      setTexto(await navigator.clipboard.readText())
    } catch {
      avisar('Mantén presionado el cuadro y elige "Pegar"')
    }
  }

  const revisar = () => setFilas(interpretarLista(texto, hoyISO(), productos))

  const cambiar = (clave, campo, valor) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor, ...(campo === 'vence' && { estimada: false, aviso: null, advertencia: false }) } : f)))

  const incluidas = filas?.filter((f) => f.incluir && f.nombre.trim() && f.vence) ?? []

  const guardar = async () => {
    setGuardando(true)
    try {
      const creados = new Map() // mismo nombre en varios renglones → un solo producto
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
          precio: null,
          ubicacion: categoria(f.categoria).ubicacion,
        })
      }
      avisar(`✔ ${incluidas.length} productos guardados`)
      onListo()
    } finally {
      setGuardando(false)
    }
  }

  if (!filas) {
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
          <button className="boton crece" disabled={!texto.trim()} onClick={revisar}>Revisar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="pila">
      <header className="encabezado">
        <h1>Revisa antes de guardar</h1>
        <p className="nota">Encontré {filas.length} productos. Corrige lo que haga falta.</p>
      </header>

      <div className="revision">
        {filas.map((f) => (
          <div key={f.clave} className={`revision-fila ${f.incluir ? '' : 'excluida'}`}>
            <div className="fila">
              <input
                type="checkbox"
                className="revision-check"
                checked={f.incluir}
                onChange={(e) => cambiar(f.clave, 'incluir', e.target.checked)}
                aria-label={`Incluir ${f.nombre}`}
              />
              <input
                className="crece"
                value={f.nombre}
                onChange={(e) => cambiar(f.clave, 'nombre', e.target.value)}
                aria-label="Producto"
              />
              <input
                className="revision-cantidad"
                type="number"
                min="1"
                inputMode="numeric"
                value={f.cantidad}
                onChange={(e) => cambiar(f.clave, 'cantidad', Math.max(1, Number(e.target.value) || 1))}
                aria-label="Cantidad"
              />
            </div>
            <div className="fila">
              <select
                className="crece"
                value={f.categoria}
                onChange={(e) => cambiar(f.clave, 'categoria', e.target.value)}
                aria-label="Categoría"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>
                ))}
              </select>
              <input
                className="crece"
                type="date"
                value={f.vence}
                onChange={(e) => cambiar(f.clave, 'vence', e.target.value)}
                aria-label="Vence"
              />
            </div>
            <p className={`revision-nota ${f.advertencia ? 'alerta' : ''}`}>
              {f.aviso ? `${f.advertencia ? '⚠️' : 'ℹ️'} ${f.aviso} · ` : ''}
              {f.vence && textoVence(f.vence)}
            </p>
          </div>
        ))}
      </div>

      <div className="fila barra-acciones">
        <button className="boton boton-secundario" onClick={() => setFilas(null)}>
          <ArrowLeft size={18} /> Texto
        </button>
        <button className="boton crece" disabled={!incluidas.length || guardando} onClick={guardar}>
          <Check /> Guardar {incluidas.length} productos
        </button>
      </div>
    </div>
  )
}
