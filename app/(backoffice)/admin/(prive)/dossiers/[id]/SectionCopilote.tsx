// COM3-01 : carte « Copilote IA » de la fiche dossier (masquée si l'IA n'est pas configurée).
import { Carte, Pastille } from '@/components/backoffice/ui';
import { iaActive } from '@/lib/ia/client';
import { suggestionsDuDossier, type ContenuQualification } from '@/lib/ia/copilote';
import { DOSSIER_TYPES } from '@/lib/domain/referentiels';
import { lireParametre } from '@/lib/parametres';
import { nomsLieu } from '@/lib/geo/service';
import Copilote from './Copilote';

const TEMPERATURE = { chaud: { libelle: 'Prospect chaud', ton: 'rouge' }, tiede: { libelle: 'Prospect tiède', ton: 'orange' }, froid: { libelle: 'Prospect froid', ton: 'bleu' } } as const;

export default async function SectionCopilote({ dossierId, traiter, derniereActionLe }: { dossierId: number; traiter: boolean; derniereActionLe: Date }) {
  if (!iaActive() || !traiter) return null;
  const [s, jours] = await Promise.all([suggestionsDuDossier(dossierId), lireParametre('jours_sans_action')]);
  const classif = s.classification?.contenu as { temperature: keyof typeof TEMPERATURE; raison: string } | undefined;
  const q = s.qualification?.contenu as ContenuQualification | undefined;
  const lieu = q ? await nomsLieu(q.villeId, q.quartierId) : null;
  const lignes: [string, string][] = q
    ? ([
        ['Type', DOSSIER_TYPES[q.type]],
        ['Lieu', [lieu?.quartier ?? q.quartier, lieu?.ville ?? q.ville].filter(Boolean).join(', ') || '—'],
        ['Effectif', q.effectif ? String(q.effectif) : '—'],
        ['Début', q.date_debut ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date(`${q.date_debut}T12:00:00`)) : '—'],
        ['Urgence', q.urgence === 'haute' ? 'Haute' : 'Normale'],
        ['Budget cité', q.budget ?? '—'],
        ['Besoin', q.besoin],
      ] as [string, string][])
    : [];
  return (
    <Carte
      titre="Copilote IA"
      description={classif ? <span className="inline-flex flex-wrap items-center gap-2"><Pastille ton={TEMPERATURE[classif.temperature].ton}>{TEMPERATURE[classif.temperature].libelle}</Pastille><span>{classif.raison}</span></span> : 'Suggestions à relire : rien n’est appliqué ni envoyé sans votre accord.'}
    >
      <Copilote
        dossierId={dossierId}
        resume={(s.resume?.contenu as { texte?: string } | undefined)?.texte ?? null}
        qualification={s.qualification ? { id: s.qualification.id, lignes, dejaTraitee: s.qualification.statut !== 'proposee' } : null}
        relancePossible={Date.now() - derniereActionLe.getTime() >= jours * 24 * 3600_000}
      />
    </Carte>
  );
}
