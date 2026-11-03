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
import { classeBouton, classeChamp, classeLibelle, Pastille, TitrePage } from '@/components/backoffice/ui';
import { TraiterCandidature } from './Elements';

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
      <TitrePage titre={direction ? 'Candidatures' : 'Mes candidatures'}>
        {peut(c.roles, 'offre.responsables') && (
          <Link href="/admin/candidatures/offres" className={classeBouton('secondaire')}>
            Responsables des offres
          </Link>
        )}
      </TitrePage>

      <form className="bg-white border border-ink-100 rounded-xl p-4 shadow-sm mb-4 space-y-3">
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
        <div className="flex gap-2">
          <button type="submit" className={classeBouton()}>Filtrer</button>
          <Link href="/admin/candidatures" className={classeBouton('secondaire')}>Réinitialiser</Link>
        </div>
      </form>

      <ul className="space-y-2">
        {lignes.length === 0 && <li className="text-sm text-ink-600">Aucune candidature.</li>}
        {lignes.map((k) => {
          const nom = `${k.prenom} ${k.nom}`.trim();
          const traitable = k.statut === 'recue' && (direction || k.referentId === c.id);
          return (
            <li key={k.id} className="bg-white border border-ink-100 rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={lienFicheCandidat(k.candidatId)} className="font-medium text-primary underline">
                  {nom}
                </Link>
                <span className="flex flex-wrap gap-1">
                  {k.compteLeger && <Pastille ton="orange">Profil incomplet</Pastille>}
                  <Pastille ton={TON[k.statut]}>{STATUTS_CANDIDATURE[k.statut]}</Pastille>
                </span>
              </div>
              <p className="text-sm text-ink-800">{k.offreTitre}</p>
              <p className="text-sm text-ink-600">
                {[k.ville ?? 'Ville ?', k.quartier].filter(Boolean).join(' · ')}
                {k.telephone && ` · ${k.telephone}`}
              </p>
              {k.motivation && <p className="text-sm text-ink-700 whitespace-pre-line line-clamp-3 border-l-2 border-ink-100 pl-3">{k.motivation}</p>}
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
      <nav className="flex justify-between mt-4">
        {page > 1 ? <Link href={lienPage(page - 1)} className={classeBouton('secondaire')}>← Précédentes</Link> : <span />}
        {suivante && <Link href={lienPage(page + 1)} className={classeBouton('secondaire')}>Suivantes →</Link>}
      </nav>
    </>
  );
}
