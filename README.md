# Velocita — Landing + Panel administrativo

Landing de venta de autos con catálogo público (WhatsApp) y panel privado en `/admin`.

## Desarrollo local

```sh
pnpm install
pnpm dev            # http://localhost:4321  ·  panel: http://localhost:4321/admin
```

La primera vez se crea automáticamente:

- la base de datos en `.data/velocita.db`
- el administrador **admin / admin123** (cámbialo en *Mi cuenta* o define `ADMIN_USERNAME` / `ADMIN_PASSWORD` antes del primer arranque)
- 5 vehículos de ejemplo (desactívalo con `SEED_DEMO=false`)

Para empezar de cero, borra la carpeta `.data/`.

Copia `.env.example` a `.env` si quieres cambiar algo.

## Roles

| | Administrador | Vendedor |
|---|---|---|
| Agregar / editar / vender / eliminar sus vehículos | ✓ | ✓ |
| Ver y gestionar vehículos de todos | ✓ | — |
| Resumen y libro de ventas | Todo el equipo (filtrable por vendedor) | Solo los suyos |
| Agregar, editar, desactivar y eliminar vendedores | ✓ | — |

- **Gastos** = precio de compra + impuestos + mecánica + repuestos + reparaciones + otros gastos.
- **Ganancia** = precio de venta − gastos. Al registrar la venta, el precio final se puede negociar.
- Un vehículo vendido desaparece de la página pública y queda como *Vendido* en el inventario (solo se puede eliminar).
- Las ventas guardan una copia de sus datos: si se elimina el vehículo o el vendedor, el historial y los reportes se mantienen.
- Al eliminar un vendedor, sus vehículos sin vender pasan al administrador.

## Producción en Vercel

1. **Base de datos (Turso)**: crea una base en <https://turso.tech> y añade en Vercel → Settings → Environment Variables:
   - `DATABASE_URL` = `libsql://tu-base.turso.io`
   - `DATABASE_AUTH_TOKEN` = el token de la base
2. **Fotos (Vercel Blob)**: en el proyecto de Vercel → Storage → crear *Blob*. Vercel añade `BLOB_READ_WRITE_TOKEN` solo.
3. Opcional: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `SEED_DEMO`.
4. Despliega. El adaptador de Vercel se activa automáticamente.

Sin Turso el sitio no arranca en Vercel (su disco es de solo lectura). En un servidor propio (VPS) puedes usar
`pnpm build && node dist/server/entry.mjs` con la base local en `.data/`.

## WhatsApp

Cambia el número en `src/data/site.ts` (`whatsappNumber`, código de país + número, solo dígitos).
