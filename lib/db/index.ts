// Connexion PostgreSQL (postgres.js + Drizzle). Usage serveur uniquement.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Réutilisation de la connexion entre rechargements à chaud en développement.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres>; db?: Db };

function createDb(): Db {
  const client = globalForDb.pgClient ?? postgres(env().DATABASE_URL, { max: 10 });
  if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client;
  return drizzle(client, { schema, casing: 'snake_case' });
}

/** Instance Drizzle, créée à la première utilisation (le build n'exige pas de base). */
export function getDb(): Db {
  if (!globalForDb.db) globalForDb.db = createDb();
  return globalForDb.db;
}

export { schema };
