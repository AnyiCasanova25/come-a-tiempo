import { useRef, useState } from 'react'
import { Bell, Download, Upload, Users, RefreshCw, Eraser } from 'lucide-react'
import { useAjuste, DIAS_AVISO_DEFECTO } from '../consultas'
import { guardarAjuste, exportarTodo, importarTodo, hoyISO, borrarInventario } from '../db'
import Hoja from '../componentes/Hoja'
import { useLotesActivos } from '../consultas'
import { pedirPermiso, revisarYAvisar, soportaNotificaciones } from '../notificaciones'
import { avisar } from '../componentes/Aviso'

export default function Ajustes() {
  const diasAviso = useAjuste('diasAviso', DIAS_AVISO_DEFECTO)
  const [permiso, setPermiso] = useState(soportaNotificaciones() ? Notification.permission : 'no-soportado')
  const archivo = useRef(null)
  const lotes = useLotesActivos()
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [buscando, setBuscando] = useState(false)

  // Pide al navegador la versión nueva de la app y recarga si la hay
  const buscarActualizacion = async () => {
    setBuscando(true)
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      await reg?.update()
      avisar('Revisando… si hay versión nueva, la app se recarga sola')
      setTimeout(() => location.reload(), 2500)
    } catch {
      location.reload()
    } finally {
      setTimeout(() => setBuscando(false), 2500)
    }
  }

  const borrarTodo = async () => {
    await borrarInventario()
    setConfirmarBorrado(false)
    avisar('Listo: la casa está vacía. Ya puedes pegar tu lista')
  }

  const activar = async () => setPermiso(await pedirPermiso())

  const descargar = async () => {
    const datos = await exportarTodo()
    const url = URL.createObjectURL(new Blob([JSON.stringify(datos)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `come-a-tiempo-${hoyISO()}.json` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const restaurar = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      await importarTodo(JSON.parse(await f.text()))
      avisar('Respaldo restaurado')
    } catch (err) {
      avisar(err.message || 'No se pudo leer el archivo')
    }
    e.target.value = ''
  }

  return (
    <div className="pagina">
      <header className="encabezado">
        <h1>Ajustes</h1>
      </header>

      <section className="bloque">
        <h2 className="seccion-titulo"><Bell size={16} /> Alertas</h2>
        {permiso === 'granted' ? (
          <p className="nota">✅ Notificaciones activadas. Te avisamos una vez al día lo que está por vencer.</p>
        ) : permiso === 'denied' ? (
          <p className="nota">Las notificaciones están bloqueadas. Actívalas en los permisos del sitio (el candado junto a la dirección).</p>
        ) : permiso === 'no-soportado' ? (
          <p className="nota">Este navegador no permite notificaciones. En iPhone, primero instala la app en la pantalla de inicio.</p>
        ) : (
          <button className="boton" onClick={activar}>Activar notificaciones</button>
        )}
        <label className="campo">
          <span>Avisarme cuando falten</span>
          <select value={diasAviso} onChange={(e) => guardarAjuste('diasAviso', Number(e.target.value))}>
            {[1, 2, 3, 5, 7].map((d) => (
              <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'} para vencer</option>
            ))}
          </select>
        </label>
        {permiso === 'granted' && (
          <button className="boton boton-secundario" onClick={() => revisarYAvisar({ forzar: true })}>
            Probar notificación
          </button>
        )}
      </section>

      <section className="bloque">
        <h2 className="seccion-titulo"><Users size={16} /> Familia</h2>
        <p className="nota">
          Próximamente: compartir la misma despensa con tu familia, sincronizada en vivo.
          Por ahora los datos viven solo en este celular.
        </p>
      </section>

      <section className="bloque">
        <h2 className="seccion-titulo"><Download size={16} /> Respaldo</h2>
        <p className="nota">Guarda una copia de tus datos o pásalos a otro celular.</p>
        <div className="fila">
          <button className="boton boton-secundario crece" onClick={descargar}>
            <Download size={18} /> Descargar copia
          </button>
          <button className="boton boton-secundario crece" onClick={() => archivo.current.click()}>
            <Upload size={18} /> Restaurar
          </button>
          <input ref={archivo} type="file" accept="application/json" hidden onChange={restaurar} />
        </div>
      </section>

      <section className="bloque">
        <h2 className="seccion-titulo"><Eraser size={16} /> Empezar de cero</h2>
        <p className="nota">
          Borra todo lo que hay en “En casa” (y su historial de gastos), por ejemplo si algo quedó duplicado
          y prefieres volver a pegar tu lista. La lista de compras y estos ajustes no se borran.
        </p>
        <button className="boton boton-peligro" onClick={() => setConfirmarBorrado(true)} disabled={!lotes?.length}>
          <Eraser size={18} /> Borrar todo lo de la casa
        </button>
      </section>

      <section className="bloque">
        <p className="nota">
          Come a tiempo con SyA · versión <strong>{__VERSION__}</strong> · publicada el{' '}
          {new Date(__PUBLICADA__).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
        </p>
        <button className="boton boton-secundario" onClick={buscarActualizacion} disabled={buscando}>
          <RefreshCw size={18} /> Buscar actualización
        </button>
      </section>

      <Hoja abierta={confirmarBorrado} onCerrar={() => setConfirmarBorrado(false)} titulo="¿Borrar todo lo de la casa?">
        <p className="hoja-sub">
          Se borran los {lotes?.length ?? 0} registros de “En casa” y su historial. No se puede deshacer
          (si quieres, primero toca “Descargar copia” en Respaldo).
        </p>
        <div className="acciones">
          <button className="accion accion-peligro" onClick={borrarTodo}>
            <Eraser /> Sí, borrar todo
          </button>
          <button className="accion" onClick={() => setConfirmarBorrado(false)}>Cancelar</button>
        </div>
      </Hoja>
    </div>
  )
}
