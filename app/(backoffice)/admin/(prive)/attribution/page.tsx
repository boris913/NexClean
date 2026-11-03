// MVP1-05 RG-05, RG-08, RG-09 : file « Non attribués », dossiers des absents, couverture (Direction).
import Link from 'next/link';
import { exigerCollaborateur } from '@/lib/authz/session';
import { getDb } from '@/lib/db';
import { couverturesManquantes, dossiersDesAbsents, evaluerCandidats, fileNonAttribues } from '@/lib/dossiers/attribution';
import { DOSSIER_TYPES } from '@/lib/domain/referentiels';
import { STATUTS } from '@/lib/dossiers/statuts';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Alerte, Carte, TitrePage } from '@/components/backoffice/ui';
import { Attribuer, ReaffectationMasse, type OptionReferent } from './Formulaires';

export const metadata = { title: 'Attribution' };

const trier = (l: OptionReferent[]) => [...l].sort((a, b) => a.raisons.length - b.raisons.length || a.charge - b.charge || a.nom.localeCompare(b.nom));
const option = ({ id, nom, charge, raisons }: OptionReferent): OptionReferent => ({ id, nom, charge, raisons });

export default async function PageAttribution() {
  await exigerCollaborateur({ permission: 'dossier.reaffecter' });
  const [file, absents, manquantes] = await Promise.all([fileNonAttribues(), dossiersDesAbsents(), couverturesManquantes()]);
  const options = await Promise.all(file.map(async (d) => trier((await evaluerCandidats(getDb(), d)).map(option))));
  // Réaffectation des absents : seuls l'absence et la capacité sont signalées (les dossiers sont de types et villes variés).
  const tousReferents = (await evaluerCandidats(getDb(), { type: 'NET', villeId: null })).map((c) => option({ ...c, raisons: c.raisons.filter((r) => r === 'absent' || r.startsWith('capacité')) }));
  const parAbsent = new Map<string, typeof absents>();
  for (const d of absents) parAbsent.set(d.referentId!, [...(parAbsent.get(d.referentId!) ?? []), d]);

  return (
    <>
      <TitrePage titre="Attribution" />
      {manquantes.length > 0 && (
        <div className="mb-4">
          <Alerte type="info">
            <p className="font-medium mb-1">Aucun référent n’est configuré pour :</p>
            <ul className="list-disc pl-5">
              {manquantes.map((m) => (
                <li key={`${m.type}-${m.ville}`}>
                  {DOSSIER_TYPES[m.type]} / {m.ville}
                </li>
              ))}
            </ul>
            <p className="mt-1">
              Ces demandes iront en « Non attribués ». Définissez les services et les villes des référents dans{' '}
              <Link href="/admin/collaborateurs" className="underline">
                Collaborateurs
              </Link>
              .
            </p>
          </Alerte>
        </div>
      )}

      <div className="space-y-4">
        <Carte titre={`Non attribués (${file.length})`}>
          {file.length === 0 ? (
            <p className="text-sm text-ink-600">Aucun dossier en attente de référent.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {file.map((d, i) => (
                <li key={d.id} className="py-3">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <Link href={`/admin/dossiers/${d.id}`} className="font-mono font-semibold text-primary">
                      {d.numero}
                    </Link>
                    <span className="text-xs text-ink-500">en attente depuis {formatHorodatage(d.enFileDepuis ?? d.creeLe)}</span>
                  </div>
                  <p className="text-sm text-ink-700">
                    {d.client} · {DOSSIER_TYPES[d.type]} · {d.villeNom ?? d.villeAutre ?? 'ville non précisée'} · {STATUTS[d.statut]}
                  </p>
                  {options[i]!.length === 0 ? <p className="text-xs text-ink-500 mt-1">Aucun référent actif.</p> : <Attribuer dossierId={d.id} options={options[i]!} />}
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Dossiers des collaborateurs absents">
          {parAbsent.size === 0 ? (
            <p className="text-sm text-ink-600">Aucun collaborateur absent aujourd’hui avec des dossiers ouverts.</p>
          ) : (
            <div className="space-y-6">
              {[...parAbsent].map(([referentId, liste]) => (
                <section key={referentId}>
                  <h3 className="font-semibold text-sm mb-2">
                    {liste[0]!.referentNom} (absent) · {liste.length} dossier(s)
                  </h3>
                  <ReaffectationMasse dossiers={liste.map((d) => ({ id: d.id, libelle: `${d.numero} · ${d.client} · ${STATUTS[d.statut]}` }))} options={tousReferents.filter((o) => o.id !== referentId)} />
                </section>
              ))}
            </div>
          )}
        </Carte>
      </div>
    </>
  );
}
