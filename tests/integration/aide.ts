// Préparation d'une base de test vierge. Garde-fou : la base doit se terminer par « _test »,
// car son schéma public est entièrement supprimé avant chaque fichier de tests.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

export const URL_TEST = process.env.DATABASE_URL_TEST;
export const baseDisponible = !!URL_TEST;

export function configurerEnvironnementTest() {
  if (!URL_TEST) return;
  const nomBase = new URL(URL_TEST).pathname.slice(1);
  if (!nomBase.endsWith('_test')) throw new Error(`Refus : la base de test doit se terminer par « _test » (reçu : ${nomBase})`);
  process.env.DATABASE_URL = URL_TEST;
  process.env.BETTER_AUTH_SECRET ??= 'secret-de-test-uniquement-0123456789abcdef';
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
  delete process.env.RESEND_API_KEY;
}

export async function reinitialiserBase() {
  const client = postgres(URL_TEST!, { max: 1, onnotice: () => {} });
  await client.unsafe('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
  await client.end();
}
