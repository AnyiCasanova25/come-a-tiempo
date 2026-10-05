import { useState } from 'react'
import { Search } from 'lucide-react'
import { useLotesActivos, useAjuste, DIAS_AVISO_DEFECTO } from '../consultas'
import { CATEGORIAS, UBICACIONES, categoria } from '../categorias'
import { FilaLote, AccionesLote } from '../componentes/Lote'

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Inventario() {
  const lotes = useLotesActivos()
  const diasAviso = useAjuste('diasAviso', DIAS_AVISO_DEFECTO)
  const [buscar, setBuscar] = useState('')
  const [ubicacion, setUbicacion] = useState('todas')
  const [abierto, setAbierto] = useState(null)

  if (!lotes) return null

  const filtro = sinTildes(buscar.trim())
  const visibles = lotes.filter(
    (l) =>
      (ubicacion === 'todas' || l.ubicacion === ubicacion) &&
      (!filtro || sinTildes(`${l.producto?.nombre} ${l.producto?.marca ?? ''}`).includes(filtro)),
  )
  const grupos = CATEGORIAS.map((c) => ({
    ...c,
    lotes: visibles.filter((l) => categoria(l.producto?.categoria).id === c.id),
  })).filter((g) => g.lotes.length)

  return (
    <div className="pagina">
      <header className="encabezado">
        <h1>En la casa</h1>
      </header>

      <label className="buscador">
        <Search size={18} />
        <input placeholder="Buscar producto" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </label>

      <div className="chips">
        {[{ id: 'todas', nombre: 'Todo', emoji: '🏠' }, ...UBICACIONES].map((u) => (
          <button
            key={u.id}
            className={`chip ${ubicacion === u.id ? 'chip-activo' : ''}`}
            onClick={() => setUbicacion(u.id)}
          >
            {u.emoji} {u.nombre}
          </button>
        ))}
      </div>

      {grupos.length === 0 && (
        <p className="nota">{lotes.length ? 'No hay productos con ese filtro.' : 'La despensa está vacía.'}</p>
      )}

      {grupos.map((g) => (
        <section key={g.id}>
          <h2 className="seccion-titulo">
            {g.emoji} {g.nombre} <span className="contador">{g.lotes.length}</span>
          </h2>
          <div className="lista-lotes">
            {g.lotes.map((l) => (
              <FilaLote key={l.id} lote={l} diasAviso={diasAviso} onAbrir={setAbierto} />
            ))}
          </div>
        </section>
      ))}

      {abierto && <AccionesLote key={abierto.id} lote={abierto} onCerrar={() => setAbierto(null)} />}
    </div>
  )
}
