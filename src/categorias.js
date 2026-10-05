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
  // Primero lo que lleva queso pero es de panadería
  ['pan', ['arepa', 'pandebono', 'almojabana', 'pan de queso']],
  ['enlatados', ['atun', 'sardina', 'enlatad', 'lata', 'van camps', 'maiz tierno', 'arveja', 'almibar']],
  ['congelados', ['empanada', 'congelad', 'nugget', 'helado', 'papa a la francesa']],
  ['quesos', ['queso', 'cuajada', 'mozzarella', 'parmesano']],
  ['embutidos', ['salchich', 'chorizo', 'jamon', 'mortadela', 'butifarra', 'tocineta', 'morcilla', 'longaniza', 'peperoni', 'pepperoni']],
  ['lacteos', ['leche', 'yogur', 'yourt', 'yout', 'yurt', 'kumis', 'mantequilla', 'arequipe', 'alpinito', 'avena alpina']],
  ['huevos', ['huevo']],
  ['carnes', ['pollo', 'pechuga', 'carne', 'res ', 'cerdo', 'pescado', 'tilapia', 'costilla', 'molida', 'chuleta', 'mojarra']],
  ['aceites', ['salsa', 'aceite', 'mayonesa', 'ketchup', 'mostaza', 'vinagre', 'bbq']],
  ['pan', ['pan ', 'arepa', 'tortilla', 'tostada', 'calado', 'mogolla', 'croissant', 'pinguino', 'ponque', 'brownie']],
  ['condimentos', ['sal ', 'azucar', 'panela', 'caldo', 'comino', 'oregano', 'pimienta', 'canela', 'triguisar', 'adobo']],
  ['granos', ['arroz', 'frijol', 'lenteja', 'garbanzo']],
  ['pastas', ['pasta', 'espagueti', 'spaghetti', 'macarron', 'harina', 'fideo']],
  ['cereales', ['cereal', 'galleta', 'avena', 'granola', 'corn flakes', 'zucaritas']],
  ['bebidas', ['jugo', 'gaseosa', 'coca', 'cafe ', 'agua ', 'refresco', 'cerveza', 'milo', 'chocolate de mesa']],
  ['mecato', ['chocolate', 'chocolatina', 'papas ', 'dulce', 'gomita', 'mani ', 'bombon', 'chicle']],
  ['frutas', ['banano', 'manzana', 'naranja', 'mandarina', 'mango', 'pina ', 'fresa', 'mora ', 'uva', 'papaya', 'guayaba', 'limon', 'aguacate', 'pera ', 'lulo', 'maracuya']],
  ['verduras', ['tomate', 'cebolla', 'papa ', 'zanahoria', 'lechuga', 'pimenton', 'cilantro', 'ajo ', 'yuca', 'platano', 'repollo', 'brocoli', 'pepino', 'ahuyama']],
  ['aseo', ['jabon', 'detergente', 'shampoo', 'champu', 'papel higienico', 'cloro', 'suavizante', 'crema dental', 'desodorante', 'lavaloza', 'servilleta']],
]

export function adivinarCategoria(nombre) {
  const t = ' ' + nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ') + ' '
  for (const [id, raices] of REGLAS_NOMBRE) {
    if (raices.some((r) => t.includes(r.endsWith(' ') ? ' ' + r : r))) return id
  }
  return 'otros'
}
