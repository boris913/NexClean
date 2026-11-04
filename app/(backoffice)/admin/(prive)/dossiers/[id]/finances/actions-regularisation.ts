'use server';
// MVP2-05 : actions du bloc « Régularisation » de l'onglet Finances (trop-perçu, ajustement,
// remboursements). Droits revérifiés côté serveur : permission de la page ici (403 si absente),
// puis contrôles par Dossier / rôle dans lib/encaissements/regularisation.ts.
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { formaterMontant } from '@/lib/devis/domaine';
import { CHOIX_AJUSTEMENT_CODES, MOYENS_SAISIE, type ChoixAjustement, type MoyenPaiement } from '@/lib/encaissements/domaine';
import * as svc from '@/lib/encaissements/regularisation';

const rafraichir = (dossierId: number) => {
  revalidatePath(`/admin/dossiers/${dossierId}`);
  revalidatePath('/admin/dossiers');
};

const champ = (form: FormData, k: string) => String(form.get(k) ?? '').trim();

export async function preparerAjustement(dossierId: number, form: FormData) {
  return executer(async () => {
    const c = await exigerCollaborateur({ permission: 'dossier.traiter' });
    const choix = champ(form, 'choix') as ChoixAjustement;
    if (!CHOIX_AJUSTEMENT_CODES.includes(choix)) throw new ErreurMetier('Indiquez le choix du client.');
    const brut = champ(form, 'montant').replace(/\s/g, '');
    const montant = brut === '' ? null : Number(brut);
    const commentaire = champ(form, 'commentaire');
    if (commentaire.length > 1000) throw new ErreurMetier('Commentaire trop long (1 000 caractères maximum).');
    const r = await svc.preparerAjustement(dossierId, { choix, montant, commentaire }, { id: c.id, roles: c.roles, ip: c.ip });
    rafraichir(dossierId);
    return choix === 'remboursement'
      ? `Remboursement de ${formaterMontant(r.montant)} préparé : la Direction est prévenue pour validation.`
      : `${formaterMontant(r.montant)} versés au crédit du client${r.soldeRecu ? ' : le dossier passe à « Solde reçu ».' : '.'}`;
  });
}

/** RG-11 : réservé à la Direction (permission `remboursement.valider` : 403 sinon). */
export async function validerRemboursement(dossierId: number, remboursementId: number) {
  return executer(async () => {
    const c = await exigerCollaborateur({ permission: 'remboursement.valider' });
    await svc.validerRemboursement(remboursementId, { id: c.id, roles: c.roles, ip: c.ip });
    rafraichir(dossierId);
    return 'Remboursement validé : le Responsable finances est prévenu.';
  });
}

export async function refuserRemboursement(dossierId: number, remboursementId: number, motif: string) {
  return executer(async () => {
    const c = await exigerCollaborateur({ permission: 'remboursement.valider' });
    if (motif.length > 1000) throw new ErreurMetier('Motif trop long (1 000 caractères maximum).');
    await svc.refuserRemboursement(remboursementId, motif, { id: c.id, roles: c.roles, ip: c.ip });
    rafraichir(dossierId);
    return 'Remboursement refusé : le trop-perçu reste à régulariser.';
  });
}

export async function effectuerRemboursement(dossierId: number, remboursementId: number, form: FormData) {
  return executer(async () => {
    const c = await exigerCollaborateur({ permission: 'finances.tableau_de_bord' });
    const moyen = champ(form, 'moyen') as MoyenPaiement;
    if (!(MOYENS_SAISIE as readonly string[]).includes(moyen)) throw new ErreurMetier('Choisissez le moyen de paiement.');
    const f = form.get('justificatif');
    const justificatif = f instanceof File && f.size > 0 ? { nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) } : null;
    const r = await svc.effectuerRemboursement(remboursementId, { moyen, reference: champ(form, 'reference') || null, date: champ(form, 'date'), justificatif, commentaire: champ(form, 'commentaire') || null }, { id: c.id, roles: c.roles, ip: c.ip });
    rafraichir(dossierId);
    return `Remboursement enregistré${r.soldeRecu ? ' : le dossier passe à « Solde reçu ».' : '.'}`;
  });
}
