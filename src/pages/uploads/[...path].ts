// Sirve las fotos guardadas en R2.
import type { APIRoute } from 'astro';
import { getImage } from '../../lib/storage';

export const GET: APIRoute = async ({ params }) => {
  const name = (params.path ?? '').split('/').pop() ?? '';
  if (!/^[\w.-]+\.(jpg|png|webp|avif)$/.test(name)) return new Response('Not found', { status: 404 });
  const obj = await getImage(name);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      etag: obj.httpEtag,
    },
  });
};
