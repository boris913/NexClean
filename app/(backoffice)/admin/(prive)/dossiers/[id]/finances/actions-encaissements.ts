'use server';
// MVP2-05 (lot A) : actions de l'onglet Finances — Encaissements et annulations. Les droits sont
// revérifiés côté serveur à chaque appel (lib/encaissements/service.ts) ; `dossierId` ne sert
// qu'au rafraîchissement de la page.
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { STATUTS } from '@/lib/dossiers/statuts';
import * as svc from '@/lib/encaissements/service';
import type { ResultatAction } from '@/components/backoffice/ui';

/** Résultat d'un enregistrement : en cas de doublon (RG-03), lien vers l'Encaissement existant. */
export type ResultatEncaissement = ResultatAction | { ok: false; erreur: string; lienDoublon: string };

async function acteur() {
  const c = await exigerCollaborateur({ permission: 'encaissement.enregistrer' });
  return { id: c.id, roles: c.roles, ip: c.ip };
}

const rafraichir = (dossierId: number) => {
  revalidatePath(`/admin/dossiers/${dossierId}`);
  revalidatePath('/admin/dossiers');
};

const texte = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function enregistrerEncaissement(dossierId: number, form: FormData): Promise<ResultatEncaissement> {
  let lienDoublon: string | null = null;
  const r = await executer(async () => {
    const a = await acteur();
    const fichier = form.get('justificatif');
    const justificatif = fichier instanceof File && fichier.size > 0 ? { nom: fichier.name, octets: new Uint8Array(await fichier.arrayBuffer()) } : null;
    const montant = Number(texte(form, 'montant').replace(/[\s  .]/g, ''));
    try {
      const res = await svc.enregistrerEncaissement(
        dossierId,
        {
          nature: texte(form, 'nature') as svc.SaisieEncaissementEntree['nature'],
          montant: Number.isFinite(montant) ? montant : NaN,
          moyen: texte(form, 'moyen') as svc.SaisieEncaissementEntree['moyen'],
          reference: texte(form, 'reference') || null,
          recuLe: texte(form, 'recuLe'),
          commentaire: texte(form, 'commentaire') || null,
        },
        justificatif,
        a,
      );
      rafraichir(dossierId);
      const recus = res.encaissements.map((e) => e.recuNumero).join(' et ');
      return [`Paiement enregistré — reçu ${recus}.`, res.transition ? `Le dossier passe à « ${STATUTS[res.transition]} ».` : '', ...res.informations].filter(Boolean).join(' ');
    } catch (e) {
      if (e instanceof svc.ErreurDoublon) lienDoublon = e.lien;
      throw e;
    }
  });
  if (!r.ok && lienDoublon) return { ...r, lienDoublon };
  return r;
}

export async function demanderAnnulation(dossierId: number, encaissementId: number, motif: string) {
  return executer(async () => {
    if (motif.length > 1000) throw new ErreurMetier('Motif trop long (1 000 caractères maximum).');
    await svc.demanderAnnulation(encaissementId, motif, await acteur());
    rafraichir(dossierId);
    return 'Demande d’annulation transmise au Responsable finances et à la Direction.';
  });
}

export async function annulerEncaissement(dossierId: number, encaissementId: number, motif: string) {
  return executer(async () => {
    if (motif.length > 1000) throw new ErreurMetier('Motif trop long (1 000 caractères maximum).');
    const r = await svc.annulerEncaissement(encaissementId, motif, await acteur());
    rafraichir(dossierId);
    return ['Encaissement annulé : écriture inverse enregistrée, reçu marqué « annulé ».', r.avertissement ?? ''].filter(Boolean).join(' ');
  });
}

export async function traiterDemandeAnnulation(dossierId: number, demandeId: number, decision: 'accepter' | 'refuser', reponse: string) {
  return executer(async () => {
    if (reponse.length > 1000) throw new ErreurMetier('Réponse trop longue (1 000 caractères maximum).');
    const r = await svc.traiterDemandeAnnulation(demandeId, decision === 'accepter' ? 'accepter' : 'refuser', reponse || null, await acteur());
    rafraichir(dossierId);
    return decision === 'accepter' ? ['Encaissement annulé.', r?.avertissement ?? ''].filter(Boolean).join(' ') : 'Demande refusée ; le demandeur est prévenu.';
  });
}
