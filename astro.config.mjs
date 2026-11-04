// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

// En Vercel se usa su adaptador; en local / VPS el de Node.
const isVercel = !!process.env.VERCEL;

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: isVercel ? vercel() : node({ mode: 'standalone' }),
  vite: {
    ssr: {
      external: ['@libsql/client', 'libsql'],
    },
  },
});
