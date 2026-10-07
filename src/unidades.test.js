// Pruebas de unidades por paquete: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectarPorPaquete } from './unidades.js'

test('unidades por paquete desde el nombre', () => {
  // Así vienen en la tirilla de Surtiplaza
  assert.equal(detectarPorPaquete('BONYURT*6und MULTISABOR'), 6)
  assert.equal(detectarPorPaquete('BONYURT ALPINA*100g*4und BONY'), 4)
  assert.equal(detectarPorPaquete('GALL WAFER NUCITA*8und*20g'), 8)
  assert.equal(detectarPorPaquete('ATUN SELETTI*80g*3und LOMO EN'), 3)
  assert.equal(detectarPorPaquete('CHORIZO LAS BRISAS*5und*400g T'), 5)
  assert.equal(detectarPorPaquete('PAN PERRO*6'), 6)
  assert.equal(detectarPorPaquete('ACETAMINOFEN MK 500MG 16 TABC'), 16)
  // Escrito a mano o en otras tiendas
  assert.equal(detectarPorPaquete('Huevos AA x30'), 30)
  assert.equal(detectarPorPaquete('Papel higiénico x 4'), 4)
  assert.equal(detectarPorPaquete('Pony malta six pack'), 6)
  assert.equal(detectarPorPaquete('Queso en lonchas 25 lonchas'), 25)
  assert.equal(detectarPorPaquete('Huevos media docena'), 6)
  assert.equal(detectarPorPaquete('6 x 200 ml'), 6)
})

test('pesos y volúmenes no son unidades', () => {
  assert.equal(detectarPorPaquete('SALSA BARBQ SAN JORGE *1000 GR'), null)
  assert.equal(detectarPorPaquete('GATORLIT MORAS PET* 620 ML'), null)
  assert.equal(detectarPorPaquete('TORTILLA BIMBO*425g BLS'), null)
  assert.equal(detectarPorPaquete('Leche entera 1 L'), null)
  assert.equal(detectarPorPaquete('Crema x 200 ml'), null)
  assert.equal(detectarPorPaquete('Arroz Diana 5000G'), null)
  assert.equal(detectarPorPaquete('Mantequilla'), null)
})

test('como se escribe en una lista ("vienen", "trae", "laticas")', () => {
  assert.equal(detectarPorPaquete('del bonyourt vienen 6 unidades ya gastamos 2'), 6)
  assert.equal(detectarPorPaquete('salchicha x7 vienen 7 ya gastamos 4'), 7)
  assert.equal(detectarPorPaquete('atun son dos paquetes cada uno trae 3 laticas'), 3)
  assert.equal(detectarPorPaquete('empanadas dos paquetes cada uno vienen por 8'), 8)
  assert.equal(detectarPorPaquete('galletas bridge paquete que vienen 8 paqueticos de galleta'), 8)
  assert.equal(detectarPorPaquete('paquete de 6 latas de pony malta gastamos 2'), 6)
  assert.equal(detectarPorPaquete('chocolate instantáneo 2 paquetes medianos'), null)
  assert.equal(detectarPorPaquete('mantequilla viene en tarrito entonces es una unidad'), null)
})
