import { useEffect, useState } from 'react'
import { Home, Refrigerator, ScanBarcode, ShoppingCart, Settings } from 'lucide-react'
import Inicio from './paginas/Inicio'
import Inventario from './paginas/Inventario'
import Agregar from './paginas/Agregar'
import Lista from './paginas/Lista'
import Ajustes from './paginas/Ajustes'
import Aviso from './componentes/Aviso'
import { revisarYAvisar } from './notificaciones'

const PAGINAS = {
  inicio: { componente: Inicio, nombre: 'Inicio', icono: Home },
  despensa: { componente: Inventario, nombre: 'En casa', icono: Refrigerator },
  agregar: { componente: Agregar, nombre: 'Agregar', icono: ScanBarcode },
  lista: { componente: Lista, nombre: 'Lista', icono: ShoppingCart },
  ajustes: { componente: Ajustes, nombre: 'Ajustes', icono: Settings },
}

const desdeHash = () => {
  const p = location.hash.replace('#', '')
  return PAGINAS[p] ? p : 'inicio'
}

export default function App() {
  const [pagina, setPagina] = useState(desdeHash)

  useEffect(() => {
    const alCambiar = () => setPagina(desdeHash())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  // Cada vez que se abre (o se vuelve a) la app, revisa vencimientos (máx. 1 aviso al día)
  useEffect(() => {
    const revisar = () => document.visibilityState === 'visible' && revisarYAvisar().catch(() => {})
    revisar()
    document.addEventListener('visibilitychange', revisar)
    return () => document.removeEventListener('visibilitychange', revisar)
  }, [])

  const ir = (p) => {
    location.hash = p
    window.scrollTo(0, 0)
  }
  const Pagina = PAGINAS[pagina].componente

  return (
    <>
      <main>
        {/* key: al tocar "Agregar" otra vez, el formulario vuelve a empezar */}
        <Pagina key={pagina} ir={ir} />
      </main>
      <nav className="barra">
        {Object.entries(PAGINAS).map(([id, { nombre, icono: Icono }]) => (
          <button
            key={id}
            className={`barra-boton ${id === 'agregar' ? 'barra-principal' : ''} ${pagina === id ? 'activo' : ''}`}
            onClick={() => ir(id)}
            aria-current={pagina === id ? 'page' : undefined}
          >
            <Icono size={id === 'agregar' ? 26 : 22} />
            <span>{nombre}</span>
          </button>
        ))}
      </nav>
      <Aviso />
    </>
  )
}
