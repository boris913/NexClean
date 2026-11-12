'use server';
// Actions sur les dossiers. Les droits sont revérifiés côté serveur à chaque appel
// (exigerCollaborateur + contrôles par dossier dans lib/dossiers/service.ts).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import * as svc from '@/lib/dossiers/service';
import type { Statut } from '@/lib/dossiers/statuts';
import type { DossierType } from '@/lib/domain/referentiels';
import type { Source } from '@/lib/acquisition/source';
import * as rdv from '@/lib/rendezvous/service';
import * as copilote from '@/lib/ia/copilote';
import type { RdvStatut } from '@/lib/rendezvous/domaine';

async function acteur() {
  const c = await exigerCollaborateur({ permission: 'dossier.traiter' });
  return { id: c.id, roles: c.roles, ip: c.ip };
}

const rafraichir = (id: number) => {
  revalidatePath(`/admin/dossiers/${id}`);
  revalidatePath('/admin/dossiers');
};

/** Succès : redirection serveur vers le dossier créé (pas de `router.push` en course avec la revalidation). */
export async function saisirDemande(entree: svc.NouvelleDemande) {
  const r = await executer(async () => {
    const d = await svc.creerDemande(entree, await acteur());
    revalidatePath('/admin/dossiers');
    return String(d.dossierId);
  });
  if (r.ok) redirect(`/admin/dossiers/${r.message}`);
  return r;
}

export async function changerStatut(id: number, vers: Statut, commentaire: string) {
  return executer(async () => {
    await svc.changerStatut(id, vers, commentaire || null, await acteur());
    rafraichir(id);
    return 'Statut mis à jour.';
  });
}

export async function ajouterNote(id: number, texte: string) {
  return executer(async () => {
    await svc.ajouterNote(id, texte, await acteur());
    rafraichir(id);
    return 'Note ajoutée.';
  });
}

export async function televerserDocument(id: number, form: FormData) {
  return executer(async () => {
    const fichier = form.get('fichier');
    if (!(fichier instanceof File) || fichier.size === 0) throw new ErreurMetier('Choisissez un fichier.');
    const categorie = String(form.get('categorie') ?? 'autre') as svc.CategorieDocument;
    if (!(categorie in svc.CATEGORIES_DOCUMENT)) throw new ErreurMetier('Catégorie inconnue.');
    await svc.ajouterDocument(id, { nom: fichier.name, octets: new Uint8Array(await fichier.arrayBuffer()) }, categorie, await acteur());
    rafraichir(id);
    return 'Document ajouté.';
  });
}

export async function supprimerDocument(dossierId: number, documentId: number) {
  return executer(async () => {
    await svc.supprimerDocument(documentId, await acteur());
    rafraichir(dossierId);
    return 'Document supprimé.';
  });
}

export async function corrigerSource(dossierId: number, demandeId: number, source: Source) {
  return executer(async () => {
    await svc.corrigerSource(demandeId, source, await acteur());
    rafraichir(dossierId);
    return 'Source corrigée.';
  });
}

export async function rattacherDemande(dossierId: number, demandeId: number, cibleId: number) {
  return executer(async () => {
    await svc.rattacherDemande(demandeId, cibleId, await acteur());
    rafraichir(dossierId);
    rafraichir(cibleId);
    return 'Demande rattachée.';
  });
}

export async function regenererLien(id: number) {
  return executer(async () => {
    const jeton = await svc.regenererJetonSuivi(id, await acteur());
    rafraichir(id);
    return jeton;
  });
}

export async function modifierLieu(id: number, champs: Parameters<typeof svc.modifierLieu>[1]) {
  return executer(async () => {
    await svc.modifierLieu(id, champs, await acteur());
    rafraichir(id);
    return 'Informations enregistrées.';
  });
}

export async function remplacerLignes(id: number, lignes: svc.LignePosteSaisie[]) {
  return executer(async () => {
    await svc.remplacerLignes(id, lignes, await acteur());
    rafraichir(id);
    return 'Postes enregistrés.';
  });
}

export async function changerType(id: number, type: DossierType) {
  return executer(async () => {
    await svc.changerType(id, type, await acteur());
    rafraichir(id);
    return 'Type modifié (le numéro reste inchangé).';
  });
}

export async function mettreAJourClient(dossierId: number, clientId: number, champs: Record<string, string | null>) {
  return executer(async () => {
    await svc.mettreAJourClient(clientId, champs, { ...(await acteur()), dossierId });
    rafraichir(dossierId);
    return 'Coordonnées du client mises à jour.';
  });
}

// ─── MVP1-05 ──────────────────────────────────────────────────

export async function reaffecterDossier(id: number, nouveauId: string, motif: string) {
  return executer(async () => {
    const c = await exigerCollaborateur({ permission: 'dossier.reaffecter' });
    const { reaffecter } = await import('@/lib/dossiers/attribution');
    const r = await reaffecter(id, nouveauId, motif, { id: c.id, roles: c.roles, ip: c.ip });
    rafraichir(id);
    revalidatePath('/admin/attribution');
    return r.avertissements.length ? `Dossier réaffecté (attention : ${r.avertissements.join(', ')}).` : 'Dossier réaffecté.';
  });
}

export async function noterWhatsApp(id: number, modele: string, texte: string) {
  return executer(async () => {
    await svc.noterMessageWhatsApp(id, modele, texte, await acteur());
    rafraichir(id);
    return 'Message enregistré dans l’historique.';
  });
}

// ─── Rendez-vous (COM1-02 RG-01) ──────────────────────────────

export async function planifierRendezVous(dossierId: number, entree: rdv.SaisieRendezVous) {
  return executer(async () => {
    await rdv.planifierRendezVous(dossierId, entree, await acteur());
    rafraichir(dossierId);
    revalidatePath('/admin/agenda');
    return 'Rendez-vous planifié.';
  });
}

export async function modifierRendezVous(dossierId: number, id: number, entree: rdv.SaisieRendezVous) {
  return executer(async () => {
    await rdv.modifierRendezVous(id, entree, await acteur());
    rafraichir(dossierId);
    revalidatePath('/admin/agenda');
    return 'Rendez-vous modifié.';
  });
}

export async function cloturerRendezVous(dossierId: number, id: number, statut: Exclude<RdvStatut, 'prevu'>, compteRendu: string) {
  return executer(async () => {
    await rdv.cloturerRendezVous(id, statut, compteRendu || null, await acteur());
    rafraichir(dossierId);
    revalidatePath('/admin/agenda');
    return 'Rendez-vous clôturé.';
  });
}

// ─── Copilote IA (COM3-01) : l'IA propose, le référent valide ──

export async function appliquerQualificationIa(dossierId: number, suggestionId: number) {
  return executer(async () => {
    const faits = await copilote.appliquerQualification(suggestionId, await acteur());
    rafraichir(dossierId);
    return `Qualification appliquée${faits.length ? ` (${faits.join(', ')})` : ''} ; le détail est ajouté en note.`;
  });
}

export async function ignorerSuggestionIa(dossierId: number, suggestionId: number) {
  return executer(async () => {
    await copilote.ignorerSuggestion(suggestionId, await acteur());
    rafraichir(dossierId);
    return 'Suggestion ignorée.';
  });
}

export async function resumerDossierIa(dossierId: number) {
  return executer(async () => {
    const r = await copilote.resumerDossier(dossierId, await acteur());
    if (!r) throw new ErreurMetier('Suggestion indisponible pour le moment : réessayez plus tard.');
    rafraichir(dossierId);
    return 'Résumé mis à jour.';
  });
}

export async function suggererRelanceIa(dossierId: number): Promise<{ ok: true; moment: string | null; message: string } | { ok: false; erreur: string }> {
  try {
    const r = await copilote.suggererRelance(dossierId, await acteur());
    return r ? { ok: true, ...r } : { ok: false, erreur: 'Suggestion indisponible pour le moment : rédigez la relance vous-même.' };
  } catch (e) {
    if (e instanceof ErreurMetier) return { ok: false, erreur: e.message };
    throw e;
  }
}
