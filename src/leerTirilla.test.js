// Pruebas del lector de tirillas: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpretarTirilla, totalDeTirilla } from './leerTirilla.js'

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

// Tirilla real de Surtiplaza (sistema SIESA POS), 4-oct-2026, transcrita a mano
// SIN los datos personales (cliente, cédula, tarjeta). 43 productos, total $560.524
const SURTIPLAZA = `COMPAÑIA DSIERRA S.A.S.
SURTIPLAZA NEIVA NORTE NIT: 900.397.879-0
RESPONSABLE DE IVA - RETENEDOR DE IVA
TPV : TPVS1104
Fecha : 2026/10/4 Hora: 16:57:18
FACTURA ELECTRONICA DE VENTA:
No. 04GK134340
Vendedor : (vendedor)
Condicion de Pago:1 CONTRAENTREGA
Medio De Pago:AJUSTE AL PESO Redondeo documento
Medio De Pago:TARJETA CREDITO
Cliente : (cliente)
Ref. Descripcion de Item
Cant. U.M V/r Uni. Total
1 GATORLIT MORAS PET* 620 ML
1.000 und 5200 5200*
2 SALSA BARBQ SAN JORGE *1000 GR
1.000 und 19700 19700*
3 PAN PERRO*6
1.000 und 3500 3500
4 PASAB DETODITO*165g LIMON
1.000 und 7760 7760*P
5 SCHON CERVERONI*900g ESTANDAR Z
1.000 und 22250 22250*P
6 GALL WAFER NUCITA*8und*20g
1.000 und 6250 6250*
7 MAQUINA VENUS SENSIT CUERPO GIL
1.000 und 7950 7950*
8 MAIZ SAN JORGE*3und*190g TIERNO
1.000 und 14750 14750*
9 PANI HUMEDOS PEQUENIN MANZANI 3
3.000 und 4850 14550*
10 BONYURT ALPINA*100g*4und BONY
1.000 und 14050 14050*
11 SISTEMA MAQUINA CUERPO GILLETT
1.000 und 18800 18800*
12 LISTERINE EXTRASUAVE CUIDADO T
1.000 und 33800 33800*
13 BONYURT*6und MULTISABOR
1.000 und 23375 23375*P
14 ESPARCIBLE GUSTOSITA BALANCE P
1.000 und 5700 5700*P
15 PANITOS MANZANILLA PEQUENIN*1
2.000 und 1500 3000*
16 CHOCOLATE INSTANTANEO CORONA*
2.000 und 16600 33200*
17 TORTILLA BIMBO*425g BLS
1.000 und 12650 12650*
18 AREPA SABROSITA RELLENA QUESO*
1.000 und 5750 5750
19 SALSA AJO LISTO SAN JORGE*170G
1.000 und 4550 4550*
20 MAYONEZA MAYO PARRILLA DP FRU
1.000 und 5320 5320*P
21 SALCH RANCHERA*230g
1.000 und 16300 16300*
22 SALCH RANCHERA*480g
1.000 und 25200 25200*P
23 CHORIZO LAS BRISAS*5und*400g T
1.000 und 16200 16200*
24 AREPA SABROSITA TELA *1,080GR
1.000 und 5600 5600
25 ESPUMA FACIAL LIMPIADORA KUE
1.000 und 13000 13000*
26 CARNE*kg MILANESA RES
0.790 kg 26900 21251
27 COST CERDO ESPECIAL ARMAR CERD
0.845 kg 20900 17661
28 ATUN SELETTI*80g*3und LOMO EN
2.000 und 7500 15000*
29 PONY MALTA*330ml LATA
1.000 sixp 17700 17700*
30 PAN BLANCO BIMBO 350G
1.000 pqt 5250 5250
31 QUESO ALPINA*400g MOZARELLA 25
1.000 und 19932 19932P
32 ACETAMINOFEN MK 500MG 16 TABC
1.000 und 11550 11550
33 GALL BRIDGE*30g*8und IND FRESA
1.000 und 5800 5800*P
34 PASTEL POLLO ZENU*300GR
2.000 und 11500 23000*
35 GOMAS 100*64g MULTIVITAMINAS
1.000 und 3800 3800*
36 GOMAS 100*64g COLAGENO
1.000 und 3800 3800*
37 AMBIENT LINDS TE VERDE ROSAS G
1.000 und 9850 9850*
38 GASEOSA COCA COLA*330ml LATA
2.000 und 3850 7700*
39 JABON LIQ AVENA Y MIEL BACTER
1.000 und 16720 16720*P
40 DESOD DOVE ROLLON AP ORQUIDEA
1.000 und 12720 12720*P
41 GEL DE BAÑO ARANDANOS LEIDEN *
1.000 und 9900 9900*
42 SHAMPOO ANTICASPA NUTRIT*800ML
1.000 und 18785 18785*P
43 BLS ECOLOGICA CAMBREL
1.000 und 1700 1700*
T O T A L ........ $560,524
Total de Articulos .... 43
[ DETALLE DE VALORES ]
Vta Gravada (*)...... 424,877 +
Vta Excluida ........ 94,012 +
Dscto Lista (P)...... 30,919 -
IMPUESTOS............ 72,554 +
IVA DEL 5% MERCA 21,190 1,060
IVA DEL 19% MERC 369,815 70,265
AJUSTE AL PESO Redon $24
TARJETA CREDITO $560,500
Su ahorro efectivo es. 30,919`

test('tirilla real de Surtiplaza (SIESA POS): 43 productos que suman el total', () => {
  const filas = interpretarTirilla(SURTIPLAZA, HOY)
  assert.equal(filas.length, 43)
  const suma = filas.reduce((s, f) => s + f.precio, 0)
  assert.equal(suma, 560524)
  assert.equal(totalDeTirilla(SURTIPLAZA), 560524)
})

test('SIESA con ruido real del OCR (foto de la tirilla de Surtiplaza)', () => {
  // Renglones tal como los leyó Tesseract de la foto (de baja resolución)
  const texto = `'       GATORLIT MORAS PET 620 ML
000 ung          5200         $700
2       SALSA BARBQ SAN JORGE 1000 GR
1.000 und         19700        1900»
6 GALL WAFER NUCITA 8und 20g
; 1.000 ung    6250   62504
9 PANI HUMEDOS PEQUENIN MANZANI 3
1.000 umd   4850    14550*`
  assert.deepEqual(resumen(texto), [
    ['Gatorlit moras pet 620 ml', 1, 5200],
    ['Salsa barbq san jorge 1000 gr', 1, 19700],
    ['Gall wafer nucita 8und 20g', 1, 6250],
    ['Pani humedos pequenin manzani', 3, 14550],
  ])
})

test('varias fotos que se traslapan no duplican productos', () => {
  const foto1 = `1 LECHE ENTERA ALPINA   4.590 A
2 ARROZ DIANA 5000G    21.900 E
3 PAN TAJADO BIMBO      6.500 A`
  const foto2 = `3 PAN TAJADO BIMBO      6.500 A
4 QUESO CAMPESINO      12.400 E
TOTAL                  45.390`
  assert.deepEqual(resumen(foto1 + '\n' + foto2), [
    ['Leche entera alpina', 1, 4590],
    ['Arroz diana 5000g', 1, 21900],
    ['Pan tajado bimbo', 1, 6500],
    ['Queso campesino', 1, 12400],
  ])
  assert.equal(totalDeTirilla(foto1 + '\n' + foto2), 45390)
})

test('unidades por paquete desde la tirilla de Surtiplaza', () => {
  const filas = interpretarTirilla(SURTIPLAZA, HOY)
  const por = (inicio) => filas.find((f) => f.nombre.startsWith(inicio)).porPaquete
  assert.equal(por('Bonyurt 6und'), 6)
  assert.equal(por('Pony malta'), 6) // "1.000 sixp"
  assert.equal(por('Atun seletti'), 3)
  assert.equal(por('Chorizo las brisas'), 5)
  assert.equal(por('Pan perro'), 6)
  assert.equal(por('Salsa barbq'), 1) // 1000 GR es peso, no unidades
})
