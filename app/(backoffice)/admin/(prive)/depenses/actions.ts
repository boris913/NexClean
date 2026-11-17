'use server';
// POST-03 : saisie, modification et annulation des dépenses (Responsable finances, Direction).
// Les droits sont revérifiés côté serveur (exigerCollaborateur, puis lib/depenses/service.ts).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { annulerDepense, creerDepense, modifierDepense, type ActeurDepense, type FichierJustificatif } from '@/lib/depenses/service';
import type { EntreeDepense } from '@/lib/depenses/domaine';
import type { ResultatAction } from '@/components/backoffice/ui';

async function acteur(): Promise<ActeurDepense> {
  const c = await exigerCollaborateur({ permission: 'depense.saisir' });
  return { id: c.id, roles: c.roles, ip: c.ip };
}

const texte = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
const entier = (v: FormDataEntryValue | null): number | null => {
  // « 15 000 », « 15000 » : espaces et séparateurs de milliers retirés.
  const s = texte(v).replace(/[\s.  ]/g, '');
  return s === '' ? null : /^\d+$/.test(s) ? Number(s) : Number.NaN;
};

function lireEntree(form: FormData): EntreeDepense {
  return {
    depenseLe: texte(form.get('depenseLe')),
    categorieId: entier(form.get('categorieId')) as number,
    libelle: texte(form.get('libelle')),
    montant: entier(form.get('montant')) as number,
    moyen: texte(form.get('moyen')) as EntreeDepense['moyen'],
    reference: texte(form.get('reference')) || null,
    villeId: entier(form.get('villeId')),
    dossierNumero: texte(form.get('dossierNumero')) || null,
    service: (texte(form.get('service')) || null) as EntreeDepense['service'],
    commentaire: texte(form.get('commentaire')) || null,
  };
}

async function lireFichier(form: FormData): Promise<FichierJustificatif | null> {
  const f = form.get('justificatif');
  if (!(f instanceof File) || f.size === 0) return null;
  return { nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) };
}

export async function creer(form: FormData): Promise<ResultatAction> {
  let id: number | null = null;
  const r = await executer(async () => {
    const a = await acteur();
    id = await creerDepense(lireEntree(form), await lireFichier(form), a);
    revalidatePath('/admin/depenses');
    revalidatePath('/admin/pilotage');
  });
  if (r.ok && id !== null) redirect(form.get('suivante') === '1' ? `/admin/depenses/nouvelle?enregistree=${id}` : `/admin/depenses/${id}?cree=1`);
  return r;
}

export async function modifier(id: number, form: FormData): Promise<ResultatAction> {
  return executer(async () => {
    const a = await acteur();
    const fichier = await lireFichier(form);
    if (fichier && form.get('retirerJustificatif') === 'on') throw new ErreurMetier('Choisissez : remplacer le justificatif ou le retirer.');
    await modifierDepense(id, lireEntree(form), fichier ?? (form.get('retirerJustificatif') === 'on' ? 'retirer' : null), a);
    revalidatePath('/admin/depenses');
    revalidatePath(`/admin/depenses/${id}`);
    revalidatePath('/admin/pilotage');
    return 'Dépense enregistrée.';
  });
}

export async function annuler(id: number, motif: string): Promise<ResultatAction> {
  return executer(async () => {
    await annulerDepense(id, motif, await acteur());
    revalidatePath('/admin/depenses');
    revalidatePath(`/admin/depenses/${id}`);
    revalidatePath('/admin/pilotage');
    return 'Dépense annulée : elle ne compte plus dans les indicateurs.';
  });
}
