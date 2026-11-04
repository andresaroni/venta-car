import type { APIRoute } from 'astro';
import { saveImage } from '../../../lib/storage';
import { fail, json } from '../../../lib/http';

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.size) return fail('No se recibió ninguna imagen.');
    const url = await saveImage(file);
    return json({ url });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'No se pudo subir la imagen.', 500);
  }
};
