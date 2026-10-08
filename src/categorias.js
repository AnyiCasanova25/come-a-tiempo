// Categorías del mercado con una vida útil típica (en días) para estimar el
// vencimiento cuando no se tiene la fecha real. Son valores aproximados y
// conservadores; con cada fecha real que se registra, el producto aprende la suya.
// sinFecha: duran años, así que no se pide la fecha (se estima) a menos que se quiera.
export const CATEGORIAS = [
  { id: 'lacteos', nombre: 'Lácteos', emoji: '🥛', dias: 10, ubicacion: 'nevera' },
  { id: 'quesos', nombre: 'Quesos', emoji: '🧀', dias: 20, ubicacion: 'nevera' },
  { id: 'huevos', nombre: 'Huevos', emoji: '🥚', dias: 21, ubicacion: 'nevera' },
  { id: 'carnes', nombre: 'Carnes, pollo y pescado', emoji: '🥩', dias: 3, ubicacion: 'nevera' },
  { id: 'embutidos', nombre: 'Embutidos', emoji: '🌭', dias: 15, ubicacion: 'nevera' },
  { id: 'frutas', nombre: 'Frutas', emoji: '🍎', dias: 6, ubicacion: 'nevera' },
  { id: 'verduras', nombre: 'Verduras', emoji: '🥬', dias: 7, ubicacion: 'nevera' },
  { id: 'pan', nombre: 'Panadería', emoji: '🍞', dias: 5, ubicacion: 'alacena' },
  { id: 'granos', nombre: 'Arroz y granos', emoji: '🍚', dias: 365, ubicacion: 'alacena' },
  { id: 'pastas', nombre: 'Pastas y harinas', emoji: '🍝', dias: 365, ubicacion: 'alacena' },
  { id: 'enlatados', nombre: 'Enlatados', emoji: '🥫', dias: 730, ubicacion: 'alacena', sinFecha: true },
  { id: 'aceites', nombre: 'Aceites y salsas', emoji: '🫒', dias: 270, ubicacion: 'alacena' },
  { id: 'condimentos', nombre: 'Condimentos', emoji: '🧂', dias: 365, ubicacion: 'alacena' },
  { id: 'cereales', nombre: 'Cereales y galletas', emoji: '🥣', dias: 180, ubicacion: 'alacena' },
  { id: 'mecato', nombre: 'Mecato y dulces', emoji: '🍫', dias: 120, ubicacion: 'alacena' },
  { id: 'bebidas', nombre: 'Bebidas', emoji: '🧃', dias: 180, ubicacion: 'alacena' },
  { id: 'congelados', nombre: 'Congelados', emoji: '🧊', dias: 90, ubicacion: 'congelador' },
  { id: 'aseo', nombre: 'Aseo y hogar', emoji: '🧴', dias: 730, ubicacion: 'alacena', sinFecha: true },
  { id: 'otros', nombre: 'Otros', emoji: '📦', dias: 90, ubicacion: 'alacena' },
]

export const UBICACIONES = [
  { id: 'nevera', nombre: 'Nevera', emoji: '❄️' },
  { id: 'congelador', nombre: 'Congelador', emoji: '🧊' },
  { id: 'alacena', nombre: 'Alacena', emoji: '🗄️' },
]

const porId = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]))

export const categoria = (id) => porId[id] ?? porId.otros

export function estimarVidaUtil(idCategoria) {
  return categoria(idCategoria).dias
}

// Traduce las categorías de Open Food Facts (en:dairies, en:rices...) a las nuestras.
// El orden importa: lo más específico primero.
const REGLAS_OFF = [
  ['quesos', ['cheeses']],
  ['huevos', ['eggs']],
  ['embutidos', ['sausages', 'hams', 'prepared-meats', 'cold-cuts']],
  ['carnes', ['meats', 'poultry', 'fish', 'seafood']],
  ['congelados', ['frozen']],
  ['lacteos', ['dairies', 'milks', 'yogurts', 'creams', 'butters']],
  ['pan', ['breads', 'pastries', 'bakery']],
  ['cereales', ['breakfast-cereals', 'biscuits', 'cookies', 'crackers', 'oat']],
  ['mecato', ['snacks', 'chocolates', 'candies', 'confectioneries', 'confectionary', 'chips', 'sweets', 'spreads']],
  ['enlatados', ['canned']],
  ['pastas', ['pastas', 'flours', 'noodles', 'arepa']],
  ['granos', ['rices', 'legumes', 'beans', 'lentils', 'pulses', 'cereal-grains', 'sugars']],
  ['aceites', ['oils', 'sauces', 'mayonnaises', 'ketchup', 'condiments-sauces']],
  ['condimentos', ['condiments', 'spices', 'salts', 'seasonings', 'broths']],
  ['bebidas', ['beverages', 'juices', 'sodas', 'coffees', 'teas', 'waters']],
  ['frutas', ['fruits']],
  ['verduras', ['vegetables']],
]

export function categoriaDesdeOFF(tags = []) {
  const texto = tags.join(' ')
  for (const [id, claves] of REGLAS_OFF) {
    if (claves.some((k) => texto.includes(k))) return id
  }
  return 'otros'
}

// Adivina la categoría por el nombre (para listas escritas a mano).
// Raíces sin tildes y en minúscula; gana la primera regla que coincida.
// Una raíz que termina en espacio debe ser palabra completa ("pan " no atrapa "panela").
const REGLAS_NOMBRE = [
  // Primero lo que confunde a las reglas de abajo: aseo y droguería ("jabón de avena"
  // no es cereal), arepas con queso, bebidas en lata y chocolate para tomar
  ['aseo', ['jabon', 'shampoo', 'champu', 'desod', 'listerine', 'enjuague', 'maquina', 'cuchilla', 'espuma facial',
    'gel de bano', 'gel bano', 'ambient', 'panitos', 'pani humedos', 'toallas', 'crema dental', 'cepillo dental',
    'detergente', 'suavizante', 'cloro', 'papel higienico', 'servilleta', 'lavaloza', 'bls ecologica', 'bolsa ecologica']],
  ['pan', ['arepa', 'pandebono', 'almojabana', 'pan de queso']],
  ['bebidas', ['gaseosa', 'coca cola', 'pony', 'malta', 'gatorlit', 'gatorade', 'suero', 'jugo', 'cerveza',
    'chocolate instantaneo', 'chocolate corona', 'chocolate de mesa']],
  ['enlatados', ['atun', 'sardina', 'enlatad', 'van camps', 'maiz', 'arveja', 'almibar']],
  ['congelados', ['empanada', 'pastel', 'congelad', 'nugget', 'helado', 'papa a la francesa']],
  ['quesos', ['queso', 'cuajada', 'mozzarella', 'mozarella', 'parmesano']],
  ['embutidos', ['salchich', 'salch ', 'schon', 'cerveroni', 'chorizo', 'jamon', 'mortadela', 'butifarra', 'tocineta',
    'morcilla', 'longaniza', 'peperoni', 'pepperoni']],
  ['lacteos', ['leche', 'yogur', 'yourt', 'yout', 'yurt', 'kumis', 'mantequilla', 'margarina', 'esparcible',
    'gustosita', 'arequipe', 'alpinito', 'avena alpina']],
  ['huevos', ['huevo']],
  ['carnes', ['pollo', 'pechuga', 'carne', 'res ', 'cerdo', 'pescado', 'tilapia', 'costilla', 'cost ', 'molida',
    'chuleta', 'mojarra']],
  ['aceites', ['salsa', 'aceite', 'mayonesa', 'mayonez', 'ketchup', 'mostaza', 'vinagre', 'bbq']],
  ['pan', ['pan ', 'tortilla', 'tostada', 'calado', 'mogolla', 'croissant', 'pinguino', 'ponque', 'brownie']],
  ['condimentos', ['sal ', 'azucar', 'panela', 'caldo', 'comino', 'oregano', 'pimienta', 'canela', 'triguisar', 'adobo']],
  ['granos', ['arroz', 'frijol', 'lenteja', 'garbanzo']],
  ['pastas', ['pasta', 'espagueti', 'spaghetti', 'macarron', 'harina', 'fideo']],
  ['cereales', ['cereal', 'galleta', 'gall ', 'avena', 'granola', 'corn flakes', 'zucaritas', 'wafer']],
  ['bebidas', ['coca', 'cafe ', 'agua ', 'refresco', 'milo']],
  ['mecato', ['chocolate', 'chocolatina', 'papas ', 'pasab', 'detodito', 'dulce', 'gomita', 'mani ', 'bombon', 'chicle']],
  ['frutas', ['banano', 'manzana', 'naranja', 'mandarina', 'mango', 'pina ', 'fresa', 'mora ', 'uva', 'papaya',
    'guayaba', 'limon', 'aguacate', 'pera ', 'lulo', 'maracuya']],
  ['verduras', ['tomate', 'cebolla', 'papa ', 'zanahoria', 'lechuga', 'pimenton', 'cilantro', 'ajo ', 'yuca', 'platano',
    'repollo', 'brocoli', 'pepino', 'ahuyama']],
]

export function adivinarCategoria(nombre) {
  const t = ' ' + nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ') + ' '
  for (const [id, raices] of REGLAS_NOMBRE) {
    if (raices.some((r) => t.includes(r.endsWith(' ') ? ' ' + r : r))) return id
  }
  return 'otros'
}

// Vida útil en la NEVERA de productos que duran mucho menos (o más) que su categoría.
// Para lo que se congela vale mucho más: la carne molida congelada aguanta 3-4 meses.
const VIDA_POR_NOMBRE = [
  ['carne molida', 2],
  ['molida', 2],
  ['pescado', 2],
  ['mojarra', 2],
  ['tilapia', 2],
  ['pollo', 2],
  ['pechuga', 2],
  ['ahumad', 10], // costilla/chuleta ahumada: ya viene curada
  ['costilla', 3],
  ['carne', 3],
]

/** Días que dura en la nevera según el nombre, o null si manda la categoría */
export function vidaUtilPorNombre(nombre) {
  const t = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return VIDA_POR_NOMBRE.find(([clave]) => t.includes(clave))?.[1] ?? null
}

// Vida útil en el CONGELADOR (días), según el nombre y la categoría.
// Referencia: carne molida 3-4 meses, cortes de res/cerdo 4-6, pollo 6-9, embutidos 1-2.
const CONGELADOR_POR_NOMBRE = [
  ['molida', 120],
  ['pollo', 240],
  ['pechuga', 240],
  ['pescado', 180],
  ['mojarra', 180],
  ['tilapia', 180],
  ['ahumad', 25], // costilla ahumada: la familia la gasta en menos de un mes (máx. 25 días)
]
const CONGELADOR_POR_CATEGORIA = { carnes: 150, embutidos: 60, pan: 90, congelados: 90, quesos: 120, lacteos: 60 }

export function vidaEnCongelador(nombre, idCategoria) {
  const t = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return CONGELADOR_POR_NOMBRE.find(([clave]) => t.includes(clave))?.[1] ?? CONGELADOR_POR_CATEGORIA[idCategoria] ?? 90
}
