import type { APIRoute } from 'astro';
import { canManage, deleteVehicle, getVehicle, parseVehicleInput, updateVehicle } from '../../../../../lib/vehicles';
import { fail, idParam, json, readJson } from '../../../../../lib/http';

async function load(params: Record<string, string | undefined>, locals: App.Locals) {
  const id = idParam(params.id);
  const vehicle = id ? await getVehicle(id) : null;
  if (!vehicle) return { error: fail('El vehículo no existe.', 404) };
  if (!canManage(locals.user!, vehicle)) return { error: fail('No puedes modificar este vehículo.', 403) };
  return { vehicle };
}

export const PUT: APIRoute = async ({ params, locals, request }) => {
  const { vehicle, error } = await load(params, locals);
  if (error) return error;
  if (vehicle.status === 'sold') return fail('Un vehículo vendido no se puede editar.');
  const { data, errors } = parseVehicleInput(await readJson(request));
  if (!data) return fail(errors);
  await updateVehicle(vehicle, data);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { vehicle, error } = await load(params, locals);
  if (error) return error;
  await deleteVehicle(vehicle);
  return json({ ok: true });
};
