# Come a tiempo con SyA 🧺

App web instalable (PWA) para controlar el mercado de la casa: qué hay, cuándo vence,
qué se está acabando y qué hay que comprar. 100% gratuita: sin servidor de pago ni APIs pagas.

## Cómo correrla

```bash
npm install
npm run dev        # en el PC: http://localhost:5173
npm run movil      # en la red local con HTTPS, para probar la cámara desde el celular
npm run build      # versión final en dist/
npm run iconos     # regenera los PNG a partir de public/favicon.svg
npm test           # pruebas de los intérpretes (fechas, listas, tirillas)
```

Con `npm run movil`, en el celular (misma Wi-Fi) abrir `https://<IP-del-PC>:5173`
y aceptar la advertencia del certificado (Avanzado → Continuar). El certificado es
autofirmado, así que en ese modo la cámara funciona pero la instalación y las
notificaciones no: para eso hay que publicarla (GitHub Pages o Netlify, gratis).

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/db.js` | Base local (IndexedDB con Dexie): productos, lotes, movimientos, lista, ajustes |
| `src/consultas.js` | Consultas en vivo para las pantallas (vencimientos, sugerencias, pérdidas) |
| `src/categorias.js` | Categorías con su vida útil típica y mapeo desde Open Food Facts |
| `src/openfoodfacts.js` | Busca el nombre del producto por código de barras (base libre) |
| `src/notificaciones.js` | Alertas: al abrir la app y en segundo plano (Android) |
| `src/leerFecha.js` | Interpreta fechas de vencimiento (OCR o texto escrito) |
| `src/leerTirilla.js` | Interpreta el texto de una tirilla: productos, cantidades, precios, descuentos |
| `src/pegarLista.js` | Interpreta una lista escrita a mano ("Queso 10 nov 2026") |
| `src/ocr.js` | Lectores Tesseract (fechas en video, tirillas en foto) y limpieza de imagen |
| `public/sw-alertas.js` | Código del service worker para las alertas en segundo plano |
| `src/paginas/` | Inicio, En casa, Agregar, Lista, Ajustes |

### Modelo de datos

- **producto**: lo que se compra (nombre, código de barras, categoría, vida útil aprendida).
- **lote**: cada compra de un producto, con cantidad, fecha de vencimiento (real o estimada),
  precio y ubicación. Estados: `activo`, `agotado`, `botado`, `eliminado`.
- **movimiento**: `compra`, `consumo` o `botado`. Es la base del consumo mes a mes (fase 3).
- **lista**: lista de compras (manual o desde sugerencias).

Los ids son UUID y cada fila tiene `actualizado` para sincronizar con Supabase (fase de familia).

## Fases

1. ✅ Inventario, código de barras, carga manual, semáforo de vencimiento, alertas, lista con sugerencias.
2. ✅ Fecha de vencimiento con la cámara, "Pegar lista" (WhatsApp/notas) y foto de la tirilla
   (productos, cantidades y precios), todo con OCR gratuito en el celular (Tesseract.js).
3. ⏳ Consumo mes a mes y lista de compras automática según el ritmo de consumo.
4. ⏳ Despensa compartida con la familia (Supabase, plan gratis) y notificaciones push de servidor.
