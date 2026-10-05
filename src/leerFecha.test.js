// Pruebas del intérprete de fechas: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extraerFecha } from './leerFecha.js'

const HOY = '2026-10-04'
const lee = (texto) => extraerFecha(texto, HOY)?.iso ?? null

test('formatos con día, mes y año', () => {
  assert.equal(lee('12/03/2027'), '2027-03-12')
  assert.equal(lee('12.03.27'), '2027-03-12')
  assert.equal(lee('12-03-2027'), '2027-03-12')
  assert.equal(lee('12 03 2027'), '2027-03-12')
  assert.equal(lee('2027-03-12'), '2027-03-12')
  assert.equal(lee('2027/03/12'), '2027-03-12')
})

test('formato gringo MM/DD cuando el día pasa de 12', () => {
  assert.equal(lee('03/25/2027'), '2027-03-25')
})

test('meses en letras (español e inglés)', () => {
  assert.equal(lee('12MAR27'), '2027-03-12')
  assert.equal(lee('12 MAR 2027'), '2027-03-12')
  assert.equal(lee('05-DIC-2026'), '2026-12-05')
  assert.equal(lee('15 ENE 2027'), '2027-01-15')
  assert.equal(lee('15 JAN 2027'), '2027-01-15')
  assert.equal(lee('20OCT26'), '2026-10-20')
  assert.equal(lee('AGO 12 2027'), '2027-08-12')
})

test('sin día: último día del mes', () => {
  assert.equal(lee('03/2027'), '2027-03-31')
  assert.equal(lee('V: 02/28'), '2028-02-29')
  assert.equal(lee('MAR 2027'), '2027-03-31')
  assert.equal(lee('FEB/27'), '2027-02-28')
  assert.deepEqual(extraerFecha('03/2027', HOY), { iso: '2027-03-31', exacta: false })
})

test('palabras clave antes de la fecha', () => {
  assert.equal(lee('VENCE: 12/03/27'), '2027-03-12')
  assert.equal(lee('F.V. 12/03/2027'), '2027-03-12')
  assert.equal(lee('FV:12/03/27'), '2027-03-12')
  assert.equal(lee('EXP 2027-03-12'), '2027-03-12')
  assert.equal(lee('CONSUMIR ANTES DE 12/03/2027'), '2027-03-12')
})

test('fabricación y vencimiento juntas: escoge el vencimiento', () => {
  assert.equal(lee('F.E. 01/09/2026 F.V. 01/03/2027'), '2027-03-01')
  assert.equal(lee('FAB 10/09/26 VENCE 10/12/26'), '2026-12-10')
  // Aunque el vencimiento aparezca primero
  assert.equal(lee('VENCE 10/12/26\nFAB 10/09/26'), '2026-12-10')
  // Sin palabras clave: la más lejana
  assert.equal(lee('01/09/2026 01/03/2027'), '2027-03-01')
})

test('lote y hora alrededor de la fecha', () => {
  assert.equal(lee('L2304 V:03/27'), '2027-03-31')
  assert.equal(lee('LOTE 23041 12/03/27 14:35'), '2027-03-12')
  assert.equal(lee('L:A123 12.03.27 14.35'), '2027-03-12')
})

test('confusiones típicas del OCR', () => {
  assert.equal(lee('I2/O3/2O27'), '2027-03-12')
  assert.equal(lee('l2/03/2S'), null) // se lee 12/03/2025: ya pasó hace mucho
  assert.equal(lee('1S/O5/27'), '2027-05-15')
  assert.equal(lee('VENCE 12OCT27'), '2027-10-12')
})

test('fechas pegadas solo con palabra clave', () => {
  assert.equal(lee('VENCE 12032027'), '2027-03-12')
  assert.equal(lee('VTO 120327'), '2027-03-12')
  assert.equal(lee('7702001041 120327'), null) // un código cualquiera no es fecha
})

test('descarta lo que no puede ser un vencimiento', () => {
  assert.equal(lee(''), null)
  assert.equal(lee('PRECIO 4.500'), null)
  assert.equal(lee('31/02/2027'), null) // no existe
  assert.equal(lee('12/03/2019'), null) // muy vieja
  assert.equal(lee('12/03/2045'), null) // muy lejana
  assert.equal(lee('REGISTRO SANITARIO RSAD12I345'), null)
})

test('meses escritos completos o a medias', () => {
  assert.equal(lee('10 de noviembre de 2026'), '2026-11-10')
  assert.equal(lee('10 - nov - 2026'), '2026-11-10')
  assert.equal(lee('31 marz 2027'), '2027-03-31')
  assert.equal(lee('5 SEPT 2027'), '2027-09-05')
  assert.equal(lee('marzo de 2027'), '2027-03-31')
})

test('etiquetas reales', () => {
  // Fondo de lata (tinta de puntos)
  assert.equal(lee('L 17:35 BN 6\nEXP 30ENE27'), '2027-01-30')
  // Pingüinos Marinela
  assert.equal(lee('VENCE:13/OCT/26\nLOTE: 05 L2 2508 16:15 COT07'), '2026-10-13')
  // Lo que leyó Tesseract de verdad: un cero en vez de la O de OCT
  assert.equal(lee('VENCE:13/0CT/26 TE: 05 L2 2508 16:15 COT'), '2026-10-13')
  assert.equal(lee('12 N0V 2026'), '2026-11-12')
  // Lata con tinta de puntos: el día (30, con cero tachado) sale como "IB",
  // pero el mes y el año se rescatan y se marca para revisar el día
  assert.deepEqual(extraerFecha('L 17:35 BN 6 EXP IBENE27', HOY), { iso: '2027-01-31', exacta: false, parcial: true })
})
