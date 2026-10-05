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
