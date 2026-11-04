// Fotos de los vehículos en Cloudflare R2 (binding "MEDIA" en wrangler.jsonc).
// Se sirven desde /uploads/<nombre> (ver src/pages/uploads/[...path].ts).
import { env } from 'cloudflare:workers';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const PREFIX = 'vehicles/';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export async function saveImage(file: File): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new Error('Formato de imagen no permitido (usa JPG, PNG o WebP).');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('La imagen supera los 8 MB.');

  const id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');
  const name = `${Date.now()}-${id}.${ext}`;
  await env.MEDIA.put(PREFIX + name, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
  });
  return `/uploads/${name}`;
}

export async function getImage(name: string) {
  return env.MEDIA.get(PREFIX + name);
}

/** Borra una foto subida desde el panel (ignora URLs externas como Unsplash). */
export async function deleteImage(url: string): Promise<void> {
  if (!url.startsWith('/uploads/')) return;
  const name = url.slice('/uploads/'.length).split('/').pop();
  if (!name) return;
  try {
    await env.MEDIA.delete(PREFIX + name);
  } catch {
    // Si ya no existe no pasa nada
  }
}
