import type { APIRoute } from 'astro';
import { createSeller, parseUserInput } from '../../../../lib/users';
import { fail, json, readJson } from '../../../../lib/http';

export const POST: APIRoute = async ({ request }) => {
  const { data, errors } = parseUserInput(await readJson(request), true);
  if (!data) return fail(errors);
  const err = await createSeller(data);
  if (err) return fail(err, 409);
  return json({ ok: true }, 201);
};
