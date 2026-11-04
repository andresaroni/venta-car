import type { APIRoute } from 'astro';
import { deleteSeller, getUser, parseUserInput, updateUser } from '../../../../lib/users';
import { fail, idParam, json, readJson } from '../../../../lib/http';

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const id = idParam(params.id);
  const user = id ? await getUser(id) : null;
  if (!user) return fail('El usuario no existe.', 404);
  const { data, errors } = parseUserInput(await readJson(request), false);
  if (!data) return fail(errors);
  if (user.id === locals.user!.id && !data.active) return fail('No puedes desactivar tu propia cuenta.');
  const err = await updateUser(user.id, data);
  if (err) return fail(err, 409);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const id = idParam(params.id);
  const user = id ? await getUser(id) : null;
  if (!user) return fail('El usuario no existe.', 404);
  if (user.role !== 'seller') return fail('Solo se pueden eliminar vendedores.');
  await deleteSeller(user.id, locals.user!.id);
  return json({ ok: true });
};
