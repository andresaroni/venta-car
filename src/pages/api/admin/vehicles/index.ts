import type { APIRoute } from 'astro';
import { createVehicle, parseVehicleInput } from '../../../../lib/vehicles';
import { fail, json, readJson } from '../../../../lib/http';

export const POST: APIRoute = async ({ request, locals }) => {
  const { data, errors } = parseVehicleInput(await readJson(request));
  if (!data) return fail(errors);
  const id = await createVehicle(locals.user!.id, data);
  return json({ id }, 201);
};
