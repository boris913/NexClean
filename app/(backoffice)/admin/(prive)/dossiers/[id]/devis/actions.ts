'use server';
// Actions de l'onglet Devis (MVP2-04 lot A). Les droits sont revérifiés côté serveur à chaque appel
// (exigerCollaborateur + contrôles par Dossier dans lib/devis/service.ts). `dossierId` ne sert qu'au
// rafraîchissement de la page.
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { STATUTS_DEVIS } from '@/lib/devis/domaine';
import * as svc from '@/lib/devis/service';

async function acteur() {
  const c = await exigerCollaborateur({ permission: 'dossier.traiter' });
  return { id: c.id, nom: c.nom, roles: c.roles, ip: c.ip };
}

const rafraichir = (dossierId: number) => {
  revalidatePath(`/admin/dossiers/${dossierId}`);
  revalidatePath('/admin/dossiers');
};

export async function creerDevis(dossierId: number) {
  return executer(async () => {
    const r = await svc.creerDevis(dossierId, await acteur());
    rafraichir(dossierId);
    return `Devis ${r.numero} créé : vérifiez-le, puis validez-le.`;
  });
}

export async function modifierDevis(dossierId: number, devisId: number, entree: svc.Modification) {
  return executer(async () => {
    await svc.modifierDevis(devisId, entree, await acteur());
    rafraichir(dossierId);
    return 'Devis enregistré.';
  });
}

export async function reprendrePostes(dossierId: number, devisId: number) {
  return executer(async () => {
    await svc.reprendrePostes(devisId, await acteur());
    rafraichir(dossierId);
    return 'Postes du dossier repris dans le devis.';
  });
}

export async function validerDevis(dossierId: number, devisId: number) {
  return executer(async () => {
    const r = await svc.validerDevis(devisId, await acteur());
    rafraichir(dossierId);
    return r.statut === 'attente_direction'
      ? `Taux d’acompte hors bornes : le devis est « ${STATUTS_DEVIS.attente_direction} ». La Direction est prévenue.`
      : 'Devis validé : vous pouvez l’envoyer au client (« Valider et envoyer »).';
  });
}

export async function validerParDirection(dossierId: number, devisId: number) {
  return executer(async () => {
    await svc.validerParDirection(devisId, await acteur());
    rafraichir(dossierId);
    return 'Devis validé par la Direction.';
  });
}

export async function nouvelleVersion(dossierId: number, devisId: number) {
  return executer(async () => {
    const r = await svc.nouvelleVersion(devisId, await acteur());
    rafraichir(dossierId);
    return `Version ${r.version} créée (brouillon) : modifiez-la puis validez-la.`;
  });
}

export async function validerEtEnvoyer(dossierId: number, devisId: number) {
  return executer(async () => {
    const r = await svc.validerEtEnvoyer(devisId, await acteur());
    rafraichir(dossierId);
    const email = r.email === 'envoye' ? ' Un e-mail avec le PDF a été envoyé au client.' : r.email === 'echec' ? ' Attention : l’e-mail au client n’a pas pu partir.' : '';
    return `Devis envoyé et PDF archivé.${email} Ouvrez WhatsApp pour transmettre le lien au client.`;
  });
}

export async function noterEnvoiWhatsApp(dossierId: number, devisId: number, texte: string) {
  return executer(async () => {
    await svc.noterEnvoiWhatsApp(devisId, texte, await acteur());
    rafraichir(dossierId);
    return 'Message noté dans l’historique.';
  });
}

export async function enregistrerAcceptation(dossierId: number, devisId: number, form: FormData) {
  return executer(async () => {
    const f = form.get('fichier');
    const fichier = f instanceof File && f.size > 0 ? { nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) } : null;
    const r = await svc.enregistrerAcceptationWhatsApp(devisId, { fichier, signataireNom: String(form.get('signataireNom') ?? ''), signataireFonction: String(form.get('signataireFonction') ?? '') }, await acteur());
    rafraichir(dossierId);
    return r.facture ? `Acceptation enregistrée. Facture d’acompte ${r.facture.numero} émise.` : 'Acceptation enregistrée.';
  });
}

export async function enregistrerRefus(dossierId: number, devisId: number, motif: string) {
  return executer(async () => {
    await svc.enregistrerRefus(devisId, motif.slice(0, 1000) || null, await acteur());
    rafraichir(dossierId);
    return 'Refus enregistré.';
  });
}

export async function creerAvenant(dossierId: number, devisId: number, entree: svc.EntreeAvenant) {
  return executer(async () => {
    if (!entree || !Array.isArray(entree.lignes)) throw new ErreurMetier('Avenant invalide.');
    const r = await svc.creerAvenant(devisId, entree, await acteur());
    rafraichir(dossierId);
    return `Avenant ${r.numero} créé (brouillon) : vérifiez-le, puis validez-le.`;
  });
}
