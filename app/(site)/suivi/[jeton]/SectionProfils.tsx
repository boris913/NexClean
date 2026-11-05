// Section « Profils proposés » (specs/MVP2-03 RG-07..11, RG-15, RG-16), rendue côté serveur pour
// la page de suivi et les liens temporaires. Rien n'est lu avant la vérification des 4 chiffres.
import { FileText, MapPin } from 'lucide-react';
import { cardClasses } from '@/components/ui/Card';
import { blocageEnCours, estVerifie, placementsClient, profilsTransmis, type Contexte } from '@/lib/propositions/client';
import { ConfirmationPlacement, FormulaireVerification, RetourProfil } from './Interactions';

const dateLongue = (iso: string) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(Date.UTC(a!, m! - 1, j!)));
};
const heure = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit' }).format(d);

export default async function SectionProfils({ ctx, titre = 'Profils proposés' }: { ctx: Contexte; titre?: string }) {
  const source = ctx.type === 'acces' ? 'profil' : 'suivi';
  const titreId = `section-profils-${ctx.cle.replace(':', '-')}`;

  if (!(await estVerifie(ctx))) {
    const bloque = await blocageEnCours(ctx.cle);
    return (
      <section aria-labelledby={titreId} className={cardClasses({ padding: 'sm', className: 'mb-8' })}>
        <h2 id={titreId} className="font-display text-h3 text-ink-900 mb-2">
          {titre}
        </h2>
        <p className="text-sm text-ink-600 mb-4">Pour protéger les données des candidats, confirmez votre identité avant d’afficher {ctx.type === 'acces' ? 'ce document' : 'les profils'}.</p>
        <FormulaireVerification source={source} jeton={ctx.jeton} bloque={bloque ? `Trop d’essais. Réessayez après ${heure(bloque)} ou contactez NEXCLEAN sur WhatsApp.` : null} />
      </section>
    );
  }

  const [profils, placements] = await Promise.all([profilsTransmis(ctx), placementsClient(ctx)]);
  const aConfirmer = placements.filter((p) => p.statut === 'annonce');

  return (
    <section aria-labelledby={titreId} className="mb-8 space-y-4">
      <h2 id={titreId} className="font-display text-h3 text-ink-900">
        {titre}
      </h2>

      {aConfirmer.map((p) => (
        <article key={p.placementId} className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <h3 className="font-semibold mb-1">Prise de poste de {p.nom}</h3>
          <p className="text-sm text-ink-700 mb-3">
            {p.poste} — prévue le {dateLongue(p.datePrevue)}.{' '}
            <a href={`${ctx.chemin}/attestation/${p.placementId}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Voir l’attestation (PDF)
            </a>
          </p>
          <ConfirmationPlacement source={source} jeton={ctx.jeton} placementId={p.placementId} prenom={p.nom} datePrevue={p.datePrevue} />
        </article>
      ))}

      {placements
        .filter((p) => p.statut === 'confirme')
        .map((p) => (
          <p key={p.placementId} className="rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-700">
            Prise de poste de <strong>{p.nom}</strong> confirmée{p.datePriseDePoste ? ` le ${dateLongue(p.datePriseDePoste)}` : ''}.{' '}
            <a href={`${ctx.chemin}/attestation/${p.placementId}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Attestation (PDF)
            </a>
          </p>
        ))}

      {!profils.length && !placements.length && <p className="text-sm text-ink-600">{ctx.objet === 'attestation' ? 'Aucune attestation à afficher.' : 'Aucun profil à afficher pour le moment.'}</p>}

      {profils.map((p) => (
        <article key={p.propositionId} className={cardClasses({ padding: 'sm' })}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="font-display text-h3 text-ink-900">{p.nom}</h3>
              <p className="text-sm text-ink-600">{p.poste}</p>
            </div>
            {p.statut && <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700">{p.statut}</span>}
          </div>
          <dl className="space-y-2 text-sm mb-4">
            {p.metiers.length > 0 && (
              <div>
                <dt className="text-muted">Métiers</dt>
                <dd>{p.metiers.join(', ')}</dd>
              </div>
            )}
            {p.experiences.length > 0 && (
              <div>
                <dt className="text-muted">Expérience</dt>
                <dd>
                  <ul className="list-disc pl-5">
                    {p.experiences.map((e, i) => (
                      <li key={i}>
                        {e.poste}
                        {e.duree ? ` — ${e.duree}` : ''}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {p.competences.length > 0 && (
              <div>
                <dt className="text-muted">Compétences</dt>
                <dd>{p.competences.join(', ')}</dd>
              </div>
            )}
            {p.disponibilite && (
              <div>
                <dt className="text-muted">Disponibilité</dt>
                <dd>{p.disponibilite}</dd>
              </div>
            )}
            {p.quartier && (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Quartier</dt>
                <MapPin className="w-4 h-4 text-ink-400" aria-hidden />
                <dd>{p.quartier}</dd>
              </div>
            )}
          </dl>
          {p.aCv && (
            <a href={`${ctx.chemin}/cv/${p.propositionId}`} target="_blank" rel="noopener noreferrer" className="mb-4 inline-flex min-h-11 items-center gap-2 text-primary font-semibold underline">
              <FileText className="w-4 h-4" aria-hidden /> Consulter le CV
            </a>
          )}
          <RetourProfil source={source} jeton={ctx.jeton} propositionId={p.propositionId} prenom={p.nom} retour={p.retour} />
        </article>
      ))}
      <p className="text-xs text-muted">Pour organiser un entretien, votre référent NEXCLEAN fait le lien avec le candidat.</p>
    </section>
  );
}
