import { useEffect } from 'react'

// Panel que sube desde abajo (bottom sheet)
export default function Hoja({ abierta, onCerrar, titulo, children }) {
  useEffect(() => {
    if (!abierta) return
    const esc = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [abierta, onCerrar])

  if (!abierta) return null
  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="hoja-agarre" />
        {titulo && <h2 className="hoja-titulo">{titulo}</h2>}
        {children}
      </div>
    </div>
  )
}
