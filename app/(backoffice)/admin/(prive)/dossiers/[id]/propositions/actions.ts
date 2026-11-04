'use server';
// Actions des Propositions et Placements (MVP2-03 lot A). Les droits sont revérifiés côté serveur
// à chaque appel (exigerCollaborateur + contrôles par Dossier dans lib/propositions/service.ts).
// `dossierId` ne sert qu'au rafraîchissement de la page.
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import type { StatutProposition } from '@/lib/propositions/domaine';
import { formaterMontant } from '@/lib/devis/domaine';
import * as svc from '@/lib/propositions/service';
import type { ResultatAction } from '@/components/backoffice/ui';

async function acteur() {
  const c = await exigerCollaborateur({ permission: 'dossier.traiter' });
  return { id: c.id, nom: c.nom, roles: c.roles, ip: c.ip };
}

const rafraichir = (dossierId: number) => {
  revalidatePath(`/admin/dossiers/${dossierId}`);
  revalidatePath('/admin/dossiers');
  revalidatePath('/admin/candidats/[id]', 'page');
};

/** Fichier d'un formulaire (champ `fichier`), ou null s'il est absent ou vide. */
async function fichierDe(form: FormData): Promise<svc.Fichier | null> {
  const f = form.get('fichier');
  if (!(f instanceof File) || f.size === 0) return null;
  return { nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) };
}

const champ = (form: FormData, k: string) => String(form.get(k) ?? '').trim();
const avecAvertissements = (message: string, avertissements: string[]) => (avertissements.length ? `${message} Attention : ${avertissements.join(' ')}` : message);

type Donnees<T> = ({ ok: true } & T) | { ok: false; erreur: string };

/** Exécute une action qui renvoie des données (en plus du message). */
async function avecDonnees<T extends object>(fn: () => Promise<T>): Promise<Donnees<T>> {
  let donnees: T | null = null;
  const r: ResultatAction = await executer(async () => {
    donnees = await fn();
  });
  if (!r.ok) return r;
  return { ok: true, ...donnees! };
}

export type CandidatTrouve = Awaited<ReturnType<typeof svc.chercherCandidatsAProposer>>[number];

export async function chercherCandidats(q: string): Promise<Donnees<{ candidats: CandidatTrouve[] }>> {
  return avecDonnees(async () => ({ candidats: await svc.chercherCandidatsAProposer(q.slice(0, 100), await acteur()) }));
}

export async function creerProposition(entree: { dossierId: number; lignePosteId: number; candidatId: number; salaireCommunicable: boolean; remplacePlacementId?: number | null }) {
  return executer(async () => {
    const r = await svc.creerProposition(entree, await acteur());
    rafraichir(entree.dossierId);
    return avecAvertissements('Candidat proposé : la proposition attend son accord (espace candidat ou accord WhatsApp).', r.avertissements);
  });
}

export async function enregistrerAccordWhatsApp(dossierId: number, propositionId: number, form: FormData) {
  return executer(async () => {
    await svc.enregistrerAccordWhatsApp(propositionId, { fichier: await fichierDe(form), date: champ(form, 'date'), numeroCommunicable: form.get('numeroCommunicable') === 'on' }, await acteur());
    rafraichir(dossierId);
    return 'Accord enregistré : le profil est transmis au client.';
  });
}

export async function changerStatutProposition(dossierId: number, propositionId: number, vers: StatutProposition, o: svc.OptionsStatut) {
  return executer(async () => {
    await svc.changerStatutProposition(propositionId, vers, o, await acteur());
    rafraichir(dossierId);
    return 'Proposition mise à jour.';
  });
}

export async function modifierEntretien(dossierId: number, propositionId: number, o: { entretienLe: string | null; entretienLieu: string | null }) {
  return executer(async () => {
    await svc.modifierEntretien(propositionId, o, await acteur());
    rafraichir(dossierId);
    return 'Entretien modifié.';
  });
}

export async function annoncerPlacement(dossierId: number, propositionId: number, e: svc.EntreePlacement) {
  return executer(async () => {
    const r = await svc.annoncerPlacement(propositionId, e, await acteur());
    rafraichir(dossierId);
    return avecAvertissements('Placement annoncé. Envoyez l’attestation au client pour confirmation.', r.avertissements);
  });
}

export async function confirmerPlacement(dossierId: number, placementId: number, form: FormData) {
  return executer(async () => {
    await svc.confirmerPlacementParPreuve(placementId, { fichier: await fichierDe(form), datePriseDePoste: champ(form, 'datePriseDePoste') }, await acteur());
    rafraichir(dossierId);
    return 'Prise de poste confirmée.';
  });
}

export async function placementDirect(dossierId: number, propositionId: number, form: FormData) {
  return executer(async () => {
    const r = await svc.placementDirectSurPreuve(propositionId, { fichier: await fichierDe(form), datePriseDePoste: champ(form, 'datePriseDePoste'), poste: champ(form, 'poste') || null, salaire: champ(form, 'salaire') || null }, await acteur());
    rafraichir(dossierId);
    return avecAvertissements('Placement confirmé sur preuve.', r.avertissements);
  });
}

export async function abandonnerPlacement(dossierId: number, placementId: number, motif: string) {
  return executer(async () => {
    await svc.abandonnerPlacement(placementId, motif, await acteur());
    rafraichir(dossierId);
    return 'Placement abandonné.';
  });
}

export async function declarerRupture(dossierId: number, placementId: number, r: { dateRupture: string; motif: string }) {
  return executer(async () => {
    const res = await svc.declarerRupture(placementId, r, await acteur());
    rafraichir(dossierId);
    return res.statut === 'rompu_garantie' ? 'Départ pendant la garantie : proposez un remplaçant sur le même poste (sans commission).' : 'Départ après la garantie : placement terminé, sans effet financier.';
  });
}

export async function creerLien(dossierId: number, propositionId: number, objet: svc.ObjetLien): Promise<Donnees<{ url: string; expireLe: string }>> {
  return avecDonnees(async () => {
    const l = await svc.creerLienAcces(propositionId, objet, await acteur());
    rafraichir(dossierId);
    return { url: l.url, expireLe: l.expireLe.toISOString() };
  });
}

export async function revoquerLien(dossierId: number, accesId: number) {
  return executer(async () => {
    await svc.revoquerLienAcces(accesId, await acteur());
    rafraichir(dossierId);
    return 'Lien révoqué.';
  });
}

/** Message WhatsApp prérempli ; pour un modèle client, le lien d'accès temporaire est créé maintenant. */
export async function preparerMessage(dossierId: number, propositionId: number, modele: string): Promise<Donnees<{ texte: string; numero: string | null }>> {
  return avecDonnees(async () => {
    const m = await svc.preparerMessageProposition(propositionId, modele, await acteur());
    if (m.lien) rafraichir(dossierId);
    return { texte: m.texte, numero: m.numero };
  });
}

export async function noterWhatsApp(dossierId: number, propositionId: number, modele: string, texte: string) {
  return executer(async () => {
    await svc.noterWhatsAppProposition(propositionId, modele, texte, await acteur());
    rafraichir(dossierId);
    return 'Message noté dans l’historique.';
  });
}

export async function cloturerRecherche(dossierId: number, motif: string) {
  return executer(async () => {
    if (motif.length > 500) throw new ErreurMetier('Motif trop long (500 caractères maximum).');
    const r = await svc.cloturerRecherche(dossierId, motif || null, await acteur());
    rafraichir(dossierId);
    // MVP2-04 RG-18 : montant final et facture de solde / avoir émis à la clôture.
    const f = r.facturation;
    const facture = f.facture ? ` ${f.facture.type === 'avoir' ? 'Avoir' : 'Facture de solde'} ${f.facture.numero} émis(e) : ${formaterMontant(f.facture.totalTtc)}.` : f.montantFinal ? ' Montant final égal à l’acompte facturé : aucune facture de solde.' : '';
    const montant = f.montantFinal ? ` Montant final : ${formaterMontant(f.montantFinal.totalTtc)}.` : '';
    // MVP2-05 RG-08 : issue financière (solde à encaisser, solde nul, trop-perçu à régulariser).
    const i = r.issue;
    const issue = !i ? '' : i.issue === 'solde_a_payer' ? ` Reste à encaisser : ${formaterMontant(i.montant)}.` : i.issue === 'solde_nul' ? ' Solde entièrement réglé.' : ` Trop-perçu de ${formaterMontant(i.montant)} : préparez l’ajustement (onglet Finances).`;
    return avecAvertissements(`Recherche clôturée : ${r.placementsRetenus} placement(s) retenu(s) pour le montant final.${montant}${facture}${issue}`, r.avertissements);
  });
}
