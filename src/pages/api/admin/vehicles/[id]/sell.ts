import type { APIRoute } from 'astro';
import { canManage, getVehicle, parseSaleInput, sellVehicle } from '../../../../../lib/vehicles';
import { fail, idParam, json, readJson } from '../../../../../lib/http';

export const POST: APIRoute = async ({ params, locals, request }) => {
  const id = idParam(params.id);
  const vehicle = id ? await getVehicle(id) : null;
  if (!vehicle) return fail('El vehículo no existe.', 404);
  if (!canManage(locals.user!, vehicle)) return fail('No puedes vender este vehículo.', 403);
  if (vehicle.status === 'sold') return fail('Este vehículo ya fue vendido.');
  const { data, errors } = parseSaleInput(await readJson(request));
  if (!data) return fail(errors);
  await sellVehicle(vehicle, data, locals.user!);
  return json({ ok: true });
};
