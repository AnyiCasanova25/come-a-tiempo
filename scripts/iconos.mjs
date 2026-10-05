// Genera los íconos PNG de la app a partir de public/favicon.svg
// Uso: node scripts/iconos.mjs
import sharp from 'sharp'

const svg = 'public/favicon.svg'
for (const tam of [192, 512]) {
  await sharp(svg).resize(tam, tam).png().toFile(`public/icono-${tam}.png`)
}
// "maskable": Android recorta el ícono en círculo, así que va con margen y fondo lleno
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#15803d' } })
  .composite([{ input: await sharp(svg).resize(400, 400).png().toBuffer(), gravity: 'center' }])
  .png()
  .toFile('public/icono-maskable.png')
console.log('Íconos generados')
