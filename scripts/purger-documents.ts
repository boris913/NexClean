// Purge physique des documents supprimés depuis plus de 30 jours (M1-DOC-05).
// Tâche quotidienne : docker exec <conteneur-app> node dist-scripts/purger-documents.cjs
import { purgerDocuments } from '@/lib/dossiers/service';

purgerDocuments()
  .then((n) => console.log(`${n} document(s) purgé(s).`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
