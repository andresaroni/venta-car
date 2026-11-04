// Sirve las fotos guardadas localmente en .data/uploads (solo cuando no se usa Vercel Blob).
import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { UPLOAD_DIR } from '../../lib/storage';

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

export const GET: APIRoute = async ({ params }) => {
  const name = path.basename(params.path ?? '');
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!name || !type) return new Response('Not found', { status: 404 });
  try {
    const data = await readFile(path.join(UPLOAD_DIR, name));
    return new Response(data, {
      headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
