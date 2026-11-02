// Applique les migrations SQL (à lancer à chaque déploiement, avant le démarrage).
// Usage : npm run db:migrer
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante');
  process.exit(1);
}
async function main(url: string) {
  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
  await client.end();
  console.log('Migrations appliquées.');
}

main(url).catch((e) => {
  console.error(e);
  process.exit(1);
});
