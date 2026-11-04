# Velocita — Landing + Panel administrativo

Landing de venta de autos con catálogo público (WhatsApp) y panel privado en `/admin`.
Corre en **Cloudflare Workers** con **D1** (base de datos) y **R2** (fotos).

## Desarrollo local

```sh
pnpm install
pnpm dev            # http://localhost:4321  ·  panel: http://localhost:4321/admin
```

`pnpm dev` ejecuta el sitio dentro del runtime de Cloudflare con copias locales de D1 y R2
(guardadas en `.wrangler/state`). Para empezar de cero, borra esa carpeta.

La primera vez se crea automáticamente:

- el administrador **admin / admin123**. Cámbialo en *Mi cuenta*, o crea `.dev.vars` con `ADMIN_PASSWORD=...` (ver `.dev.vars.example`).
- 5 vehículos de ejemplo. Para no cargarlos, pon `"SEED_DEMO": "false"` en `wrangler.jsonc`.

## Despliegue en Cloudflare

El proyecto se despliega como **Worker** (no hace falta un proyecto de Pages).

1. **Nombre**: `name` en `wrangler.jsonc` debe ser igual al nombre del Worker en el panel (ahora: `venta-car`).
2. **R2**: actívalo una vez en el panel (*R2 Object Storage → Get started*).
3. **Worker → Settings → Build** (conectado al repo de GitHub):
   - Build command: `pnpm run build`
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`
4. **Contraseña del admin** (antes del primer acceso): *Settings → Variables and Secrets →* agrega el secret `ADMIN_PASSWORD`.
5. Haz push a `main`. En el primer deploy, Wrangler crea solo la base D1 `venta-car-db` y el bucket R2 `venta-car-media`.

También puedes desplegar desde tu computadora con `npx wrangler login` y luego `pnpm run deploy`.

La versión de Node del build está fijada en `.node-version` (24), porque Astro 7 necesita Node ≥ 22.23.

## Roles

| | Administrador | Vendedor |
|---|---|---|
| Agregar / editar / vender / eliminar sus vehículos | ✓ | ✓ |
| Ver y gestionar los vehículos de todos | ✓ | — |
| Resumen y libro de ventas | Todo el equipo (se puede filtrar por vendedor) | Solo los suyos |
| Agregar, editar, desactivar y eliminar vendedores | ✓ | — |

- **Gastos** = precio de compra + impuestos + mecánica + repuestos + reparaciones + otros gastos.
- **Ganancia** = precio de venta − gastos. El precio final se puede negociar al registrar la venta.
- Un vehículo vendido desaparece de la página pública y queda como *Vendido* en el inventario; solo se puede eliminar.
- Las ventas guardan una copia de sus datos, así que el historial se conserva aunque se elimine el vehículo o el vendedor.

## WhatsApp

Cambia el número en `src/data/site.ts` (`whatsappNumber`: código de país + número, solo dígitos).
