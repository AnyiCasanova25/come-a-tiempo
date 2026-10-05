import { useState } from 'react'
import { Plus, Share2, X, Sparkles } from 'lucide-react'
import { useLista, useSugerencias, useProductos } from '../consultas'
import { agregarALista, marcarItem, borrarItem, limpiarComprados } from '../db'
import { categoria } from '../categorias'
import { avisar } from '../componentes/Aviso'

export default function Lista() {
  const items = useLista()
  const sugerencias = useSugerencias()
  const productos = useProductos()
  const [nuevo, setNuevo] = useState('')

  if (!items || !sugerencias) return null

  const pendientes = items.filter((i) => !i.hecho)
  const comprados = items.filter((i) => i.hecho)

  const agregar = async (e) => {
    e.preventDefault()
    const nombre = nuevo.trim()
    if (!nombre) return
    const producto = productos.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase())
    await agregarALista({ nombre, productoId: producto?.id ?? null })
    setNuevo('')
  }

  const compartir = async () => {
    const texto = '🛒 Lista de mercado\n' + pendientes.map((i) => `• ${i.nombre}`).join('\n')
    try {
      if (navigator.share) await navigator.share({ text: texto })
      else {
        await navigator.clipboard.writeText(texto)
        avisar('Lista copiada: pégala en WhatsApp')
      }
    } catch {
      // el usuario canceló el menú de compartir
    }
  }

  return (
    <div className="pagina">
      <header className="encabezado encabezado-fila">
        <h1>Lista de compras</h1>
        {pendientes.length > 0 && (
          <button className="boton-icono" onClick={compartir} aria-label="Compartir lista">
            <Share2 size={20} />
          </button>
        )}
      </header>

      <form className="fila" onSubmit={agregar}>
        <input
          list="productos-lista"
          placeholder="Agregar algo a la lista"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
        />
        <datalist id="productos-lista">
          {productos.map((p) => <option key={p.id} value={p.nombre} />)}
        </datalist>
        <button className="boton" aria-label="Agregar"><Plus /></button>
      </form>

      {sugerencias.length > 0 && (
        <section>
          <h2 className="seccion-titulo"><Sparkles size={16} /> Sugeridos</h2>
          <div className="lista-lotes">
            {sugerencias.map((s) => (
              <div key={s.producto.id} className={`sugerencia sugerencia-${s.tipo}`}>
                <span className="lote-emoji" aria-hidden>{categoria(s.producto.categoria).emoji}</span>
                <span className="lote-info">
                  <span className="lote-nombre">{s.producto.nombre}</span>
                  <span className="lote-detalle">{s.motivo}</span>
                </span>
                <button
                  className="boton-icono"
                  aria-label={`Agregar ${s.producto.nombre}`}
                  onClick={() => agregarALista({ nombre: s.producto.nombre, productoId: s.producto.id })}
                >
                  <Plus size={20} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="seccion-titulo">Por comprar <span className="contador">{pendientes.length}</span></h2>
        {pendientes.length === 0 && <p className="nota">La lista está vacía.</p>}
        <ul className="items">
          {pendientes.map((i) => (
            <Item key={i.id} item={i} />
          ))}
        </ul>
      </section>

      {comprados.length > 0 && (
        <section>
          <h2 className="seccion-titulo encabezado-fila">
            <span>Comprado <span className="contador">{comprados.length}</span></span>
            <button className="boton-texto" onClick={limpiarComprados}>Limpiar</button>
          </h2>
          <ul className="items">
            {comprados.map((i) => (
              <Item key={i.id} item={i} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Item({ item }) {
  return (
    <li className={`item ${item.hecho ? 'item-hecho' : ''}`}>
      <label>
        <input type="checkbox" checked={!!item.hecho} onChange={(e) => marcarItem(item.id, e.target.checked)} />
        <span>{item.nombre}</span>
      </label>
      <button className="boton-icono suave" onClick={() => borrarItem(item.id)} aria-label={`Quitar ${item.nombre}`}>
        <X size={18} />
      </button>
    </li>
  )
}
