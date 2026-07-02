// Gera os ícones PNG do PWA a partir do logo da marca (SVG).
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const MARK = `
  <g transform="translate(53 66) scale(0.596)" fill="#ffffff">
    <path d="M125.7,209.62c-12.86,0-25.72-4.9-35.51-14.69l-57.3-57.3,55.78-55.78,92.82,92.82-20.26,20.26c-9.79,9.79-22.65,14.69-35.51,14.69ZM73.87,137.63l36.81,36.81c8.21,8.21,21.51,8.28,29.81.23l-51.83-51.83-14.79,14.79Z" />
    <path d="M195.79,160.36l-92.81-92.81,15.2-15.2c2.92-2.92,7.67-2.92,10.59,0l87.52,87.52-20.49,20.49Z" />
    <path d="M230.75,125.39l-89.85-89.85c-3.77-3.77-8.74-6.21-14.05-6.52-6.16-.37-12.01,1.86-16.33,6.18L20.49,125.23,0,104.74,89.46,15.29C99.16,5.58,112.31-.13,126.04,0c13.23.13,25.65,5.34,35.02,14.71l90.19,90.19-20.49,20.49Z" />
  </g>`;

// Ícone padrão: quadrado com cantos arredondados (marca centralizada).
const rounded = `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" rx="56" fill="#2a63c9"/>${MARK}</svg>`;

// Maskable: quadrado cheio (bleed), marca menor dentro da zona segura.
const maskable = `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" fill="#2a63c9"/>
  <g transform="translate(68 78) scale(0.47)" fill="#ffffff">
    <path d="M125.7,209.62c-12.86,0-25.72-4.9-35.51-14.69l-57.3-57.3,55.78-55.78,92.82,92.82-20.26,20.26c-9.79,9.79-22.65,14.69-35.51,14.69ZM73.87,137.63l36.81,36.81c8.21,8.21,21.51,8.28,29.81.23l-51.83-51.83-14.79,14.79Z" />
    <path d="M195.79,160.36l-92.81-92.81,15.2-15.2c2.92-2.92,7.67-2.92,10.59,0l87.52,87.52-20.49,20.49Z" />
    <path d="M230.75,125.39l-89.85-89.85c-3.77-3.77-8.74-6.21-14.05-6.52-6.16-.37-12.01,1.86-16.33,6.18L20.49,125.23,0,104.74,89.46,15.29C99.16,5.58,112.31-.13,126.04,0c13.23.13,25.65,5.34,35.02,14.71l90.19,90.19-20.49,20.49Z" />
  </g></svg>`;

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 512 }).resize(size, size).png();

await mkdir("public", { recursive: true });
await png(rounded, 192).toFile("public/icon-192x192.png");
await png(rounded, 512).toFile("public/icon-512x512.png");
await png(maskable, 512).toFile("public/icon-maskable-512x512.png");
await png(rounded, 180).toFile("src/app/apple-icon.png");
console.log("ícones gerados");
