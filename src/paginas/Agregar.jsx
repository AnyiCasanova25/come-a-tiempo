import { useEffect, useState } from 'react'
import { ScanBarcode, PenLine, Loader2, Check, Camera, ClipboardList, ReceiptText } from 'lucide-react'
import Escaner from '../componentes/Escaner'
import EscanerFecha from '../componentes/EscanerFecha'
import PegarLista from '../componentes/PegarLista'
import Tirilla from '../componentes/Tirilla'
import { obtenerLector } from '../ocr'
import { avisar } from '../componentes/Aviso'
import { CATEGORIAS, UBICACIONES, categoria } from '../categorias'
import { useProductos } from '../consultas'
import { buscarPorCodigo, guardarProducto, agregarLote, estimarVence } from '../db'
import { buscarEnOFF } from '../openfoodfacts'
import { hoyISO, sumarDias, textoVence, fechaCorta } from '../fechas'

const ATAJOS = [
  ['3 días', 3],
  ['1 semana', 7],
  ['2 semanas', 14],
  ['1 mes', 30],
  ['3 meses', 90],
  ['6 meses', 180],
  ['1 año', 365],
]

function formularioVacio(base = {}) {
  const cat = base.categoria ?? 'otros'
  return {
    productoId: base.id ?? null,
    codigo: base.codigo ?? '',
    nombre: base.nombre ?? '',
    marca: base.marca ?? '',
    imagen: base.imagen ?? null,
    vidaUtilDias: base.vidaUtilDias,
    categoria: cat,
    cantidad: 1,
    ubicacion: categoria(cat).ubicacion,
    vence: '',
    // Enlatados y aseo duran años: por defecto no se les pide la fecha
    estimar: !!categoria(cat).sinFecha,
    precio: '',
  }
}

export default function Agregar({ ir }) {
  // paso: inicio | escaneando | buscando | fecha | formulario | pegar | tirilla
  const [paso, setPaso] = useState('inicio')
  const [fechaLeida, setFechaLeida] = useState(null) // la que leyó la cámara
  const [form, setForm] = useState(formularioVacio())
  const [origen, setOrigen] = useState(null) // de dónde salió el nombre
  const [continuo, setContinuo] = useState(true) // modo "desempacar el mercado"
  const [guardando, setGuardando] = useState(false)
  const productos = useProductos()

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  // Mientras se escanea el código, se va preparando el lector de fechas (la
  // primera vez lo descarga) para que esté listo cuando toque leer la fecha
  useEffect(() => {
    if (paso === 'escaneando') obtenerLector().catch(() => {})
  }, [paso])

  const alLeerCodigo = async (codigo) => {
    setPaso('buscando')
    const local = await buscarPorCodigo(codigo)
    const off = local ? null : await buscarEnOFF(codigo)
    const nuevo = formularioVacio(local ?? { ...off, codigo })
    setForm(nuevo)
    setOrigen(local ? 'local' : off ? 'off' : 'nuevo')
    setFechaLeida(null)
    // En modo desempacar, después del código sigue directo la fecha
    // (menos en enlatados y aseo, que duran años y se estiman)
    setPaso(continuo && !nuevo.estimar ? 'fecha' : 'formulario')
  }

  const alLeerFecha = (fecha) => {
    setForm((f) => ({ ...f, vence: fecha.iso, estimar: false }))
    setFechaLeida(fecha)
    setPaso('formulario')
  }

  const sinFecha = () => {
    setForm((f) => ({ ...f, estimar: true }))
    setFechaLeida(null)
    setPaso('formulario')
  }

  const aMano = () => {
    setForm(formularioVacio())
    setOrigen(null)
    setFechaLeida(null)
    setPaso('formulario')
  }

  // Al escribir un nombre que ya existe, se reutiliza ese producto
  const cambiarNombre = (nombre) => {
    const existente = productos.find((p) => p.nombre.toLowerCase() === nombre.trim().toLowerCase())
    if (existente && !form.codigo) {
      setForm((f) => ({
        ...formularioVacio(existente),
        cantidad: f.cantidad,
        precio: f.precio,
        vence: f.vence,
        estimar: f.estimar,
      }))
    } else {
      // Si venía de un producto elegido por nombre (sin código), deja de estar enlazado
      setForm((f) => (f.codigo ? { ...f, nombre } : { ...f, nombre, productoId: null, vidaUtilDias: undefined }))
    }
  }

  const cambiarCategoria = (cat) =>
    setForm((f) => ({
      ...f,
      categoria: cat,
      ubicacion: categoria(cat).ubicacion,
      // al pasar a enlatados/aseo se estima la fecha, salvo que ya se haya puesto una
      estimar: categoria(cat).sinFecha && !f.vence ? true : f.estimar,
    }))

  const venceSugerida = estimarVence(
    form.productoId ? { vidaUtilDias: form.vidaUtilDias } : null,
    form.categoria,
  )
  const venceFinal = form.estimar ? venceSugerida : form.vence
  const listo = form.nombre.trim() && venceFinal && Number(form.cantidad) > 0

  const guardar = async (e) => {
    e.preventDefault()
    if (!listo || guardando) return
    setGuardando(true)
    try {
      const producto = await guardarProducto({
        id: form.productoId ?? undefined,
        codigo: form.codigo || null,
        nombre: form.nombre,
        marca: form.marca,
        categoria: form.categoria,
        imagen: form.imagen,
      })
      await agregarLote({
        producto,
        cantidad: form.cantidad,
        vence: venceFinal,
        venceEstimada: form.estimar,
        precio: form.precio,
        ubicacion: form.ubicacion,
      })
      avisar(`✔ ${producto.nombre} guardado`)
      setForm(formularioVacio())
      setPaso(continuo ? 'escaneando' : 'inicio')
    } finally {
      setGuardando(false)
    }
  }

  if (paso === 'escaneando') {
    return (
      <div className="pagina">
        <Escaner onCodigo={alLeerCodigo} onCerrar={() => setPaso('inicio')} />
        <button className="boton-texto" onClick={aMano}>
          <PenLine size={18} /> No tiene código (fruta, pan, granel…)
        </button>
      </div>
    )
  }

  if (paso === 'tirilla') {
    return (
      <div className="pagina">
        <Tirilla productos={productos} onListo={() => ir('despensa')} onCancelar={() => setPaso('inicio')} />
      </div>
    )
  }

  if (paso === 'pegar') {
    return (
      <div className="pagina">
        <PegarLista productos={productos} onListo={() => ir('despensa')} onCancelar={() => setPaso('inicio')} />
      </div>
    )
  }

  if (paso === 'fecha') {
    return (
      <div className="pagina">
        <EscanerFecha
          titulo={form.nombre ? `Fecha de vencimiento de: ${form.nombre}` : 'Fecha de vencimiento'}
          onFecha={alLeerFecha}
          onSinFecha={sinFecha}
          onCerrar={() => setPaso('formulario')}
        />
      </div>
    )
  }

  if (paso === 'buscando') {
    return (
      <div className="pagina centrado">
        <Loader2 className="girando" size={40} />
        <p>Buscando el producto…</p>
      </div>
    )
  }

  if (paso === 'inicio') {
    return (
      <div className="pagina">
        <header className="encabezado">
          <h1>Registrar mercado</h1>
          <p className="nota">Producto por producto: escanea el código y ponle la fecha de vencimiento.</p>
        </header>
        <div className="pila">
          <button className="boton boton-grande" onClick={() => setPaso('escaneando')}>
            <ScanBarcode /> Escanear código de barras
          </button>
          <button className="boton boton-grande boton-secundario" onClick={() => setPaso('tirilla')}>
            <ReceiptText /> Foto de la tirilla
          </button>
          <button className="boton boton-grande boton-secundario" onClick={aMano}>
            <PenLine /> Escribir a mano
          </button>
          <button className="boton boton-grande boton-secundario" onClick={() => setPaso('pegar')}>
            <ClipboardList /> Pegar una lista (WhatsApp, notas)
          </button>
          <label className="interruptor">
            <input type="checkbox" checked={continuo} onChange={(e) => setContinuo(e.target.checked)} />
            <span>
              <strong>Modo desempacar</strong>
              <small>Al guardar un producto, la cámara se abre sola para el siguiente</small>
            </span>
          </label>
        </div>
      </div>
    )
  }

  // paso === 'formulario'
  return (
    <div className="pagina">
      <header className="encabezado">
        <h1>{form.productoId ? 'Producto conocido' : 'Nuevo producto'}</h1>
        {origen === 'off' && <p className="nota">Encontrado en Open Food Facts. Revisa el nombre.</p>}
        {origen === 'nuevo' && <p className="nota">Código {form.codigo} no encontrado: escribe el nombre una vez y queda guardado.</p>}
        {origen === 'local' && <p className="nota">Ya lo habías comprado antes.</p>}
      </header>

      <form className="pila" onSubmit={guardar}>
        <div className="producto-cabecera">
          {form.imagen && <img src={form.imagen} alt="" className="producto-foto" />}
          <label className="campo crece">
            <span>Producto</span>
            <input
              list="productos-conocidos"
              value={form.nombre}
              onChange={(e) => cambiarNombre(e.target.value)}
              placeholder="Ej: Leche entera 1 L"
              autoFocus={!form.nombre}
              required
            />
            <datalist id="productos-conocidos">
              {productos.map((p) => <option key={p.id} value={p.nombre} />)}
            </datalist>
          </label>
        </div>

        <div className="fila">
          <label className="campo crece">
            <span>Categoría</span>
            <select value={form.categoria} onChange={(e) => cambiarCategoria(e.target.value)}>
              {CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>
              ))}
            </select>
          </label>
          <label className="campo cantidad">
            <span>Cantidad</span>
            <div className="contador-campo">
              <button type="button" onClick={() => cambiar('cantidad', Math.max(1, Number(form.cantidad) - 1))}>−</button>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={form.cantidad}
                onChange={(e) => cambiar('cantidad', e.target.value)}
              />
              <button type="button" onClick={() => cambiar('cantidad', Number(form.cantidad) + 1)}>+</button>
            </div>
          </label>
        </div>

        <div className="campo">
          <span>¿Dónde lo guardas?</span>
          <div className="chips">
            {UBICACIONES.map((u) => (
              <button
                type="button"
                key={u.id}
                className={`chip ${form.ubicacion === u.id ? 'chip-activo' : ''}`}
                onClick={() => cambiar('ubicacion', u.id)}
              >
                {u.emoji} {u.nombre}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="campo vencimiento">
          <legend>Fecha de vencimiento</legend>
          {!form.estimar && (
            <>
              <button type="button" className="boton boton-secundario" onClick={() => setPaso('fecha')}>
                <Camera size={20} /> {form.vence ? 'Volver a escanear la fecha' : 'Escanear la fecha con la cámara'}
              </button>
              <input type="date" value={form.vence} min={sumarDias(hoyISO(), -30)} onChange={(e) => cambiar('vence', e.target.value)} />
              <div className="chips chips-pequenos">
                {ATAJOS.map(([texto, dias]) => (
                  <button type="button" key={dias} className="chip" onClick={() => cambiar('vence', sumarDias(hoyISO(), dias))}>
                    +{texto}
                  </button>
                ))}
              </div>
            </>
          )}
          <label className="interruptor">
            <input type="checkbox" checked={form.estimar} onChange={(e) => cambiar('estimar', e.target.checked)} />
            <span>
              <strong>No tiene fecha / no la sé</strong>
              <small>
                Se estima: {textoVence(venceSugerida).toLowerCase()}
                {form.vidaUtilDias ? ' (según tus compras anteriores)' : ` (típico de ${categoria(form.categoria).nombre.toLowerCase()})`}
              </small>
            </span>
          </label>
          {!form.estimar && form.vence && (
            <p className="nota">
              {fechaLeida?.iso === form.vence && '📷 Leída con la cámara: '}
              {textoVence(form.vence)}
              {fechaLeida?.iso === form.vence && !fechaLeida.exacta &&
                (fechaLeida.parcial
                  ? ` ⚠️ No se leyó bien el día: se tomó el ${fechaCorta(form.vence)}. Revísalo.`
                  : ` (la etiqueta solo trae mes y año: se tomó el ${fechaCorta(form.vence)})`)}
            </p>
          )}
        </fieldset>

        <label className="campo">
          <span>Precio total pagado (opcional)</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="50"
            placeholder="Ej: 4500"
            value={form.precio}
            onChange={(e) => cambiar('precio', e.target.value)}
          />
          <small className="nota">Sirve para saber cuánta plata se pierde en vencidos.</small>
        </label>

        <div className="fila">
          <button type="button" className="boton boton-secundario" onClick={() => setPaso('inicio')}>
            Cancelar
          </button>
          <button className="boton crece" disabled={!listo || guardando}>
            <Check /> Guardar
          </button>
        </div>
      </form>
    </div>
  )
}
