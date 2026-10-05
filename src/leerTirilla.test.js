// Pruebas del lector de tirillas: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpretarTirilla } from './leerTirilla.js'

const HOY = '2026-10-04'
const resumen = (texto) => interpretarTirilla(texto, HOY).map((f) => [f.nombre, f.cantidad, f.precio])

test('formato Éxito: índice, código, IVA, cantidad y peso abajo, descuento', () => {
  const texto = `ALMACENES EXITO S.A.
NIT 890.900.608-9
FACTURA ELECTRONICA DE VENTA POS 1234
CAJA 12  CAJERO: MARIA
PLU   DESCRIPCION              VALOR
1 7702001041 LECHE ENTERA ALPINA 1100ML   4.590 A
2 7702011011 ARROZ DIANA 5000G           21.900 E
3 7707211044 GALLETA DUCALES
   2 X 3.250                              6.500 A
4 BANANO URABA
   0,845 KG X 2.980 /KG                   2.518 E
5 7702020 PAN TAJADO BIMBO                6.500 A
DESCUENTO PROMO                          -1.000
SUBTOTAL                                 42.008
IVA 19%                                   1.200
TOTAL                                    41.008
EFECTIVO                                 50.000
CAMBIO                                    8.992
GRACIAS POR SU COMPRA`
  assert.deepEqual(resumen(texto), [
    ['Leche entera alpina 1100ml', 1, 4590],
    ['Arroz diana 5000g', 1, 21900],
    ['Galleta ducales', 2, 6500],
    ['Banano uraba', 1, 2518],
    ['Pan tajado bimbo', 1, 5500],
  ])
})

test('formato D1: cantidad al comienzo', () => {
  const texto = `TIENDAS D1 - KOBA COLOMBIA S.A.S.
CANT DESCRIPCION          VALOR
1 LECHE UHT ENTERA 1L     3.450
2 ATUN EN ACEITE 160G     7.980
1 PAPEL HIGIENICO X4      6.950
3 YOGURT FRESA 200G       5.370
TOTAL                    23.750`
  assert.deepEqual(resumen(texto), [
    ['Leche uht entera 1l', 1, 3450],
    ['Atun en aceite 160g', 2, 7980],
    ['Papel higienico x4', 1, 6950],
    ['Yogurt fresa 200g', 3, 5370],
  ])
})

test('formato Ara: código, "1 UN" y letra de IVA', () => {
  const texto = `JERONIMO MARTINS COLOMBIA
7709876543210 YOGURT FRESA 1000G 1 UN 5.290 G
7701234567890 SALCHICHA RANCHERA 2 UN 12.580 G
7700000000017 HUEVOS AA X30 1 UN 17.500 E`
  assert.deepEqual(resumen(texto), [
    ['Yogurt fresa 1000g', 1, 5290],
    ['Salchicha ranchera', 2, 12580],
    ['Huevos aa x30', 1, 17500],
  ])
})

test('ruido del OCR y repetidos', () => {
  const texto = `1 LECHE ALPINA 1L    4.59O A
2 PAN PERRO           3.200
3 LECHE ALPINA 1L     4.590 A
. . ,,
4 ~~ 12
5 SALSA BBQ $ 8.900`
  assert.deepEqual(resumen(texto), [
    ['Leche alpina 1l', 2, 9180],
    ['Pan perro', 1, 3200],
    ['Salsa bbq', 1, 8900],
  ])
})

test('categoría y fecha estimada', () => {
  const [atun, leche] = interpretarTirilla('ATUN VAN CAMPS 160G 7.980\nLECHE ENTERA 1L 4.590', HOY)
  assert.equal(atun.categoria, 'enlatados')
  assert.equal(atun.estimada, true)
  assert.equal(atun.aviso, 'Dura años: fecha estimada')
  assert.equal(leche.categoria, 'lacteos')
  assert.equal(leche.vence, '2026-10-14')
})

test('un peso en el nombre no es el precio', () => {
  // El OCR perdió el precio: "500G" no puede tomarse como $500
  assert.deepEqual(resumen('QUESO CAMPESINO 500G\nPAN TAJADO 6.500 A'), [['Pan tajado', 1, 6500]])
})

test('letra del IVA pegada al precio', () => {
  // Lo que leyó Tesseract de verdad en la prueba con foto
  const texto = `4 BANANO URABA
0,845 KG X 2.980 /KG         2.518 E
5 7702020 PAN TAJADO BIMBO        6.500A
6 7702035 QUESO CAMPESINO 500G   12.400 E`
  assert.deepEqual(resumen(texto), [
    ['Banano uraba', 1, 2518],
    ['Pan tajado bimbo', 1, 6500],
    ['Queso campesino 500g', 1, 12400],
  ])
})
