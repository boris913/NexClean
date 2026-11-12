// Tâches planifiées du Back-Office (MVP1-05, MVP2-02) : escalade des non attribués (dossiers et
// candidats), dossiers sans action, nouveaux candidats non traités, e-mails en attente.
// Toutes les 15 minutes :
//   */15 * * * * docker exec <conteneur-app> node dist-scripts/taches.cjs
import { executerTaches } from '@/lib/taches';

executerTaches()
  .then((r) => console.log(`Escalades : ${r.escalades} · dossiers sans action : ${r.sansAction} · comptes candidats supprimés : ${r.suppressionsCandidats} · candidats non attribués relancés : ${r.escaladesCandidats} · candidats non traités signalés : ${r.candidatsNonTraites} · rappels de rendez-vous : ${r.rendezVous.rappels} · rendez-vous à clôturer : ${r.rendezVous.aCloturer} · rapports hebdomadaires : ${r.rapports} · e-mails envoyés : ${r.emails}`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
