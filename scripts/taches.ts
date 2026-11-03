// Tâches planifiées du Back-Office (MVP1-05) : escalade des non attribués, dossiers sans
// action, e-mails en attente. Toutes les 15 minutes :
//   */15 * * * * docker exec <conteneur-app> node dist-scripts/taches.cjs
import { executerTaches } from '@/lib/taches';

executerTaches()
  .then((r) => console.log(`Escalades : ${r.escalades} · dossiers sans action : ${r.sansAction} · comptes candidats supprimés : ${r.suppressionsCandidats} · e-mails envoyés : ${r.emails}`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
