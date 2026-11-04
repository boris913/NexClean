// MVP2-02 RG-09, RG-10 : liste des Candidatures, filtrable par offre et statut, en cartes.
// Un Référent voit les siennes ; la Direction toutes, y compris les non attribuées.
import Link from 'next/link';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { peut } from '@/lib/authz/permissions';
import { listerCandidatures, type FiltresCandidatures } from '@/lib/candidats/candidatures';
import { STATUTS_CANDIDATURE, type StatutCandidature } from '@/lib/candidats/formulaire-candidature';
import { lienFicheCandidat } from '@/lib/candidats/attribution';
import { jobs } from '@/content/jobs-data';
import { formatHorodatage } from '@/lib/audit-lecture';
import { classeBouton, classeChamp, classeLibelle, EtatVide, Pagination, Pastille, TitrePage } from '@/components/backoffice/ui';
import { TraiterCandidature } from './Elements';
import { Briefcase } from 'lucide-react';

export const metadata = { title: 'Candidatures' };

type Params = Record<string, string | undefined>;

const TON: Record<StatutCandidature, 'neutre' | 'vert' | 'rouge'> = { recue: 'neutre', retenue: 'vert', refusee: 'rouge' };

export default async function PageCandidatures({ searchParams }: { searchParams: Promise<Params> }) {
  const c = await exigerAccesVivier();
  const p = await searchParams;
  const filtres: FiltresCandidatures = {
    offre: p.offre || undefined,
    statut: p.statut && p.statut in STATUTS_CANDIDATURE ? (p.statut as StatutCandidature) : undefined,
    attribution: p.attribution === 'aucune' || p.attribution === 'moi' ? p.attribution : undefined,
    page: Number(p.page) || 1,
  };
  const { lignes, suivante, page, direction } = await listerCandidatures(c, filtres);
  const lienPage = (n: number) => `?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(p).filter(([, v]) => v)) as Record<string, string>), page: String(n) })}`;
  const titreOffre = (slug: string) => jobs.find((j) => j.slug === slug)?.title;

  return (
    <>
      <TitrePage titre={direction ? 'Candidatures' : 'Mes candidatures'} description="Candidatures reçues sur les offres publiées du site.">
        {peut(c.roles, 'offre.responsables') && (
          <Link href="/admin/candidatures/offres" className={classeBouton('secondaire')}>
            Responsables des offres
          </Link>
        )}
      </TitrePage>

      <form className="bg-white border border-ink-200/70 rounded-xl p-4 shadow-sm mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="offre" className={classeLibelle}>Offre</label>
            <select id="offre" name="offre" defaultValue={filtres.offre ?? ''} className={classeChamp}>
              <option value="">Toutes</option>
              {jobs.map((j) => (
                <option key={j.slug} value={j.slug}>
                  {j.title}
                  {j.status === 'closed' ? ' (pourvue)' : ''}
                </option>
              ))}
              {filtres.offre && !titreOffre(filtres.offre) && <option value={filtres.offre}>{filtres.offre}</option>}
            </select>
          </div>
          <div>
            <label htmlFor="statut" className={classeLibelle}>Statut</label>
            <select id="statut" name="statut" defaultValue={filtres.statut ?? ''} className={classeChamp}>
              <option value="">Tous</option>
              {(Object.keys(STATUTS_CANDIDATURE) as StatutCandidature[]).map((s) => (
                <option key={s} value={s}>{STATUTS_CANDIDATURE[s]}</option>
              ))}
            </select>
          </div>
          {direction && (
            <div>
              <label htmlFor="attribution" className={classeLibelle}>Attribution</label>
              <select id="attribution" name="attribution" defaultValue={filtres.attribution ?? ''} className={classeChamp}>
                <option value="">Toutes</option>
                <option value="aucune">Non attribuées</option>
                <option value="moi">Les miennes</option>
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-3">
          <button type="submit" className={classeBouton()}>Filtrer</button>
          <Link href="/admin/candidatures" className={classeBouton('secondaire')}>Réinitialiser</Link>
        </div>
      </form>

      {lignes.length === 0 && <EtatVide icone={Briefcase} titre="Aucune candidature." description="Les candidatures envoyées depuis les offres du site apparaîtront ici." />}
      <ul className="grid gap-3 lg:grid-cols-2">
        {lignes.map((k) => {
          const nom = `${k.prenom} ${k.nom}`.trim();
          const traitable = k.statut === 'recue' && (direction || k.referentId === c.id);
          return (
            <li key={k.id} className="bg-white border border-ink-200/70 rounded-xl p-4 shadow-sm space-y-2 transition hover:border-brand-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={lienFicheCandidat(k.candidatId)} className="font-semibold text-ink-900 hover:text-primary underline decoration-ink-300 underline-offset-4 hover:decoration-primary">
                  {nom}
                </Link>
                <span className="flex flex-wrap gap-1">
                  {k.compteLeger && <Pastille ton="orange">Profil incomplet</Pastille>}
                  <Pastille ton={TON[k.statut]} point>
                    {STATUTS_CANDIDATURE[k.statut]}
                  </Pastille>
                </span>
              </div>
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-800">
                <Briefcase aria-hidden className="h-3.5 w-3.5 text-ink-400" />
                {k.offreTitre}
              </p>
              <p className="text-sm text-ink-600">
                {[k.ville ?? 'Ville ?', k.quartier].filter(Boolean).join(' · ')}
                {k.telephone && ` · ${k.telephone}`}
              </p>
              {k.motivation && <p className="text-sm text-ink-700 whitespace-pre-line line-clamp-3 border-l-2 border-brand-200 bg-ink-50/60 rounded-r-lg py-1.5 pl-3 pr-2">{k.motivation}</p>}
              <p className="text-xs text-ink-500">
                Reçue le {formatHorodatage(k.creeLe)}
                {direction && ` · ${k.referentNom ?? 'Non attribuée'}`}
                {k.traiteeLe && ` · traitée le ${formatHorodatage(k.traiteeLe)}`}
              </p>
              {traitable && <TraiterCandidature id={k.id} nom={nom} />}
            </li>
          );
        })}
      </ul>
      <Pagination page={page} suivante={suivante} lien={lienPage} libelles={['Précédentes', 'Suivantes']} />
    </>
  );
}
