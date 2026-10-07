// Pruebas de "¿Qué gastaron?": npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpretarGastos, buscarProducto } from './leerGastos.js'

const HOY = '2026-10-07'
// Lo que hay en la casa (nombres como quedan de la tirilla o de la lista pegada)
const CASA = [
  { id: 'queso', nombre: 'Queso en lonchas', stock: 25, porPaquete: 25 },
  { id: 'pony', nombre: 'Pony malta 330ml lata', stock: 6, porPaquete: 6 },
  { id: 'salch', nombre: 'Salch ranchera 480g', stock: 14, porPaquete: 14 },
  { id: 'pantajado', nombre: 'Pan tajado', stock: 1, porPaquete: 1 },
  { id: 'panitos', nombre: 'Panitos manzanilla pequenin', stock: 2, porPaquete: 1 },
  { id: 'mantequilla', nombre: 'Mantequilla', stock: 1, porPaquete: 1 },
  { id: 'yogur', nombre: 'Bonyurt 6und multisabor', stock: 6, porPaquete: 6 },
  { id: 'huevos', nombre: 'Huevos AA x30', stock: 30, porPaquete: 30 },
  { id: 'arepa', nombre: 'Arepa sabrosita rellena queso', stock: 5, porPaquete: 5 },
]
const resumen = (texto) =>
  interpretarGastos(texto, CASA, HOY).map((f) => [f.productoId, f.cantidad, f.tipo, f.fecha])

test('cantidades y nombres como se dicen', () => {
  assert.deepEqual(resumen('hoy gasté 3 quesitos'), [['queso', 3, 'consumo', HOY]])
  assert.deepEqual(resumen('2 ponis'), [['pony', 2, 'consumo', HOY]])
  assert.deepEqual(resumen('dos salchichas'), [['salch', 2, 'consumo', HOY]])
  assert.deepEqual(resumen('media docena de huevos'), [['huevos', 6, 'consumo', HOY]])
  assert.deepEqual(resumen('pan tajado'), [['pantajado', 1, 'consumo', HOY]])
})

test('varios productos en un renglón', () => {
  assert.deepEqual(resumen('3 quesitos, 2 ponis y 1 pan tajado'), [
    ['queso', 3, 'consumo', HOY],
    ['pony', 2, 'consumo', HOY],
    ['pantajado', 1, 'consumo', HOY],
  ])
})

test('se acabó, boté y paquetes', () => {
  assert.deepEqual(resumen('se acabó la mantequilla'), [['mantequilla', 1, 'consumo', HOY]])
  assert.deepEqual(resumen('boté 2 yogures'), [['yogur', 2, 'botado', HOY]])
  assert.deepEqual(resumen('1 paquete de salchichas'), [['salch', 14, 'consumo', HOY]])
})

test('fechas: renglón con fecha, ayer y mensajes de WhatsApp', () => {
  assert.deepEqual(resumen('05/10\n3 quesitos\n2 ponis\n06/10\n1 pan tajado'), [
    ['queso', 3, 'consumo', '2026-10-05'],
    ['pony', 2, 'consumo', '2026-10-05'],
    ['pantajado', 1, 'consumo', '2026-10-06'],
  ])
  assert.deepEqual(resumen('ayer 2 salchichas'), [['salch', 2, 'consumo', '2026-10-06']])
  assert.deepEqual(resumen('07/10 gasté 3 quesitos'), [['queso', 3, 'consumo', '2026-10-07']])
  assert.deepEqual(
    resumen('[5/10, 8:15 p. m.] Anyi: 3 quesitos\n[6/10/26, 7:02 a. m.] Anyi: 2 ponis'),
    [
      ['queso', 3, 'consumo', '2026-10-05'],
      ['pony', 2, 'consumo', '2026-10-06'],
    ],
  )
})

test('"pan" prefiere el pan a los pañitos', () => {
  assert.equal(buscarProducto('pan', CASA)[0].id, 'pantajado')
  assert.equal(buscarProducto('panitos', CASA)[0].id, 'panitos')
  assert.equal(buscarProducto('arepa de queso', CASA)[0].id, 'arepa')
})

test('lo que no está en la casa queda sin producto', () => {
  assert.deepEqual(resumen('2 manzanas'), [[null, 2, 'consumo', HOY]])
})
