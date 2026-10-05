import { categoriaDesdeOFF } from './categorias'

// Open Food Facts: base libre y gratuita de productos por código de barras.
// Tiene muchos productos colombianos, pero no todos; si no está, se escribe a mano
// una sola vez y queda guardado en la base local.
const CAMPOS = 'product_name,product_name_es,generic_name_es,brands,quantity,categories_tags,image_front_small_url'

export async function buscarEnOFF(codigo) {
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=${CAMPOS}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!r.ok) return null
    const { status, product: p } = await r.json()
    if (status !== 1 || !p) return null
    const nombre = p.product_name_es || p.product_name || p.generic_name_es
    if (!nombre) return null
    // "400 g e" / "400 g ℮": la e es la marca europea de peso estimado
    const cantidad = p.quantity?.replace(/\s*℮\s*$|\s+e\s*$/i, '').trim()
    return {
      nombre: [nombre.trim(), cantidad].filter(Boolean).join(' '),
      marca: p.brands?.split(',')[0]?.trim() || '',
      categoria: categoriaDesdeOFF(p.categories_tags),
      imagen: p.image_front_small_url || null,
    }
  } catch {
    return null // sin internet o tardó demasiado
  }
}
