import { useEffect, useState } from 'react'

// Mensaje corto en la parte de abajo ("toast"). Se dispara desde cualquier lado con avisar()
const oyentes = new Set()

export function avisar(texto) {
  oyentes.forEach((fn) => fn(texto))
}

export default function Aviso() {
  const [texto, setTexto] = useState(null)
  useEffect(() => {
    let timer
    const fn = (t) => {
      setTexto(t)
      clearTimeout(timer)
      timer = setTimeout(() => setTexto(null), 2500)
    }
    oyentes.add(fn)
    return () => {
      oyentes.delete(fn)
      clearTimeout(timer)
    }
  }, [])
  return texto ? <div className="aviso" role="status">{texto}</div> : null
}
