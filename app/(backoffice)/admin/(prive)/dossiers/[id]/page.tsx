// RG-22 : fiche dossier — onglets Résumé, Demandes, Postes, Documents, Historique, Notes.
import Link from 'next/link';
import { forbidden, notFound } from 'next/navigation';
import { exigerCollaborateur } from '@/lib/authz/session';
import { lireDossier, dossiersDuClient } from '@/lib/dossiers/lecture';
import { peutTraiter } from '@/lib/dossiers/acces';
import { CATEGORIES_DOCUMENT } from '@/lib/dossiers/service';
import { STATUTS, PHASES, phaseDe, transitionsProposees } from '@/lib/dossiers/statuts';
import { DOSSIER_TYPES } from '@/lib/domain/referentiels';
import { formatHorodatage } from '@/lib/audit-lecture';
import { formaterTelephone } from '@/lib/telephone';
import { listesLieux } from '@/lib/geo/service';
import { env } from '@/lib/env';
import { Carte, Pastille, TitrePage } from '@/components/backoffice/ui';
import * as A from './Actions';
import { formaterFCFA } from '@/lib/dossiers/formulaire-personnel';
import { getDb } from '@/lib/db';
import { evaluerCandidats } from '@/lib/dossiers/attribution';
import { contexteDossier, listerModeles } from '@/lib/modeles/service';
import { rendreMessage } from '@/lib/modeles/variables';
import { estFinal } from '@/lib/dossiers/statuts';
import { peutAccederVivier } from '@/lib/candidats/acces';
import { lienTrouverCandidats } from '@/lib/candidats/recherche';
import { quartiersGeolocalises } from '@/lib/candidats/vivier';
import { etatRecherche, lienOngletPropositions } from '@/lib/propositions/service';
import SectionPropositions from './SectionPropositions';

/** MVP1-03 RG-06 : estimation enregistrée dans la Demande (preuve de ce qui a été affiché). */
function estimationMontree(donnees: unknown): string | null {
  const e = (donnees as { estimation?: { commission?: unknown; personnes?: unknown; montant?: unknown } } | null)?.estimation;
  if (!e || typeof e.montant !== 'number' || typeof e.commission !== 'number' || typeof e.personnes !== 'number') return null;
  return `${formaterFCFA(e.montant)} (${e.personnes} × ${formaterFCFA(e.commission)})`;
}

export const metadata = { title: 'Dossier' };

const ONGLETS = [
  ['resume', 'Résumé'],
  ['demandes', 'Demandes'],
  ['postes', 'Postes'],
  ['propositions', 'Propositions'],
  ['documents', 'Documents'],
  ['historique', 'Historique'],
  ['notes', 'Notes'],
] as const;
type Onglet = (typeof ONGLETS)[number][0];

const LIBELLE_EVENEMENT: Record<string, string> = {
  creation: 'Création',
  transition: 'Statut',
  modification: 'Modification',
  attribution: 'Attribution',
  reaffectation: 'Réaffectation',
  note: 'Note',
  document: 'Document',
  rattachement: 'Rattachement',
  whatsapp: 'WhatsApp',
  lien_suivi: 'Lien de suivi',
  client: 'Client',
  proposition: 'Proposition',
  placement: 'Placement',
};

export default async function PageDossier({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const c = await exigerCollaborateur();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const fiche = await lireDossier(id, c);
  if (!fiche) notFound();
  if (fiche === 'interdit') forbidden();

  const { onglet: o } = await searchParams;
  const onglet: Onglet = ONGLETS.some(([k]) => k === o) ? (o as Onglet) : 'resume';
  const { dossier: d, client } = fiche;
  const traiter = peutTraiter(c, d.referentId);
  const direction = c.roles.includes('direction');
  const lienSuivi = `${env().BETTER_AUTH_URL}/suivi/${d.jetonSuivi}`;
  const onglets = ONGLETS.filter(([k]) => (k !== 'postes' && k !== 'propositions') || d.type === 'REC');
  const derniereDemande = fiche.demandes.at(-1);
  const recu = (derniereDemande?.donnees as { client?: Record<string, string | null> } | undefined)?.client;
  const listes = onglet === 'resume' && traiter ? await listesLieux() : [];
  const cibles =
    onglet === 'demandes' && traiter
      ? (await dossiersDuClient(client.id, d.id, c)).filter((x) => !['cloture', 'refuse', 'sans_suite'].includes(x.statut)).map((x) => ({ id: x.id, numero: x.numero }))
      : [];
  // MVP1-05 : réaffectation (Direction) et modèles WhatsApp (référent du dossier).
  const peutReaffecter = onglet === 'resume' && c.roles.includes('direction') && !estFinal(d.statut);
  const candidats = peutReaffecter ? (await evaluerCandidats(getDb(), d)).sort((x, y) => x.raisons.length - y.raisons.length || x.charge - y.charge) : [];
  const modeles =
    onglet === 'resume' && traiter
      ? await (async () => {
          const ctx = await contexteDossier(d.id, { id: c.id, nom: c.nom });
          return (await listerModeles({ type: d.type, actifsSeulement: true })).map((m) => ({ id: m.id, nom: m.nom, texte: rendreMessage(m.texte, ctx) }));
        })()
      : [];
  // Dossier sans référent : l'attribution est l'action principale (en tête) ; sinon en fin de résumé.
  const reaffectation = peutReaffecter ? <A.Reaffecter dossierId={d.id} referentActuel={d.referentId} candidats={candidats.map(({ id, nom, charge, raisons }) => ({ id, nom, charge, raisons }))} /> : null;
  // MVP2-02 RG-16 : « Trouver des candidats » depuis une ligne de poste (accès au vivier requis).
  const trouver =
    onglet === 'postes' && d.type === 'REC' && fiche.lignes.length > 0 && (await peutAccederVivier(c))
      ? { villeId: d.villeId, quartierId: d.quartierId, quartierGeolocalise: !!d.quartierId && (await quartiersGeolocalises([d.quartierId])).has(d.quartierId) }
      : null;
  // MVP2-03 : décompte « X placés / Y demandés » en résumé, dès l'exécution du dossier de recrutement.
  const recherche = onglet === 'resume' && d.type === 'REC' && ['execution', 'termine', 'cloture'].includes(phaseDe(d.statut)) ? await etatRecherche(d.id, c) : null;
  const coordonneesDifferentes = !!recu && (recu.nom !== client.nom || (recu.contact ?? null) !== (client.contact ?? null) || (!!recu.email && recu.email !== client.email));

  return (
    <>
      <TitrePage titre={d.numero} retour={{ href: '/admin/dossiers', libelle: 'Dossiers' }}>
        <Pastille ton={d.statut === 'a_completer' ? 'orange' : phaseDe(d.statut) === 'issue' ? 'rouge' : 'vert'}>{STATUTS[d.statut]}</Pastille>
      </TitrePage>
      <p className="text-sm text-ink-600 -mt-3 mb-4">
        {DOSSIER_TYPES[d.type]} · {client.nom} · {fiche.referentNom ? `Référent : ${fiche.referentNom}` : 'Non attribué'}
      </p>

      <nav aria-label="Onglets du dossier" className="flex gap-1 overflow-x-auto border-b border-ink-100 mb-4 -mx-4 px-4">
        {onglets.map(([k, libelle]) => (
          <Link key={k} href={`?onglet=${k}`} aria-current={onglet === k ? 'page' : undefined} className={`shrink-0 px-3 py-3 text-sm font-medium border-b-2 ${onglet === k ? 'border-primary text-primary' : 'border-transparent text-ink-600'}`}>
            {libelle}
            {k === 'documents' && fiche.documents.length > 0 && ` (${fiche.documents.length})`}
            {k === 'demandes' && fiche.demandes.length > 1 && ` (${fiche.demandes.length})`}
          </Link>
        ))}
      </nav>

      {onglet === 'resume' && (
        <div className="space-y-4">
          {peutReaffecter && !d.referentId && reaffectation}
          {traiter && <A.ChangerStatut dossierId={d.id} options={transitionsProposees(d.type, d.statut, direction).map((s) => ({ code: s, libelle: STATUTS[s] }))} />}
          {recherche && (
            <section id="propositions" className="scroll-mt-4">
              <Carte titre="Recherche de candidats" actions={<Link href={lienOngletPropositions(d.id)} className="text-sm text-primary py-2">Propositions →</Link>}>
                <ul className="text-sm space-y-1">
                  {recherche.lignes.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span>{l.intitule}</span>
                      <span className={l.places >= l.nombre ? 'text-brand-900 font-medium' : 'text-ink-600'}>{l.places} placé{l.places > 1 ? 's' : ''} / {l.nombre} demandé{l.nombre > 1 ? 's' : ''}</span>
                    </li>
                  ))}
                </ul>
                {recherche.clotureLe ? (
                  <p className="text-xs text-ink-600 mt-2">Recherche clôturée : {recherche.placementsRetenus} placement(s) retenu(s).</p>
                ) : recherche.echeance ? (
                  <p className="text-xs text-ink-600 mt-2">Échéance de la recherche : {formatHorodatage(recherche.echeance)}{recherche.annonces.length ? ` · ${recherche.annonces.length} placement(s) annoncé(s) à confirmer` : ''}</p>
                ) : null}
              </Carte>
            </section>
          )}
          <Carte titre="Client">
            <dl className="text-sm grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
              <dt className="text-ink-500">Nom</dt><dd>{client.nom} ({client.type})</dd>
              {client.contact && (<><dt className="text-ink-500">Contact</dt><dd>{client.contact}</dd></>)}
              <dt className="text-ink-500">WhatsApp</dt>
              <dd><a className="text-primary" href={`https://wa.me/${client.whatsapp.replace('+', '')}`} target="_blank" rel="noopener noreferrer">{formaterTelephone(client.whatsapp)}</a></dd>
              {client.autreTelephone && (<><dt className="text-ink-500">Autre tél.</dt><dd><a className="text-primary" href={`tel:${client.autreTelephone}`}>{formaterTelephone(client.autreTelephone)}</a></dd></>)}
              {client.email && (<><dt className="text-ink-500">E-mail</dt><dd className="break-all">{client.email}</dd></>)}
            </dl>
            {traiter && modeles.length > 0 && <A.EnvoyerWhatsApp dossierId={d.id} numero={client.whatsapp} modeles={modeles} />}
            {traiter && coordonneesDifferentes && recu && <A.CoordonneesRecues dossierId={d.id} clientId={client.id} recu={{ nom: recu.nom ?? null, contact: recu.contact ?? null, email: recu.email ?? null }} />}
          </Carte>
          <Carte titre="Lieu et besoin">
            <dl className="text-sm grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 mb-3">
              <dt className="text-ink-500">Ville</dt><dd>{fiche.ville ?? d.villeAutre ?? '—'}</dd>
              <dt className="text-ink-500">Quartier</dt><dd>{fiche.quartier ?? d.quartierAutre ?? '—'}</dd>
              {d.lieu && (<><dt className="text-ink-500">Lieu</dt><dd>{d.lieu}</dd></>)}
              {d.secteur && (<><dt className="text-ink-500">Secteur</dt><dd>{d.secteur}</dd></>)}
            </dl>
            {d.description && <p className="text-sm whitespace-pre-wrap bg-ink-50 rounded p-2">{d.description}</p>}
            {traiter && (
              <A.ModifierLieu
                dossierId={d.id}
                listes={listes}
                valeur={{ villeId: d.villeId, villeAutre: d.villeAutre, quartierId: d.quartierId, quartierAutre: d.quartierAutre, lieu: d.lieu, secteur: d.secteur, description: d.description }}
                type={d.type}
                statut={d.statut}
              />
            )}
          </Carte>
          <Carte titre="Suivi client">
            <p className="text-sm text-ink-600 mb-2">Phase affichée au client : <strong>{PHASES[phaseDe(d.statut)]}</strong></p>
            <A.LienSuivi dossierId={d.id} lien={lienSuivi} peutRegenerer={traiter} />
          </Carte>
          {d.referentId && reaffectation}
        </div>
      )}

      {onglet === 'demandes' && (
        <div className="space-y-3">
          {fiche.demandes.map((dem) => (
            <Carte key={dem.id} titre={`Demande n° ${dem.id}`} actions={<span className="text-xs text-ink-500">{formatHorodatage(dem.creeLe)}</span>}>
              <p className="text-sm text-ink-600 mb-2">Canal : {dem.canal} · Formulaire : {dem.formulaire}</p>
              {estimationMontree(dem.donnees) && <p className="text-sm text-ink-800 mb-2">Estimation montrée au client : {estimationMontree(dem.donnees)}</p>}
              <details>
                <summary className="cursor-pointer text-sm text-primary py-1">Données reçues (non modifiables)</summary>
                <pre className="text-xs bg-ink-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(dem.donnees, null, 2)}</pre>
              </details>
              {traiter && <A.Rattacher dossierId={d.id} demandeId={dem.id} cibles={cibles} />}
            </Carte>
          ))}
        </div>
      )}

      {onglet === 'postes' && d.type === 'REC' && (
        <Carte titre={`Postes (${fiche.lignes.reduce((s, l) => s + l.nombre, 0)} personnes)`}>
          {traiter ? (
            <A.ModifierPostes dossierId={d.id} lignes={fiche.lignes.map(({ id: _i, dossierId: _d, ordre: _o, ...l }) => l)} voirSalaire={fiche.voirSalaire} />
          ) : (
            <ul className="space-y-2 text-sm">
              {fiche.lignes.map((l) => (
                <li key={l.id} className="border border-ink-100 rounded p-2">
                  <strong>{l.intitule}</strong> × {l.nombre} {l.typeContrat && `· ${l.typeContrat}`} {l.experience && `· ${l.experience}`}
                  {l.missions && <p className="text-ink-600">{l.missions}</p>}
                </li>
              ))}
            </ul>
          )}
          {trouver && (
            <div className="mt-4 pt-3 border-t border-ink-100">
              <h3 className="text-sm font-semibold text-ink-900 mb-2">Trouver des candidats</h3>
              <ul className="flex flex-wrap gap-2">
                {fiche.lignes.map((l) => (
                  <li key={l.id}>
                    <Link href={lienTrouverCandidats(l, trouver)} className="inline-flex items-center min-h-11 px-3 rounded-lg border border-ink-200 text-sm font-medium text-primary hover:border-primary">
                      Trouver des candidats : {l.intitule}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Carte>
      )}

      {onglet === 'propositions' && d.type === 'REC' && <SectionPropositions dossierId={d.id} demandeur={c} traiter={traiter} />}

      {onglet === 'documents' && (
        <div className="space-y-4">
          {traiter && <A.AjouterDocument dossierId={d.id} categories={Object.entries(CATEGORIES_DOCUMENT).map(([code, libelle]) => ({ code, libelle }))} />}
          <Carte titre="Documents">
            {fiche.documents.length === 0 ? (
              <p className="text-sm text-ink-600">Aucun document.</p>
            ) : (
              <ul className="divide-y divide-ink-50">
                {fiche.documents.map((doc) => (
                  <li key={doc.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <a href={`/admin/documents/${doc.id}`} target="_blank" rel="noopener" className="text-primary font-medium break-all">{doc.nom}</a>
                      <p className="text-xs text-ink-500">
                        {CATEGORIES_DOCUMENT[doc.categorie]} · {Math.ceil(doc.taille / 1024)} Ko · {doc.auteurNom ?? '—'} · {formatHorodatage(doc.creeLe)}
                      </p>
                    </div>
                    {traiter && (direction || (doc.auteurId === c.id && Date.now() - doc.creeLe.getTime() < 86_400_000)) && <A.SupprimerDocument dossierId={d.id} documentId={doc.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>
      )}

      {(onglet === 'historique' || onglet === 'notes') && (
        <div className="space-y-4">
          {onglet === 'notes' && traiter && <A.AjouterNote dossierId={d.id} />}
          <ul className="space-y-2">
            {fiche.evenements
              .filter(({ ev }) => onglet === 'historique' || ev.type === 'note')
              .map(({ ev, auteurNom }) => (
                <li key={ev.id} className="bg-white border border-ink-100 rounded-lg p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-500">
                    <span>{LIBELLE_EVENEMENT[ev.type] ?? ev.type} · {auteurNom ?? (ev.auteurId ? '—' : 'Système / client')}</span>
                    <span>{formatHorodatage(ev.horodatage)}</span>
                  </div>
                  {ev.deStatut || ev.versStatut ? (
                    <p>{ev.deStatut ? `${STATUTS[ev.deStatut]} → ` : ''}{ev.versStatut ? STATUTS[ev.versStatut] : ''}</p>
                  ) : null}
                  {ev.commentaire && <p className="whitespace-pre-wrap">{ev.commentaire}</p>}
                  {(ev.type === 'attribution' || ev.type === 'reaffectation') && typeof (ev.apres as { regle?: unknown } | null)?.regle === 'string' && (
                    <p className="text-xs text-ink-600">Règle : {(ev.apres as { regle: string }).regle}</p>
                  )}
                  {ev.type === 'whatsapp' && typeof (ev.apres as { texte?: unknown } | null)?.texte === 'string' && (
                    <p className="whitespace-pre-wrap text-xs bg-ink-50 rounded p-2 mt-1">{(ev.apres as { texte: string }).texte}</p>
                  )}
                  {(ev.avant != null || ev.apres != null) && ev.type !== 'note' && (
                    <details>
                      <summary className="cursor-pointer text-xs text-primary py-1">Avant / après</summary>
                      <pre className="text-xs bg-ink-50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify({ avant: ev.avant, apres: ev.apres }, null, 2)}</pre>
                    </details>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </>
  );
}
