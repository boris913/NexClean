// POST-05 : modèles de documents PDF (Direction, Administrateur) — un modèle par type, versionné.
import Link from 'next/link';
import { exigerCollaborateur } from '@/lib/authz/session';
import { formatHorodatage } from '@/lib/audit-lecture';
import { TYPES_DOCUMENT, TYPES_DOCUMENT_CODES } from '@/lib/documents/personnalisation';
import { versionsCourantes } from '@/lib/documents/versions';
import { classeCarteLien, Pastille, TitrePage } from '@/components/backoffice/ui';
import OngletsModeles from '../OngletsModeles';

export const metadata = { title: 'Modèles de documents' };
export const dynamic = 'force-dynamic';

const DESCRIPTIONS: Record<keyof typeof TYPES_DOCUMENT, string> = {
  accuse_reception: 'Créé avec chaque dossier de recrutement, téléchargeable depuis la page de suivi.',
  devis: 'Produit et archivé par « Valider et envoyer ».',
  facture: 'Émise à l’acceptation du devis (acompte) et à la clôture (solde).',
  avoir: 'Correction d’une facture ou trop-perçu.',
  recu: 'Produit à chaque encaissement.',
  attestation: 'Pré-remplie à l’annonce d’un placement.',
};

export default async function PageModelesDocuments() {
  await exigerCollaborateur({ permission: 'modeles.gerer' });
  const versions = await versionsCourantes();
  return (
    <>
      <TitrePage titre="Modèles" />
      <OngletsModeles actif="documents" />
      <p className="text-sm text-ink-600 mb-4 max-w-3xl">
        Textes et ordre des sections des documents PDF. Chaque enregistrement crée une version ; un document déjà émis ou archivé garde la version en vigueur à sa date. Les mentions légales et les conditions générales du devis se modifient dans les Paramètres.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {TYPES_DOCUMENT_CODES.map((t) => (
          <li key={t}>
            <Link href={`/admin/modeles/documents/${t}`} className={classeCarteLien}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink-900">{TYPES_DOCUMENT[t]}</span>
                <Pastille ton={versions[t].version ? 'vert' : 'neutre'}>{versions[t].version ? `Version ${versions[t].version}` : 'Modèle d’origine'}</Pastille>
              </span>
              <span className="mt-1 block text-sm text-ink-500">{DESCRIPTIONS[t]}</span>
              {versions[t].creeLe && <span className="mt-1 block text-xs text-ink-500">Modifié le {formatHorodatage(versions[t].creeLe)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
