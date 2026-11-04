// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    // No usamos <Image /> de Astro: las fotos se sirven tal cual (evita requerir Cloudflare Images).
    imageService: 'passthrough',
  }),
  // Las sesiones del panel se guardan en D1 (src/lib/auth.ts), no hace falta el KV de Astro.
  session: false,
});
