// Run once: node scripts/generate-icons.mjs
// Requires: pnpm add -D sharp (already available as Next.js dep)
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = resolve(__dirname, '../public/icons/icon.svg')
const svg = readFileSync(src)

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  await sharp(svg).resize(size, size).png().toFile(resolve(__dirname, `../public/icons/icon-${size}.png`))
  console.log(`icon-${size}.png`)
}

// Maskable versions (same but we'd add padding in a real project)
await sharp(svg).resize(192, 192).png().toFile(resolve(__dirname, '../public/icons/icon-maskable-192.png'))
await sharp(svg).resize(512, 512).png().toFile(resolve(__dirname, '../public/icons/icon-maskable-512.png'))
await sharp(svg).resize(72, 72).png().toFile(resolve(__dirname, '../public/icons/badge-72.png'))
console.log('Done.')
