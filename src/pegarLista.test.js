// Pruebas de "Pegar lista" con el primer mercado real (4-oct-2026): npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpretarLista } from './pegarLista.js'
import { adivinarCategoria } from './categorias.js'

const HOY = '2026-10-04'

const MERCADO = `Empanadas de pollo paquete 1 - 01 may - 2027

Queso en lonchas 10 - nov - 2026

Salchicha 14 - 28 oct 2026

Salchicha 7 - 17 oct 2026

Arepas - 29 oct 2026

Tortillas - 03 nov 2026

Empanadas porque 2 - 06 may 2027

Atún

Atún

Arepa queso - 13 oct 2026

Chorizo de las brisas - 07 nov 2026

Chocolate- 21 ago 2028

Salsa ajo - 16 feb 2027

Chocolate - 21 ago 2028

Salsa BBC 31 marz 2027

Mantequilla 18 ene 2027

Bong yourt mini 19 nov 2026

Bong yout grande 20 oct 2026

Salsa bar bq 29 feb 2027

Salchichón 04 nov 2026

Pan tajado 20 oct 2026

Pan perro 8 oct 2026`

test('el mercado del 4 de octubre', () => {
  const filas = interpretarLista(MERCADO, HOY)
  const resumen = Object.fromEntries(filas.map((f) => [f.nombre, [f.vence, f.categoria, f.cantidad, f.estimada]]))
  assert.deepEqual(resumen, {
    'Empanadas de pollo paquete 1': ['2027-05-01', 'congelados', 1, false],
    'Queso en lonchas': ['2026-11-10', 'quesos', 1, false],
    'Salchicha 14': ['2026-10-28', 'embutidos', 1, false],
    'Salchicha 7': ['2026-10-17', 'embutidos', 1, false],
    'Arepas': ['2026-10-29', 'pan', 1, false],
    'Tortillas': ['2026-11-03', 'pan', 1, false],
    'Empanadas porque 2': ['2027-05-06', 'congelados', 1, false],
    'Atún': ['2028-10-03', 'enlatados', 2, true],
    'Arepa queso': ['2026-10-13', 'pan', 1, false],
    'Chorizo de las brisas': ['2026-11-07', 'embutidos', 1, false],
    'Chocolate': ['2028-08-21', 'mecato', 2, false],
    'Salsa ajo': ['2027-02-16', 'aceites', 1, false],
    'Salsa bbc': ['2027-03-31', 'aceites', 1, false],
    'Mantequilla': ['2027-01-18', 'lacteos', 1, false],
    'Bong yourt mini': ['2026-11-19', 'lacteos', 1, false],
    'Bong yout grande': ['2026-10-20', 'lacteos', 1, false],
    'Salsa bar bq': [filas.find((f) => f.nombre === 'Salsa bar bq').vence, 'aceites', 1, true],
    'Salchichón': ['2026-11-04', 'embutidos', 1, false],
    'Pan tajado': ['2026-10-20', 'pan', 1, false],
    'Pan perro': ['2026-10-08', 'pan', 1, false],
  })
  // 29 de febrero de 2027 no existe: se marca para corregir
  assert.equal(filas.find((f) => f.nombre === 'Salsa bar bq').advertencia, true)
  assert.equal(filas.find((f) => f.nombre === 'Atún').aviso, 'Dura años: fecha estimada')
})

test('viñetas, mes completo y "de"', () => {
  const filas = interpretarLista('- Leche 12/10/26\n• Yogur 10 de noviembre de 2026\n3) Arroz', HOY)
  assert.deepEqual(filas.map((f) => [f.nombre, f.vence, f.estimada]), [
    ['Leche', '2026-10-12', false],
    ['Yogur', '2026-11-10', false],
    ['Arroz', '2027-10-04', true],
  ])
})

test('usa la categoría de un producto ya conocido', () => {
  const filas = interpretarLista('Arepa queso 13 oct 2026', HOY, [{ id: 'x', nombre: 'Arepa queso', categoria: 'pan' }])
  assert.equal(filas[0].categoria, 'pan')
  assert.equal(filas[0].productoId, 'x')
})

test('adivinar categoría', () => {
  assert.equal(adivinarCategoria('Pan tajado'), 'pan')
  assert.equal(adivinarCategoria('Panela'), 'condimentos')
  assert.equal(adivinarCategoria('Papas fritas'), 'mecato')
  assert.equal(adivinarCategoria('Papa pastusa'), 'verduras')
  assert.equal(adivinarCategoria('Jabón Rey'), 'aseo')
  assert.equal(adivinarCategoria('Cosa rara'), 'otros')
})

// Lo que había en la casa después de pegar el mercado del 4 de octubre
const EN_CASA = interpretarLista(MERCADO, HOY).map((f, i) => ({
  id: `p${i}`,
  nombre: f.nombre,
  categoria: f.categoria,
  porPaquete: 1,
  stock: f.cantidad,
}))
const id = (nombre) => EN_CASA.find((p) => p.nombre === nombre).id

// El mensaje del 7 de octubre, tal cual
const AJUSTES = `del bonyourt vienen 6 unidades ya gastamos 2
bonyourt mini vienen 4
mantequilla viene en tarrito entonces es una unidad es un tarro grandesito
el queso en lonchas vienen 25 lonchas ya gastamos 5
salchicha x7 vienen 7 ya gastamos 4
salchicha x14 vienen 14
chorizo de las brisas x5 vienen 5
pan perro vienen 6 gastamos 3
arepa queso vienen 4 gastamos 2
tortillas x 10 vienen 10
atun son dos paquetes cada uno trae 3 laticas
salsa de ajo una
salsa mayo una
salsa bar bq una
chocolate instantáneo 2 paquetes medianos ese debe durar el mes
empanadas dos paquetes cada uno vienen por 8
paquete de 6 latas de pony malta gastamos 2
coca cola en lata 3 unidades
1 paquete de papas personal de limon marca detodito sabor limon
galletas bridge paquete que vienen 8 paqueticos de galleta
jabon de manos en papeleta mediana
jabon liquido de cuerpo el tarro mediano
paquete de galletas nucita que vienen 6 unidades
costilla ahumada una bolsita  (Aproxima el tiempo limite de consumo de la carne)
carne molida libra y media(Aproxima el tiempo limite de consumo de la carne)
maiz en lata vienen 3 laticas en el paquete
pan tajado vienen 13`

test('ajustes del 7 de octubre: lo que ya estaba en la casa', () => {
  const filas = interpretarLista(AJUSTES, '2026-10-07', [], EN_CASA)
  const nombreDe = (o) => EN_CASA.find((p) => p.id === o).nombre
  const ajustes = filas
    .filter((f) => f.accion === 'actualizar')
    .map((f) => [f.objetivos.map(nombreDe).join(' + '), f.porPaquete, f.gastados])
  assert.deepEqual(ajustes, [
    ['Bong yout grande', 6, 2],
    ['Bong yourt mini', 4, 0],
    ['Mantequilla', 1, 0],
    ['Queso en lonchas', 25, 5],
    ['Salchicha 7', 7, 4],
    ['Salchicha 14', 14, 0],
    ['Chorizo de las brisas', 5, 0],
    ['Pan perro', 6, 3],
    ['Arepa queso', 4, 2],
    ['Tortillas', 10, 0],
    ['Atún', 3, 0],
    ['Salsa ajo', 1, 0],
    ['Salsa bar bq', 1, 0],
    ['Chocolate', null, 0],
    ['Empanadas de pollo paquete 1 + Empanadas porque 2', 8, 0],
    ['Pan tajado', 13, 0],
  ])
})

test('ajustes del 7 de octubre: lo que no estaba (compras nuevas)', () => {
  const filas = interpretarLista(AJUSTES, '2026-10-07', [], EN_CASA)
  const nuevos = filas
    .filter((f) => f.accion === 'nuevo')
    .map((f) => [f.nombre, f.categoria, f.cantidad, f.porPaquete, f.gastados, f.vidaDias])
  assert.deepEqual(nuevos, [
    ['Salsa mayo', 'aceites', 1, 1, 0, 270],
    ['Pony malta', 'bebidas', 1, 6, 2, 180],
    ['Coca cola en lata', 'bebidas', 1, 3, 0, 180],
    ['Papas personal de limon', 'mecato', 1, 1, 0, 120],
    ['Galletas bridge', 'cereales', 1, 8, 0, 180],
    ['Jabon de manos', 'aseo', 1, 1, 0, 730],
    ['Jabon liquido de cuerpo', 'aseo', 1, 1, 0, 730],
    ['Galletas nucita', 'cereales', 1, 6, 0, 180],
    ['Costilla ahumada', 'carnes', 1, 1, 0, 10],
    ['Carne molida', 'carnes', 1, 1, 0, 2],
    ['Maiz en lata', 'enlatados', 1, 3, 0, 730],
  ])
})

// Lista combinada (fechas del 4-oct + unidades del 7-oct): se puede pegar en cualquier estado
export const COMBINADA = `Empanadas de pollo paquete 1 - 01 may 2027 - vienen 8
Empanadas de pollo paquete 2 - 06 may 2027 - vienen 8
Queso en lonchas - 10 nov 2026 - vienen 25, ya gastamos 5
Salchichas de 14 - 28 oct 2026 - vienen 14
Salchichas de 7 - 17 oct 2026 - vienen 7, ya gastamos 4
Arepas - 29 oct 2026
Arepa de queso - 13 oct 2026 - vienen 4, ya gastamos 2
Tortillas - 03 nov 2026 - vienen 10
Chorizo de las brisas - 07 nov 2026 - vienen 5
Chocolate instantáneo - 21 ago 2028 - 2 paquetes
Salsa de ajo - 16 feb 2027 - una
Salsa mayonesa - 31 mar 2027 - una
Salsa bar bq - una
Mantequilla - 18 ene 2027 - un tarro
Bonyurt mini - 19 nov 2026 - vienen 4
Bonyurt grande - 20 oct 2026 - vienen 6, ya gastamos 2
Salchichón - 04 nov 2026
Pan tajado - 20 oct 2026 - vienen 13
Pan perro - 08 oct 2026 - vienen 6, ya gastamos 3
Atún - son dos paquetes, cada uno trae 3 laticas
Maíz en lata - vienen 3 laticas
Pony malta six pack - ya gastamos 2
Coca cola en lata - 3 unidades
Papas personal de limón Detodito - 1 paquete
Galletas Bridge - vienen 8 paqueticos
Galletas Nucita - vienen 6 unidades
Jabón de manos - una
Jabón líquido de cuerpo - un tarro
Costilla ahumada - una bolsita
Carne molida - libra y media`

test('combinada en una casa vacía: todo es compra nueva', () => {
  const filas = interpretarLista(COMBINADA, '2026-10-07')
  assert.ok(filas.every((f) => f.accion === 'nuevo'))
  const r = filas.map((f) => [f.nombre, f.cantidad * f.porPaquete, f.gastados, f.estimada ? '~' : f.vence])
  assert.deepEqual(r, [
    ['Empanadas de pollo paquete 1', 8, 0, '2027-05-01'],
    ['Empanadas de pollo paquete 2', 8, 0, '2027-05-06'],
    ['Queso en lonchas', 25, 5, '2026-11-10'],
    ['Salchichas de 14', 14, 0, '2026-10-28'],
    ['Salchichas de 7', 7, 4, '2026-10-17'],
    ['Arepas', 1, 0, '2026-10-29'],
    ['Arepa de queso', 4, 2, '2026-10-13'],
    ['Tortillas', 10, 0, '2026-11-03'],
    ['Chorizo de las brisas', 5, 0, '2026-11-07'],
    ['Chocolate instantáneo', 2, 0, '2028-08-21'],
    ['Salsa de ajo', 1, 0, '2027-02-16'],
    ['Salsa mayonesa', 1, 0, '2027-03-31'],
    ['Salsa bar bq', 1, 0, '~'],
    ['Mantequilla', 1, 0, '2027-01-18'],
    ['Bonyurt mini', 4, 0, '2026-11-19'],
    ['Bonyurt grande', 6, 2, '2026-10-20'],
    ['Salchichón', 1, 0, '2026-11-04'],
    ['Pan tajado', 13, 0, '2026-10-20'],
    ['Pan perro', 6, 3, '2026-10-08'],
    ['Atún', 6, 0, '~'],
    ['Maíz en lata', 3, 0, '~'],
    ['Pony malta six pack', 6, 2, '~'],
    ['Coca cola en lata', 3, 0, '~'],
    ['Papas personal de limón detodito', 1, 0, '~'],
    ['Galletas bridge', 8, 0, '~'],
    ['Galletas nucita', 6, 0, '~'],
    ['Jabón de manos', 1, 0, '~'],
    ['Jabón líquido de cuerpo', 1, 0, '~'],
    ['Costilla ahumada', 1, 0, '~'],
    ['Carne molida', 1, 0, '~'],
  ])
})

test('combinada sobre lo pegado el 4-oct: lo que ya estaba se ajusta, sin duplicar', () => {
  const casa = interpretarLista(MERCADO, '2026-10-04').map((f, i) => ({
    id: `p${i}`, nombre: f.nombre, categoria: f.categoria, porPaquete: 1,
    stock: f.cantidad, inicial: f.cantidad, vences: [f.vence], ultimaCompra: '2026-10-04',
  }))
  const filas = interpretarLista(COMBINADA, '2026-10-07', [], casa)
  const nombreDe = (o) => casa.find((p) => p.id === o).nombre
  const ajustes = filas.filter((f) => f.accion === 'actualizar').map((f) => `${f.nombre} → ${f.objetivos.map(nombreDe).join(' + ')}`)
  assert.deepEqual(ajustes, [
    'Empanadas de pollo paquete 1 → Empanadas de pollo paquete 1',
    'Empanadas de pollo paquete 2 → Empanadas porque 2',
    'Queso en lonchas → Queso en lonchas',
    'Salchichas de 14 → Salchicha 14',
    'Salchichas de 7 → Salchicha 7',
    'Arepas → Arepas',
    'Arepa de queso → Arepa queso',
    'Tortillas → Tortillas',
    'Chorizo de las brisas → Chorizo de las brisas',
    'Chocolate instantáneo → Chocolate',
    'Salsa de ajo → Salsa ajo',
    'Salsa mayonesa → Salsa bbc',
    'Salsa bar bq → Salsa bar bq',
    'Mantequilla → Mantequilla',
    'Bonyurt mini → Bong yourt mini',
    'Bonyurt grande → Bong yout grande',
    'Salchichón → Salchichón',
    'Pan tajado → Pan tajado',
    'Pan perro → Pan perro',
    'Atún → Atún',
  ])
  assert.deepEqual(filas.filter((f) => f.accion === 'nuevo').map((f) => f.nombre), [
    'Maíz en lata', 'Pony malta six pack', 'Coca cola en lata', 'Papas personal de limón detodito', 'Galletas bridge',
    'Galletas nucita', 'Jabón de manos', 'Jabón líquido de cuerpo', 'Costilla ahumada', 'Carne molida',
  ])
})

test('"en el congelador": dura meses', () => {
  const [carne, costilla] = interpretarLista('Carne molida - libra y media - en el congelador\nCostilla ahumada congelada', '2026-10-04')
  assert.deepEqual([carne.nombre, carne.ubicacion, carne.vence], ['Carne molida', 'congelador', '2027-02-01'])
  assert.deepEqual([costilla.nombre, costilla.ubicacion, costilla.vence], ['Costilla ahumada', 'congelador', '2026-12-03'])
  assert.match(carne.aviso, /congelador dura ~4 meses/)
})
