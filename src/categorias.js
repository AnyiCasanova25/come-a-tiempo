// Categorías del mercado con una vida útil típica (en días) para estimar el
// vencimiento cuando no se tiene la fecha real. Son valores aproximados y
// conservadores; con cada fecha real que se registra, el producto aprende la suya.
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
  { id: 'enlatados', nombre: 'Enlatados', emoji: '🥫', dias: 730, ubicacion: 'alacena' },
  { id: 'aceites', nombre: 'Aceites y salsas', emoji: '🫒', dias: 270, ubicacion: 'alacena' },
  { id: 'condimentos', nombre: 'Condimentos', emoji: '🧂', dias: 365, ubicacion: 'alacena' },
  { id: 'cereales', nombre: 'Cereales y galletas', emoji: '🥣', dias: 180, ubicacion: 'alacena' },
  { id: 'mecato', nombre: 'Mecato y dulces', emoji: '🍫', dias: 120, ubicacion: 'alacena' },
  { id: 'bebidas', nombre: 'Bebidas', emoji: '🧃', dias: 180, ubicacion: 'alacena' },
  { id: 'congelados', nombre: 'Congelados', emoji: '🧊', dias: 90, ubicacion: 'congelador' },
  { id: 'aseo', nombre: 'Aseo y hogar', emoji: '🧴', dias: 730, ubicacion: 'alacena' },
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
