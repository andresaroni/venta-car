/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import('./lib/auth').SessionUser | null;
  }
}

// Tipos mínimos de los bindings de Cloudflare que usa el proyecto
// (los tipos completos del runtime chocan con los del navegador en los <script>).
interface D1Result<T = unknown> {
  results: T[];
  meta: { last_row_id: number; changes: number; [key: string]: unknown };
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: { contentType?: string; cacheControl?: string };
}
interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

declare module 'cloudflare:workers' {
  export const env: Cloudflare.Env;
}
