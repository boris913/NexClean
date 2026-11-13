// ADR 0025 (option A) : raccordement du numéro commercial à la Cloud API, en coexistence avec
// l'application WhatsApp Business, par l'inscription intégrée de Meta.
import { desc, eq } from 'drizzle-orm';
import { exigerCollaborateur } from '@/lib/authz/session';
import { getDb, schema } from '@/lib/db';
import { env } from '@/lib/env';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Alerte, Carte, TitrePage } from '@/components/backoffice/ui';
import type { ResultatRaccordement } from '@/lib/whatsapp/inscription-meta';
import Inscription, { Resultat } from './Inscription';

export const metadata = { title: 'Raccorder un numéro WhatsApp' };
export const dynamic = 'force-dynamic';

export default async function PageRaccordement() {
  await exigerCollaborateur({ permission: 'whatsapp.raccorder' });
  const { WHATSAPP_APP_ID: appId, WHATSAPP_CONFIG_ID: configId, WHATSAPP_APP_SECRET: secret, WHATSAPP_GRAPH_VERSION: version, WHATSAPP_PHONE_NUMBER_ID: numeroActuel } = env();
  const [dernier] = await getDb()
    .select({ horodatage: schema.journalAudit.horodatage, details: schema.journalAudit.details })
    .from(schema.journalAudit)
    .where(eq(schema.journalAudit.action, 'whatsapp.raccordement'))
    .orderBy(desc(schema.journalAudit.horodatage))
    .limit(1);
  const pret = !!(appId && configId && secret);
  return (
    <div className="space-y-4">
      <TitrePage titre="Raccorder un numéro WhatsApp" description="Relie le numéro commercial au Back-Office tout en le gardant dans l’application WhatsApp Business du téléphone (coexistence)." retour={{ href: '/admin/messagerie', libelle: 'Messagerie' }} />
      <Carte titre="Avant de commencer">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-700">
          <li>Le téléphone du numéro commercial est à portée de main, avec <strong>WhatsApp Business</strong> (version 2.24.17 ou plus récente), pas WhatsApp classique.</li>
          <li>La liste des fonctions perdues dans l’application a été validée : listes de diffusion, messages éphémères, message d’accueil et d’absence, réponses rapides, étiquettes, catalogue, appels. Les appareils liés (WhatsApp Web) sont déconnectés.</li>
          <li>Le numéro reste utilisable sur le téléphone. Ouvrir l’application au moins une fois tous les 14 jours, sinon Meta coupe le raccordement.</li>
          <li>Les réponses automatiques et l’assistant virtuel s’appliqueront aux clients de ce numéro : vérifiez leurs réglages avant de changer les variables dans Coolify.</li>
          <li>Ne jamais passer par « Ajouter un numéro de téléphone » de la console Meta pour ce numéro : cela supprimerait le compte de l’application.</li>
        </ul>
      </Carte>
      {pret ? (
        <Carte titre="Inscription Meta" description="Une fenêtre Meta s’ouvre : choisissez « Connecter un compte WhatsApp Business existant », saisissez le numéro, puis confirmez sur le téléphone et acceptez le partage de l’historique.">
          <Inscription appId={appId!} configId={configId!} version={version} />
        </Carte>
      ) : (
        <Alerte type="info">Configuration incomplète : renseignez WHATSAPP_APP_ID, WHATSAPP_CONFIG_ID et WHATSAPP_APP_SECRET dans Coolify, puis redéployez (docs/exploitation.md §9).</Alerte>
      )}
      {dernier && (
        <Carte titre="Dernier raccordement" description={`Le ${formatHorodatage(dernier.horodatage)}.`}>
          <Resultat resultat={dernier.details as ResultatRaccordement} numeroActuel={numeroActuel ?? null} />
        </Carte>
      )}
    </div>
  );
}
