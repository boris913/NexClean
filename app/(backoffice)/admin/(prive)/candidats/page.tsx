// MVP2-02 : candidats — file « Nouveaux candidats » (RG-01, RG-02), file « Non attribués » de la
// Direction (RG-03) et recherche dans le vivier (RG-14..18). Filtres dans l'URL, 20 résultats
// par page, cartes (lisibles à 375 px), pas d'export. Accès : RG-13 (403 journalisé sinon).
import Link from 'next/link';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { STATUTS_TRAITEMENT_FILE } from '@/lib/candidats/attribution';
import { CONTRATS, DISPONIBILITES, SECTEURS, STATUTS_CANDIDAT, STATUT_CANDIDAT_CODES, type StatutCandidat } from '@/lib/candidats/domaine';
import { ONGLETS_VIVIER, RAYONS_KM, TRIS_VIVIER, lireFiltres, parametresFiltres, type OngletVivier, type TriVivier } from '@/lib/candidats/recherche';
import { compterCandidatsNonAttribues, compterNouveauxCandidats, fileCandidatsNonAttribues, fileNouveauxCandidats, rechercherCandidats, referentsRecrutement, type LigneCandidat } from '@/lib/candidats/vivier';
import { listesLieux } from '@/lib/geo/service';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Alerte, classeBouton, classeChamp, classeLibelle, Pastille, TitrePage } from '@/components/backoffice/ui';
import StatutRapide from './StatutRapide';

export const metadata = { title: 'Candidats' };

type Params = Record<string, string | string[] | undefined>;

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const tonStatut = (s: StatutCandidat) => (s === 'nouveau' ? 'orange' : s === 'indisponible' ? 'rouge' : s === 'place' || s === 'propose' ? 'vert' : 'neutre');
const formatDate = (iso: string) => new Date(`${iso}T12:00:00+01:00`).toLocaleDateString('fr-FR', { timeZone: 'Africa/Douala', day: 'numeric', month: 'short', year: 'numeric' });
const formatAnnees = (n: number) => (n <= 0 ? null : n < 1 ? `${Math.round(n * 12)} mois d’expérience` : `${Math.floor(n * 2) / 2} an${n >= 2 ? 's' : ''} d’expérience`.replace('.5', ',5'));

function disponibilite(l: LigneCandidat): string | null {
  if (!l.disponibilite) return null;
  if (l.disponibilite === 'a_partir_du' && l.disponibleLe) return `Disponible à partir du ${formatDate(l.disponibleLe)}`;
  return DISPONIBILITES[l.disponibilite];
}

function CarteCandidat({ l, voirReferent, extra, children }: { l: LigneCandidat; voirReferent: boolean; extra?: React.ReactNode; children?: React.ReactNode }) {
  const nom = `${l.prenom} ${l.nom}`;
  const lieu = [l.quartierNom ?? l.quartierAutre, l.villeNom ?? l.villeAutre].filter(Boolean).join(', ');
  const exp = formatAnnees(l.experienceAnnees);
  const dispo = disponibilite(l);
  return (
    <li className="bg-white border border-ink-100 rounded-xl p-4 shadow-sm">
      <Link href={`/admin/candidats/${l.id}`} className="block hover:text-primary">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold break-words min-w-0">{nom}</span>
          <Pastille ton={tonStatut(l.statut)}>{STATUTS_CANDIDAT[l.statut]}</Pastille>
        </div>
        {l.metiers.length > 0 && <p className="text-sm text-ink-800 mt-1 break-words">{l.metiers.join(' · ')}</p>}
        <p className="text-sm text-ink-600 break-words">{[lieu || 'Lieu non précisé', exp].filter(Boolean).join(' · ')}</p>
        {dispo && <p className="text-sm text-ink-600">{dispo}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-ink-500">
          <span>Inscrit le {formatHorodatage(l.creeLe)}</span>
          {voirReferent && <span>· {l.referentNom ?? 'Non attribué'}</span>}
          {l.cv && <Pastille>CV</Pastille>}
          {l.compteLeger && <Pastille ton="orange">Profil à compléter</Pastille>}
          {extra}
        </div>
      </Link>
      {children}
    </li>
  );
}

function Pagination({ page, suivante, lien }: { page: number; suivante: boolean; lien: (n: number) => string }) {
  if (page <= 1 && !suivante) return null;
  return (
    <nav aria-label="Pagination" className="flex justify-between mt-4">
      {page > 1 ? (
        <Link href={lien(page - 1)} className={classeBouton('secondaire')}>
          ← Précédents
        </Link>
      ) : (
        <span />
      )}
      {suivante && (
        <Link href={lien(page + 1)} className={classeBouton('secondaire')}>
          Suivants →
        </Link>
      )}
    </nav>
  );
}

export default async function PageCandidats({ searchParams }: { searchParams: Promise<Params> }) {
  const c = await exigerAccesVivier();
  const p = await searchParams;
  const direction = c.roles.includes('direction');
  const filtres = lireFiltres(p);
  const params = parametresFiltres(filtres);
  const demande = un(p.onglet);
  let onglet: OngletVivier = demande && demande in ONGLETS_VIVIER ? (demande as OngletVivier) : Object.keys(params).length ? 'vivier' : 'file';
  if (onglet === 'non_attribues' && !direction) onglet = 'file';
  const referentFiltre = direction ? un(p.referent) || undefined : undefined;
  const page = filtres.page;

  const [nbFile, nbNonAttribues] = await Promise.all([direction ? null : compterNouveauxCandidats(c.id), direction ? compterCandidatsNonAttribues() : null]);
  const onglets = (Object.keys(ONGLETS_VIVIER) as OngletVivier[]).filter((o) => o !== 'non_attribues' || direction);
  const compteur = (o: OngletVivier) => (o === 'file' && nbFile !== null ? ` (${nbFile})` : o === 'non_attribues' && nbNonAttribues !== null ? ` (${nbNonAttribues})` : '');
  const optionsStatut = STATUTS_TRAITEMENT_FILE.map((s) => ({ code: s, libelle: s === 'nouveau' ? 'Laisser « Nouveau »' : STATUTS_CANDIDAT[s] }));

  return (
    <>
      <TitrePage titre="Candidats">
        <Link href="/admin/candidats/reinitialisations" className={classeBouton('secondaire')}>
          Demandes de réinitialisation
        </Link>
      </TitrePage>
      <nav aria-label="Onglets des candidats" className="flex gap-1 overflow-x-auto border-b border-ink-100 mb-4 -mx-4 px-4">
        {onglets.map((o) => (
          <Link
            key={o}
            href={`?onglet=${o}`}
            aria-current={onglet === o ? 'page' : undefined}
            className={`shrink-0 px-3 py-3 text-sm font-medium border-b-2 ${onglet === o ? 'border-primary text-primary' : 'border-transparent text-ink-600'}`}
          >
            {o === 'file' && direction ? 'Files des référents' : ONGLETS_VIVIER[o]}
            {compteur(o)}
          </Link>
        ))}
      </nav>
      {onglet === 'file' && <OngletFile c={c} direction={direction} referentFiltre={referentFiltre} page={page} options={optionsStatut} />}
      {onglet === 'non_attribues' && <OngletNonAttribues page={page} options={optionsStatut} />}
      {onglet === 'vivier' && <OngletRecherche p={p} direction={direction} />}
    </>
  );
}

type Options = { code: StatutCandidat; libelle: string }[];

async function OngletFile({ c, direction, referentFiltre, page, options }: { c: { id: string; roles: Parameters<typeof fileNouveauxCandidats>[0]['roles'] }; direction: boolean; referentFiltre?: string; page: number; options: Options }) {
  const [r, referents] = await Promise.all([fileNouveauxCandidats(c, { referentId: referentFiltre, page }), direction ? referentsRecrutement() : Promise.resolve([])]);
  const lien = (n: number) => `?${new URLSearchParams({ onglet: 'file', ...(referentFiltre ? { referent: referentFiltre } : {}), page: String(n) })}`;
  return (
    <section aria-label="Nouveaux candidats">
      <p className="text-sm text-ink-600 mb-3">
        {direction ? 'Nouveaux inscrits attribués aux référents recrutement' : 'Vos nouveaux inscrits'}, les plus anciens d’abord. Consultez le profil, contactez si besoin, puis fixez le statut : le candidat sort de la file dès qu’il n’est plus « Nouveau ».
      </p>
      {direction && (
        <form className="flex flex-wrap items-end gap-2 mb-4">
          <input type="hidden" name="onglet" value="file" />
          <div className="grow min-w-0">
            <label htmlFor="referent" className={classeLibelle}>
              Référent
            </label>
            <select id="referent" name="referent" defaultValue={referentFiltre ?? ''} className={classeChamp}>
              <option value="">Tous</option>
              {referents.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nom}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={classeBouton('secondaire')}>
            Filtrer
          </button>
        </form>
      )}
      <p className="text-sm text-ink-700 mb-2">{r.total} candidat{r.total > 1 ? 's' : ''} à traiter</p>
      <ul className="grid gap-2 md:grid-cols-2">
        {r.lignes.length === 0 && <li className="text-sm text-ink-600">Aucun nouveau candidat à traiter.</li>}
        {r.lignes.map((l) => (
          <CarteCandidat key={l.id} l={l} voirReferent={direction}>
            {(direction || l.referentId === c.id) && <StatutRapide candidatId={l.id} nom={`${l.prenom} ${l.nom}`} statut={l.statut} options={options} />}
          </CarteCandidat>
        ))}
      </ul>
      <Pagination page={r.page} suivante={r.suivante} lien={lien} />
    </section>
  );
}

async function OngletNonAttribues({ page, options }: { page: number; options: Options }) {
  const r = await fileCandidatsNonAttribues({ page });
  return (
    <section aria-label="Candidats non attribués">
      <p className="text-sm text-ink-600 mb-3">Candidats sans référent recrutement (aucun référent éligible pour leur ville). Ouvrez la fiche pour les attribuer.</p>
      <p className="text-sm text-ink-700 mb-2">
        {r.total} candidat{r.total > 1 ? 's' : ''} non attribué{r.total > 1 ? 's' : ''}
      </p>
      <ul className="grid gap-2 md:grid-cols-2">
        {r.lignes.length === 0 && <li className="text-sm text-ink-600">Aucun candidat en attente d’attribution.</li>}
        {r.lignes.map((l) => (
          <CarteCandidat key={l.id} l={l} voirReferent={false} extra={l.enFileDepuis ? <Pastille ton="orange">En file depuis le {formatHorodatage(l.enFileDepuis)}</Pastille> : null}>
            {l.statut === 'nouveau' && <StatutRapide candidatId={l.id} nom={`${l.prenom} ${l.nom}`} statut={l.statut} options={options} />}
          </CarteCandidat>
        ))}
      </ul>
      <Pagination page={r.page} suivante={r.suivante} lien={(n) => `?onglet=non_attribues&page=${n}`} />
    </section>
  );
}

async function OngletRecherche({ p, direction }: { p: Params; direction: boolean }) {
  const f = lireFiltres(p);
  const params = parametresFiltres(f);
  const [r, villes] = await Promise.all([rechercherCandidats(f), listesLieux()]);
  const avec = (extra: Record<string, string>) => `?${new URLSearchParams({ onglet: 'vivier', ...params, ...extra })}`;
  const ouvert = Object.keys(params).some((k) => !['q', 'tri'].includes(k));

  const SelectQuartier = ({ id, nom, valeur, vide }: { id: string; nom: string; valeur?: number; vide: string }) => (
    <select id={id} name={nom} defaultValue={valeur ?? ''} className={classeChamp}>
      <option value="">{vide}</option>
      {villes.map((v) => (
        <optgroup key={v.id} label={v.nom}>
          {v.quartiers.map((q) => (
            <option key={q.id} value={q.id}>
              {q.nom}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  return (
    <section aria-label="Rechercher dans le vivier">
      <form className="bg-white border border-ink-100 rounded-xl p-4 shadow-sm mb-4 space-y-3">
        <input type="hidden" name="onglet" value="vivier" />
        <div>
          <label htmlFor="q" className="sr-only">
            Rechercher
          </label>
          <input id="q" name="q" type="search" defaultValue={f.q} placeholder="Métier, compétence, expérience, qualification…" className={classeChamp} />
        </div>
        <details open={ouvert}>
          <summary className="cursor-pointer text-sm text-primary py-2">Filtres</summary>
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            <legend className="sr-only">Lieu</legend>
            <div>
              <label htmlFor="ville" className={classeLibelle}>Ville</label>
              <select id="ville" name="ville" defaultValue={f.villeId ?? ''} className={classeChamp}>
                <option value="">Toutes</option>
                {villes.map((v) => (
                  <option key={v.id} value={v.id}>{v.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="arrondissement" className={classeLibelle}>Arrondissement</label>
              <select id="arrondissement" name="arrondissement" defaultValue={f.arrondissementId ?? ''} className={classeChamp}>
                <option value="">Tous</option>
                {villes.map((v) => (
                  <optgroup key={v.id} label={v.nom}>
                    {v.arrondissements.map((a) => (
                      <option key={a.id} value={a.id}>{a.nom}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="quartier" className={classeLibelle}>Quartier</label>
              <SelectQuartier id="quartier" nom="quartier" valeur={f.quartierId} vide="Tous" />
            </div>
            <div>
              <label htmlFor="rayon" className={classeLibelle}>Rayon autour du quartier</label>
              <select id="rayon" name="rayon" defaultValue={f.rayonKm ?? ''} className={classeChamp}>
                <option value="">Quartier exact</option>
                {RAYONS_KM.map((k) => (
                  <option key={k} value={k}>{k} km</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="zone" className={classeLibelle}>Accepte de travailler à</label>
              <SelectQuartier id="zone" nom="zone" valeur={f.zoneQuartierId} vide="Peu importe" />
            </div>
          </fieldset>
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
            <legend className="sr-only">Profil</legend>
            <div>
              <label htmlFor="metier" className={classeLibelle}>Métier</label>
              <input id="metier" name="metier" defaultValue={f.metier} className={classeChamp} />
            </div>
            <div>
              <label htmlFor="secteur" className={classeLibelle}>Secteur</label>
              <select id="secteur" name="secteur" defaultValue={f.secteur ?? ''} className={classeChamp}>
                <option value="">Tous</option>
                {SECTEURS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="contrat" className={classeLibelle}>Type de contrat</label>
              <select id="contrat" name="contrat" defaultValue={f.contrat ?? ''} className={classeChamp}>
                <option value="">Tous</option>
                {CONTRATS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="exp" className={classeLibelle}>Expérience minimale (années)</label>
              <input id="exp" name="exp" type="number" min={1} max={50} inputMode="numeric" defaultValue={f.experienceMin} className={classeChamp} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="competences" className={classeLibelle}>Compétences (séparées par des virgules)</label>
              <input id="competences" name="competences" defaultValue={f.competences.join(', ')} className={classeChamp} />
            </div>
            <div>
              <label htmlFor="pretention" className={classeLibelle}>Prétentions ≤ (FCFA)</label>
              <input id="pretention" name="pretention" inputMode="numeric" defaultValue={f.pretentionMax} className={classeChamp} />
              <p className="text-xs text-ink-500 mt-1">Les candidats sans prétention indiquée restent affichés.</p>
            </div>
            <div>
              <label htmlFor="dispoAvant" className={classeLibelle}>Disponible d’ici le</label>
              <input id="dispoAvant" name="dispoAvant" type="date" defaultValue={f.disponibleAvant} className={classeChamp} />
            </div>
            <div>
              <label htmlFor="statut" className={classeLibelle}>Statut</label>
              <select id="statut" name="statut" defaultValue={f.statut ?? ''} className={classeChamp}>
                <option value="">Tous (hors placés et indisponibles)</option>
                {STATUT_CANDIDAT_CODES.map((s) => (
                  <option key={s} value={s}>{STATUTS_CANDIDAT[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="du" className={classeLibelle}>Inscrits du</label>
              <input id="du" name="du" type="date" defaultValue={f.inscritDu} className={classeChamp} />
            </div>
            <div>
              <label htmlFor="au" className={classeLibelle}>au</label>
              <input id="au" name="au" type="date" defaultValue={f.inscritAu} className={classeChamp} />
            </div>
          </fieldset>
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 pt-3 text-sm">
            <legend className="sr-only">Options</legend>
            {(
              [
                ['dispo', 'immediate', f.disponibleImmediatement, 'Disponible immédiatement'],
                ['complet', '1', f.profilComplet, 'Profil complet'],
                ['cv', '1', f.avecCv, 'CV présent'],
                ['inactifs', '1', f.inclureInactifs, 'Inclure les placés et indisponibles'],
                ['souple', '1', f.souple, 'Correspondance souple (au moins un critère de profil)'],
                ['nongeo', '1', f.inclureNonGeolocalises, 'Rayon : inclure les quartiers non géolocalisés'],
              ] as const
            ).map(([nom, valeur, coche, libelle]) => (
              <label key={nom} className="flex items-center gap-2 min-h-11">
                <input type="checkbox" name={nom} value={valeur} defaultChecked={coche} className="h-5 w-5" />
                {libelle}
              </label>
            ))}
          </fieldset>
          <div className="pt-3 max-w-xs">
            <label htmlFor="tri" className={classeLibelle}>Tri</label>
            <select id="tri" name="tri" defaultValue={f.tri} className={classeChamp}>
              {(Object.keys(TRIS_VIVIER) as TriVivier[]).map((t) => (
                <option key={t} value={t}>{TRIS_VIVIER[t]}</option>
              ))}
            </select>
          </div>
        </details>
        <div className="flex gap-2">
          <button type="submit" className={classeBouton()}>
            Rechercher
          </button>
          <Link href="/admin/candidats?onglet=vivier" className={classeBouton('secondaire')}>
            Réinitialiser
          </Link>
        </div>
      </form>

      <div className="space-y-2 mb-3">
        {r.centreSansCentroide && <Alerte type="info">Ce quartier n’est pas encore géolocalisé : la recherche porte sur le quartier lui-même, sans rayon.</Alerte>}
        {r.nonGeolocalises > 0 && (
          <Alerte type="info">
            {r.nonGeolocalises} candidat{r.nonGeolocalises > 1 ? 's' : ''} de quartiers non géolocalisés —{' '}
            <Link href={avec({ nongeo: '1' })} className="text-primary font-medium underline">
              afficher quand même
            </Link>
          </Alerte>
        )}
      </div>
      <p className="text-sm text-ink-700 mb-2" aria-live="polite">
        {r.total} candidat{r.total > 1 ? 's' : ''}
        {!f.inclureInactifs && !f.statut && ' (hors placés et indisponibles)'}
      </p>
      <ul className="grid gap-2 md:grid-cols-2">
        {r.lignes.length === 0 && <li className="text-sm text-ink-600">Aucun candidat ne correspond à ces critères.</li>}
        {r.lignes.map((l) => (
          <CarteCandidat
            key={l.id}
            l={l}
            voirReferent={direction}
            extra={
              <>
                {l.distanceKm !== null && <Pastille>{l.distanceKm < 1 ? '< 1 km' : `${l.distanceKm.toFixed(1).replace('.', ',')} km`}</Pastille>}
                {r.criteres > 0 && f.souple && (
                  <Pastille ton={l.pertinence === r.criteres ? 'vert' : 'neutre'}>
                    {l.pertinence}/{r.criteres} critère{r.criteres > 1 ? 's' : ''}
                  </Pastille>
                )}
              </>
            }
          />
        ))}
      </ul>
      <Pagination page={r.page} suivante={r.suivante} lien={(n) => avec({ page: String(n) })} />
    </section>
  );
}
