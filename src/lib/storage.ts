// Almacenamiento de fotos.
// - Con BLOB_READ_WRITE_TOKEN (Vercel Blob) se suben a la nube.
// - Sin token se guardan en .data/uploads y se sirven desde /uploads/...
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export const UPLOAD_DIR = path.resolve('.data/uploads');
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export const ALLOWED_IMAGE_TYPES = Object.keys(EXT);

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function saveImage(file: File): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new Error('Formato de imagen no permitido (usa JPG, PNG o WebP).');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('La imagen supera los 8 MB.');

  const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;

  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`vehicles/${name}`, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

/** Borra una imagen subida por el panel (ignora URLs externas como Unsplash). */
export async function deleteImage(url: string): Promise<void> {
  try {
    if (url.startsWith('/uploads/')) {
      const file = path.join(UPLOAD_DIR, path.basename(url));
      await unlink(file);
    } else if (useBlob() && url.includes('.blob.vercel-storage.com/')) {
      const { del } = await import('@vercel/blob');
      await del(url);
    }
  } catch {
    // Si ya no existe no pasa nada
  }
}
