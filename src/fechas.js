// Fechas como texto 'AAAA-MM-DD' en hora local (sin líos de zona horaria)

export function aISO(fecha) {
  const a = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

export function deISO(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export const hoyISO = () => aISO(new Date())

export function sumarDias(iso, dias) {
  const f = deISO(iso)
  f.setDate(f.getDate() + dias)
  return aISO(f)
}

export function diasEntre(desdeISO, hastaISO) {
  return Math.round((deISO(hastaISO) - deISO(desdeISO)) / 86400000)
}

export const diasParaVencer = (venceISO) => diasEntre(hoyISO(), venceISO)

// Semáforo de vencimiento
export function nivel(venceISO, diasAviso = 3) {
  const d = diasParaVencer(venceISO)
  if (d < 0) return 'vencido'
  if (d <= diasAviso) return 'rojo'
  if (d <= 14) return 'amarillo'
  return 'verde'
}

export function textoVence(venceISO) {
  const d = diasParaVencer(venceISO)
  if (d < -1) return `Venció hace ${-d} días`
  if (d === -1) return 'Venció ayer'
  if (d === 0) return 'Vence hoy'
  if (d === 1) return 'Vence mañana'
  if (d <= 14) return `Vence en ${d} días`
  if (d <= 60) return `Vence en ${Math.round(d / 7)} semanas`
  return `Vence ${fechaCorta(venceISO)}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function fechaCorta(iso) {
  const f = deISO(iso)
  const anio = f.getFullYear() !== new Date().getFullYear() ? ` ${f.getFullYear()}` : ''
  return `${f.getDate()} ${MESES[f.getMonth()]}${anio}`
}

export const pesos = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)
