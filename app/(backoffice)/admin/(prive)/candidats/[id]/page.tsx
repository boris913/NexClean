// MVP2-02 : fiche candidat du Back-Office. Accès : Direction et référents ayant le service
// Recrutement (RG-13, 403 journalisé sinon) ; chaque consultation est journalisée.
import Link from 'next/link';
import { CheckCircle2, FileText } from 'lucide-react';
import { notFound } from 'next/navigation';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { DISPONIBILITES, HORAIRES, STATUTS_CANDIDAT, STATUT_CANDIDAT_CODES, type StatutCandidat } from '@/lib/candidats/domaine';
import {
  ELEMENTS_VERIFICATION,
  MIN_ELEMENTS_VERIFICATION,
  contexteCandidat,
  estReferentOuDirection,
  lireFicheCandidat,
  listerModelesCandidat,
  referentsPourCandidat,
  utiliseLienReinitialisation,
  type ElementVerification,
} from '@/lib/candidats/fiche';
import { peut } from '@/lib/authz/permissions';
import { formatHorodatage } from '@/lib/audit-lecture';
import { formaterFCFA } from '@/lib/dossiers/formulaire-personnel';
import { rendreMessage } from '@/lib/modeles/variables';
import { formaterTelephone, pourWhatsApp } from '@/lib/telephone';
import { Alerte, Carte, Pastille, TitrePage } from '@/components/backoffice/ui';
import * as A from './Fiche';
import { ProposerPourDossier } from './Propositions';
import { dossiersPourProposition, propositionsDuCandidat } from '@/lib/propositions/service';

export const metadata = { title: 'Candidat' };
export const dynamic = 'force-dynamic';

const LIBELLE_ACTION: Record<string, string> = {
  'candidat.inscrit': 'Inscription',
  'candidat.attribue': 'Attribution automatique',
  'candidat.non_attribue': 'Non attribué',
  'candidat.reaffecte': 'Réaffectation',
  'candidat.statut_modifie': 'Statut modifié',
  'candidat.statut_derive': 'Statut (automatique)',
  'candidat.whatsapp_prepare': 'Message WhatsApp préparé',
  'candidat.identite_verifiee': 'Identité vérifiée',
  'candidat.lien_reinitialisation_genere': 'Lien de réinitialisation généré',
  'candidat.reinitialisation_assistee_demandee': 'Mot de passe oublié (demande assistée)',
  'candidat.reinitialisation_email': 'Mot de passe oublié (lien par e-mail)',
  'candidat.mot_de_passe_reinitialise': 'Mot de passe réinitialisé',
  'candidat.telephone_modifie': 'Numéro de téléphone modifié',
  'candidat.profil_modifie': 'Profil modifié',
  'candidat.recherche_arretee': '« Je ne cherche plus »',
  'candidat.recherche_reprise': '« Je suis toujours en recherche »',
  'candidat.connexion_bloquee': 'Connexion bloquée (trop d’échecs)',
  'candidat.cv_ajoute': 'CV ajouté',
  'candidat.cv_remplace': 'CV remplacé',
  'candidat.justificatif_ajoute': 'Justificatif ajouté',
  'candidat.suppression_demandee': 'Suppression des données demandée',
  'candidat.donnees_supprimees': 'Données supprimées',
};

const STATUT_CANDIDATURE: Record<string, string> = { recue: 'Reçue', retenue: 'Retenue', refusee: 'Refusée' };
const TYPE_CONSENTEMENT: Record<string, string> = { traitement: 'Traitement du profil', contact: 'Prise de contact', majorite: 'Majorité' };

const tonStatut = (s: StatutCandidat) => (s === 'indisponible' ? 'rouge' : s === 'nouveau' || s === 'a_contacter' ? 'orange' : 'vert');
const liste = (v: readonly string[]) => (v.length ? v.join(', ') : '—');
const dateCourte = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'medium' }).format(d);

function Champs({ lignes }: { lignes: [string, React.ReactNode][] }) {
  return (
    <dl className="text-sm grid grid-cols-1 gap-y-3 sm:grid-cols-[9rem,1fr] sm:gap-x-4 sm:gap-y-2.5">
      {lignes.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs font-medium text-ink-500 sm:text-sm sm:font-normal">{k}</dt>
          <dd className="-mt-2.5 min-w-0 break-words text-ink-900 sm:mt-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function PageCandidat({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const c = await exigerAccesVivier('candidat.voir', { candidatId: (await params).id });
  if (!Number.isInteger(id) || id <= 0) notFound();
  const acteur = { id: c.id, roles: c.roles, ip: c.ip };
  const fiche = await lireFicheCandidat(id, acteur);
  if (!fiche) notFound();

  if (fiche.supprime) {
    return (
      <>
        <TitrePage titre={fiche.pseudonyme} retour={{ href: '/admin/candidats', libelle: 'Candidats' }} />
        <Alerte type="info">Les données de ce candidat ont été supprimées le {dateCourte(fiche.supprimeLe)} à sa demande. Seul le pseudonyme est conservé.</Alerte>
      </>
    );
  }

  const k = fiche.candidat;
  const direction = c.roles.includes('direction');
  const traiter = peut(c.roles, 'candidat.traiter');
  /** Statut : le référent du candidat ou la Direction (changerStatutCandidat). */
  const procedures = traiter && estReferentOuDirection(acteur, k.referentId);
  const suppressionEnCours = !!k.suppressionDemandeeLe;
  const reaffectation = peut(c.roles, 'candidat.reaffecter');
  const referents = reaffectation ? await referentsPourCandidat(k.villeId) : [];
  const numeroWhatsApp = k.whatsapp ?? k.telephone;
  const modeles =
    traiter && numeroWhatsApp && !suppressionEnCours
      ? await (async () => {
          const ctx = await contexteCandidat(k, { id: c.id, nom: c.nom });
          return (await listerModelesCandidat()).filter((m) => !utiliseLienReinitialisation(m.texte)).map((m) => ({ nom: m.nom, texte: rendreMessage(m.texte, ctx) }));
        })()
      : [];

  const valeurs: Record<ElementVerification, string> = {
    experience: fiche.experiences.map((e) => [e.poste, e.employeur, e.ville, e.duree].filter(Boolean).join(' — ')).join('\n'),
    quartier: [fiche.quartier ?? k.quartierAutre, fiche.arrondissement, fiche.ville ?? k.villeAutre].filter(Boolean).join(', '),
    metier: k.metiers.join(', '),
  };
  const infos: A.InfosVerification = {
    minimum: MIN_ELEMENTS_VERIFICATION,
    disponibles: fiche.verification.map((code) => ({ code, libelle: ELEMENTS_VERIFICATION[code], valeur: valeurs[code] })),
  };
  // MVP2-03 : propositions du candidat ; « Proposer pour un dossier » (dossiers REC traitables).
  const propositions = await propositionsDuCandidat(k.id, acteur);
  const peutProposer = traiter && !suppressionEnCours && k.statut !== 'indisponible' && peut(c.roles, 'dossier.traiter');
  const dossiersProposables = peutProposer ? await dossiersPourProposition(acteur) : [];
  const blocReaffecter = reaffectation ? <A.Reaffecter candidatId={k.id} referentActuel={k.referentId} referents={referents} /> : null;
  const cv = fiche.documents.filter((d) => d.categorie === 'cv');
  const justificatifs = fiche.documents.filter((d) => d.categorie === 'justificatif');
  const lienDocument = (docId: number) => `/admin/candidats/${k.id}/documents/${docId}`;

  return (
    <>
      <TitrePage titre={`${k.prenom} ${k.nom}`} retour={{ href: '/admin/candidats', libelle: 'Candidats' }} description={k.metiers.length ? k.metiers.join(' · ') : undefined}>
        <Pastille ton={tonStatut(k.statut)} point>
          {STATUTS_CANDIDAT[k.statut]}
        </Pastille>
      </TitrePage>
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-600 -mt-3 mb-6">
        <span>{fiche.referentNom ? `Référent : ${fiche.referentNom}` : 'Non attribué'}</span>
        <span aria-hidden>·</span>
        <span>Inscrit le {dateCourte(k.creeLe)} ({k.canalInscription === 'assiste' ? 'inscription assistée' : 'en ligne'})</span>
        {k.compteLeger && <Pastille ton="orange">Compte léger</Pastille>}
        {fiche.completude.pourcentage < 100 && <Pastille ton={fiche.completude.pourcentage < 60 ? 'orange' : 'neutre'}>Profil complet à {fiche.completude.pourcentage} %</Pastille>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
      <div className="space-y-4 lg:col-span-2">
        {suppressionEnCours && (
          <Alerte>
            Suppression des données demandée le {dateCourte(k.suppressionDemandeeLe!)}
            {k.suppressionPrevueLe ? `, exécution prévue le ${dateCourte(k.suppressionPrevueLe)}` : ''}. Le compte est bloqué.
          </Alerte>
        )}
        {fiche.demandeReinitialisation && procedures && (
          <Alerte type="info">
            Le candidat a demandé une réinitialisation de son mot de passe le {formatHorodatage(fiche.demandeReinitialisation.creeLe)}.{' '}
            <a href="#reinitialisation" className="underline">Traiter la demande</a>
          </Alerte>
        )}
        {k.compteLeger && <Alerte type="info">Compte léger créé par une candidature : profil incomplet, à faire compléter (modèle « Compléter votre profil »).</Alerte>}
        {!k.referentId && blocReaffecter}
        {procedures && !suppressionEnCours && (
          <A.ChangerStatut candidatId={k.id} statut={k.statut} options={STATUT_CANDIDAT_CODES.map((s) => ({ code: s, libelle: STATUTS_CANDIDAT[s] }))} />
        )}

        <Carte titre="Contacts">
          <Champs
            lignes={[
              ['Téléphone', k.telephone ? <a className="text-primary" href={`tel:${k.telephone}`}>{formaterTelephone(k.telephone)}</a> : '—'],
              ['WhatsApp', numeroWhatsApp ? <a className="text-primary" href={`https://wa.me/${pourWhatsApp(numeroWhatsApp)}`} target="_blank" rel="noopener noreferrer">{formaterTelephone(numeroWhatsApp)}</a> : '—'],
              ['E-mail', k.email ? <span className="break-all">{k.email}</span> : '—'],
              ['Dernière connexion', k.derniereConnexionLe ? formatHorodatage(k.derniereConnexionLe) : 'jamais'],
            ]}
          />
          {numeroWhatsApp && modeles.length > 0 && <A.EnvoyerWhatsApp candidatId={k.id} numero={numeroWhatsApp} modeles={modeles} />}
          {procedures && !suppressionEnCours && <A.ChangerNumero candidatId={k.id} infos={infos} />}
        </Carte>

        <Carte titre="Localisation">
          <Champs
            lignes={[
              ['Ville', fiche.ville ?? k.villeAutre ?? '—'],
              ['Arrondissement', fiche.arrondissement ?? '—'],
              ['Quartier', fiche.quartier ?? k.quartierAutre ?? '—'],
              ['Repère', k.repere ?? '—'],
              ['Zones acceptées', k.zonesTouteVille ? 'Toute la ville' : liste([...fiche.zonesArrondissements, ...fiche.zonesQuartiers])],
            ]}
          />
        </Carte>

        <Carte titre="Emploi recherché">
          <Champs
            lignes={[
              ['Métiers', liste(k.metiers)],
              ['Secteurs', liste(k.secteurs)],
              ['Contrats', liste(k.typesContrat)],
              ['Prétentions', k.salaireMin != null || k.salaireMax != null ? [k.salaireMin, k.salaireMax].filter((x): x is number => x != null).map(formaterFCFA).join(' à ') : '—'],
              ['Disponibilité', k.disponibilite ? `${DISPONIBILITES[k.disponibilite]}${k.disponibilite === 'a_partir_du' && k.disponibleLe ? ` ${k.disponibleLe}` : ''}${k.disponibilite === 'preavis' && k.preavis ? ` (${k.preavis})` : ''}` : '—'],
              ['Horaires', liste(k.horaires.map((h) => HORAIRES[h as keyof typeof HORAIRES] ?? h))],
            ]}
          />
        </Carte>

        <Carte titre="Parcours">
          <Champs
            lignes={[
              ['Études', k.niveauEtudes ?? '—'],
              ['Qualifications', k.qualifications ? <span className="whitespace-pre-wrap">{k.qualifications}</span> : '—'],
              ['Compétences', liste(k.competences)],
            ]}
          />
          <h3 className="text-sm font-semibold mt-4 mb-2">Expériences ({fiche.experiences.length})</h3>
          {fiche.experiences.length === 0 ? (
            <p className="text-sm text-ink-500">Aucune expérience renseignée.</p>
          ) : (
            <ul className="space-y-2">
              {fiche.experiences.map((e) => (
                <li key={e.id} className="border-l-2 border-brand-300 bg-ink-50/60 rounded-r-lg px-3 py-2.5 text-sm">
                  <strong className="text-ink-900">{e.poste}</strong>
                  {e.employeur && ` · ${e.employeur}`}
                  <p className="text-ink-600">{[e.ville, e.duree].filter(Boolean).join(' · ') || '—'}</p>
                  {e.missions && <p className="whitespace-pre-wrap">{e.missions}</p>}
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
      <div className="space-y-4">

        <Carte titre="Documents">
          {fiche.documents.length === 0 ? (
            <p className="text-sm text-ink-500">Aucun CV ni justificatif.</p>
          ) : (
            <ul className="-my-2 divide-y divide-ink-100">
              {[...cv, ...justificatifs].map((d) => (
                <li key={d.id} className="flex items-start gap-3 py-2.5 min-w-0">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ocean-50 text-ocean-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <a href={lienDocument(d.id)} target="_blank" rel="noopener" className="text-primary font-medium break-all hover:text-primary-dark">{d.nom}</a>
                    <span className="block text-xs text-ink-500">{d.categorie === 'cv' ? 'CV' : 'Justificatif'} · {Math.ceil(d.taille / 1024)} Ko · {formatHorodatage(d.creeLe)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-500 mt-3">Chaque téléchargement est journalisé.</p>
          {fiche.completude.manquants.length > 0 && <p className="text-xs text-ink-600 mt-2">Manque au profil : {fiche.completude.manquants.join(', ')}.</p>}
        </Carte>

        <Carte titre={`Candidatures (${fiche.candidatures.length})`}>
          {fiche.candidatures.length === 0 ? (
            <p className="text-sm text-ink-500">Aucune candidature.</p>
          ) : (
            <ul className="-my-2 divide-y divide-ink-100">
              {fiche.candidatures.map((x) => (
                <li key={x.id} className="py-2.5 text-sm flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <Link href={`/recrutement/${x.offreSlug}`} className="text-primary" target="_blank">{x.offreTitre}</Link>
                    <span className="block text-xs text-ink-500">{formatHorodatage(x.creeLe)}</span>
                  </span>
                  <Pastille ton={x.statut === 'retenue' ? 'vert' : x.statut === 'refusee' ? 'rouge' : 'neutre'}>{STATUT_CANDIDATURE[x.statut] ?? x.statut}</Pastille>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre={`Propositions (${propositions.length})`}>
          {propositions.length === 0 ? (
            <p className="text-sm text-ink-500">Aucune proposition.</p>
          ) : (
            <ul className="-my-2 divide-y divide-ink-100">
              {propositions.map((p) => (
                <li key={p.id} className="py-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      {p.voirDossier ? <Link href={`/admin/dossiers/${p.dossierId}?onglet=propositions#propositions`} className="text-primary">{p.numero}</Link> : p.numero} · {p.intitule} · {p.client}
                    </span>
                    <Pastille ton={p.statut === 'placee' || p.statut === 'retenue' ? 'vert' : p.statut === 'refusee' || p.statut === 'refusee_candidat' || p.statut === 'retiree' ? 'rouge' : p.statut === 'en_attente_accord' ? 'orange' : 'neutre'}>{p.libelleStatut}</Pastille>
                  </div>
                  <p className="text-xs text-ink-500">
                    {formatHorodatage(p.creeLe)}
                    {p.placements.map((pl, i) => <span key={i}> · Placement {pl.libelleStatut.toLowerCase()}{pl.remplacement ? ' (remplacement)' : ''}{pl.datePriseDePoste ? ` le ${pl.datePriseDePoste}` : ` prévu le ${pl.datePrevue}`}</span>)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {peutProposer && <ProposerPourDossier candidatId={k.id} dossiers={dossiersProposables} />}
        </Carte>

        <Carte titre="Consentements">
          {fiche.consentements.length === 0 ? (
            <p className="text-sm text-ink-500">Aucun consentement enregistré.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {fiche.consentements.map((x) => (
                <li key={x.id} className="flex items-start gap-2 text-ink-700">
                  <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {TYPE_CONSENTEMENT[x.type] ?? x.type} · version {x.version} · {x.canal === 'assiste' ? 'assisté' : 'site'} · {formatHorodatage(x.horodatage)}
                </li>
              ))}
            </ul>
          )}
        </Carte>

        {procedures && !suppressionEnCours && (
          <A.ReinitialisationAssistee
            candidatId={k.id}
            numero={numeroWhatsApp}
            infos={infos}
            demandeLe={fiche.demandeReinitialisation ? formatHorodatage(fiche.demandeReinitialisation.creeLe) : null}
          />
        )}

        {k.referentId && blocReaffecter}
      </div>
      </div>

      <div className="mt-4">
        <Carte titre="Historique">
          {fiche.historique.length === 0 ? (
            <p className="text-sm text-ink-500">Aucun événement.</p>
          ) : (
            <ol className="relative space-y-3 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-px before:bg-ink-200">
              {fiche.historique.map((h) => {
                const avant = h.avant as { statut?: StatutCandidat } | null;
                const apres = h.apres as { statut?: StatutCandidat } | null;
                const details = h.details as { motif?: string; modele?: string; texte?: string } | null;
                return (
                  <li key={h.id} className="relative pl-6 text-sm">
                    <span aria-hidden className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full ring-4 ring-white ${avant?.statut && apres?.statut ? 'bg-primary' : 'bg-ink-300'}`} />
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-500">
                      <span>
                        <span className="font-semibold text-ink-800">{LIBELLE_ACTION[h.action] ?? h.action}</span> · {h.acteurNom ?? (h.acteurType === 'candidat' ? 'Candidat' : h.acteurType === 'systeme' ? 'Système' : '—')}
                      </span>
                      <span className="tabular-nums">{formatHorodatage(h.horodatage)}</span>
                    </div>
                    {avant?.statut && apres?.statut && <p>{STATUTS_CANDIDAT[avant.statut]} → {STATUTS_CANDIDAT[apres.statut]}</p>}
                    {details?.motif && <p className="whitespace-pre-wrap">Motif : {details.motif}</p>}
                    {details?.modele && <p>Modèle : {details.modele}</p>}
                    {details?.texte && <p className="whitespace-pre-wrap text-xs bg-ink-50 border border-ink-100 rounded-lg p-2.5 mt-1">{details.texte}</p>}
                    {direction && (h.avant != null || h.apres != null) && !apres?.statut && (
                      <details>
                        <summary className="cursor-pointer text-xs text-primary py-1">Avant / après</summary>
                        <pre className="text-xs bg-ink-50 border border-ink-100 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify({ avant: h.avant, apres: h.apres }, null, 2)}</pre>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Carte>
      </div>
    </>
  );
}
