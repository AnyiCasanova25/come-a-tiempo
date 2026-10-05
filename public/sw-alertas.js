// Se carga dentro del service worker (workbox importScripts).
// Revisa los vencimientos en segundo plano cuando Chrome lo permite
// (Android, app instalada) y abre la app al tocar la notificación.

function abrirBase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('despensa')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function leerTodo(base, tabla) {
  return new Promise((resolve, reject) => {
    if (!base.objectStoreNames.contains(tabla)) return resolve([])
    const req = base.transaction(tabla).objectStore(tabla).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function guardarAjuste(base, clave, valor) {
  return new Promise((resolve) => {
    const tx = base.transaction('ajustes', 'readwrite')
    tx.objectStore('ajustes').put({ clave, valor })
    tx.oncomplete = resolve
    tx.onerror = resolve
  })
}

function hoyISO() {
  const f = new Date()
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

function diasPara(venceISO) {
  const [a, m, d] = venceISO.split('-').map(Number)
  const [ha, hm, hd] = hoyISO().split('-').map(Number)
  return Math.round((new Date(a, m - 1, d) - new Date(ha, hm - 1, hd)) / 86400000)
}

async function revisarVencimientos() {
  const base = await abrirBase()
  const ajustes = Object.fromEntries((await leerTodo(base, 'ajustes')).map((a) => [a.clave, a.valor]))
  const hoy = hoyISO()
  if (ajustes.ultimoAviso === hoy) return

  const diasAviso = ajustes.diasAviso ?? 3
  const productos = Object.fromEntries((await leerTodo(base, 'productos')).map((p) => [p.id, p]))
  const activos = (await leerTodo(base, 'lotes')).filter((l) => l.estado === 'activo')
  const pronto = activos.filter((l) => { const d = diasPara(l.vence); return d >= 0 && d <= diasAviso })
  const vencidos = activos.filter((l) => diasPara(l.vence) < 0)
  if (!pronto.length && !vencidos.length) return

  const nombres = pronto.slice(0, 3).map((l) => productos[l.productoId]?.nombre ?? 'Producto').join(', ')
  const partes = []
  if (pronto.length) partes.push(`Por vencer: ${nombres}${pronto.length > 3 ? ` y ${pronto.length - 3} más` : ''}`)
  if (vencidos.length) partes.push(`Vencidos: ${vencidos.length}`)

  await self.registration.showNotification('🥛 Úsalo pronto', {
    body: partes.join(' · '),
    icon: 'icono-192.png',
    badge: 'icono-192.png',
    tag: 'vencimientos',
  })
  await guardarAjuste(base, 'ultimoAviso', hoy)
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'revisar-vencimientos') event.waitUntil(revisarVencimientos())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => 'focus' in v)
      return abierta ? abierta.focus() : self.clients.openWindow(self.registration.scope)
    }),
  )
})
