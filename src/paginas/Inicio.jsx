import { useState } from 'react'
import { ScanBarcode } from 'lucide-react'
import { useLotesActivos, useAjuste, usePerdidasMes, DIAS_AVISO_DEFECTO } from '../consultas'
import { diasParaVencer, pesos } from '../fechas'
import { FilaLote, AccionesLote } from '../componentes/Lote'

export default function Inicio({ ir }) {
  const lotes = useLotesActivos()
  const diasAviso = useAjuste('diasAviso', DIAS_AVISO_DEFECTO)
  const perdidas = usePerdidasMes()
  const [abierto, setAbierto] = useState(null)

  if (!lotes) return null

  const dias = lotes.map((l) => diasParaVencer(l.vence))
  const vencidos = dias.filter((d) => d < 0).length
  const pronto = dias.filter((d) => d >= 0 && d <= diasAviso).length
  const quincena = dias.filter((d) => d > diasAviso && d <= 14).length
  // "Úsalo pronto": lo vencido y lo que vence en las próximas 2 semanas
  const urgentes = lotes.filter((l) => diasParaVencer(l.vence) <= 14)

  const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const fecha = hoy.charAt(0).toUpperCase() + hoy.slice(1)

  return (
    <div className="pagina">
      <header className="encabezado">
        <p className="encabezado-fecha">{fecha}</p>
        <h1>Tu despensa</h1>
      </header>

      {lotes.length === 0 ? (
        <div className="vacio">
          <p className="vacio-emoji">🧺</p>
          <h2>Todavía no hay nada registrado</h2>
          <p>Cuando llegues del mercado, escanea cada producto y ponle su fecha de vencimiento.</p>
          <button className="boton boton-grande" onClick={() => ir('agregar')}>
            <ScanBarcode /> Registrar el mercado
          </button>
        </div>
      ) : (
        <>
          <section className="tarjetas">
            <div className="tarjeta tarjeta-vencido">
              <strong>{vencidos}</strong>
              <span>Vencidos</span>
            </div>
            <div className="tarjeta tarjeta-rojo">
              <strong>{pronto}</strong>
              <span>Vencen en {diasAviso} días</span>
            </div>
            <div className="tarjeta tarjeta-amarillo">
              <strong>{quincena}</strong>
              <span>En 2 semanas</span>
            </div>
            <div className="tarjeta">
              <strong>{lotes.length}</strong>
              <span>En la casa</span>
            </div>
          </section>

          {perdidas?.productos > 0 && (
            <p className="perdidas">
              {perdidas.productos === 1 ? (
                <>Este mes se botó <strong>1</strong> producto vencido</>
              ) : (
                <>Este mes se botaron <strong>{perdidas.productos}</strong> productos vencidos</>
              )}
              {perdidas.valor > 0 && <> (unos <strong>{pesos(perdidas.valor)}</strong>)</>}.
            </p>
          )}

          <section>
            <h2 className="seccion-titulo">Úsalo pronto</h2>
            {urgentes.length === 0 ? (
              <p className="nota">Nada vence en las próximas dos semanas. 👌</p>
            ) : (
              <div className="lista-lotes">
                {urgentes.map((l) => (
                  <FilaLote key={l.id} lote={l} diasAviso={diasAviso} onAbrir={setAbierto} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {abierto && <AccionesLote key={abierto.id} lote={abierto} onCerrar={() => setAbierto(null)} />}
    </div>
  )
}
