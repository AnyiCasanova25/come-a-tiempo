import { useRef, useState } from 'react'
import { Bell, Download, Upload, Users } from 'lucide-react'
import { useAjuste, DIAS_AVISO_DEFECTO } from '../consultas'
import { guardarAjuste, exportarTodo, importarTodo, hoyISO } from '../db'
import { pedirPermiso, revisarYAvisar, soportaNotificaciones } from '../notificaciones'
import { avisar } from '../componentes/Aviso'

export default function Ajustes() {
  const diasAviso = useAjuste('diasAviso', DIAS_AVISO_DEFECTO)
  const [permiso, setPermiso] = useState(soportaNotificaciones() ? Notification.permission : 'no-soportado')
  const archivo = useRef(null)

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

      <p className="nota pie">Come a tiempo con SyA · versión 0.1 (fase 1)</p>
    </div>
  )
}
