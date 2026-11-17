'use server';
// POST-05 : enregistrement, retour à une version et aperçu des modèles de documents (modeles.gerer).
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { lireParametre } from '@/lib/parametres';
import { apercuPdf } from '@/lib/documents/apercu';
import { estTypeDocument, type ContenuModele, type TypeDocument } from '@/lib/documents/personnalisation';
import { contenuValide, enregistrerModeleDocument, restaurerVersion, schemaContenuModele } from '@/lib/documents/versions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import type { ResultatAction } from '@/components/backoffice/ui';

function typeValide(type: unknown): TypeDocument {
  if (!estTypeDocument(type)) throw new ErreurMetier('Type de document inconnu.');
  return type;
}

const revalider = (type: TypeDocument) => {
  revalidatePath('/admin/modeles/documents');
  revalidatePath(`/admin/modeles/documents/${type}`);
};

export async function enregistrer(type: TypeDocument, versionBase: number, contenu: ContenuModele, commentaire: string) {
  return executer(async () => {
    const c = await exigerCollaborateur({ permission: 'modeles.gerer' });
    const t = typeValide(type);
    const version = await enregistrerModeleDocument({ type: t, versionBase, contenu, commentaire }, { id: c.id, ip: c.ip });
    revalider(t);
    return `Version ${version} enregistrée : elle s’applique aux documents produits à partir de maintenant.`;
  });
}

export async function restaurer(type: TypeDocument, version: number) {
  return executer(async () => {
    const c = await exigerCollaborateur({ permission: 'modeles.gerer' });
    const t = typeValide(type);
    const nouvelle = await restaurerVersion(t, version, { id: c.id, ip: c.ip });
    revalider(t);
    return `Version ${nouvelle} créée à partir de la version ${version}.`;
  });
}

/** RG-13 : aperçu du contenu saisi (non enregistré), avec des données d'exemple. PDF en base64. */
export async function apercu(type: TypeDocument, contenu: ContenuModele): Promise<ResultatAction & { pdf?: string }> {
  let pdf = '';
  const r = await executer(async () => {
    await exigerCollaborateur({ permission: 'modeles.gerer' });
    const t = typeValide(type);
    const propre = contenuValide(t, schemaContenuModele.parse(contenu));
    pdf = Buffer.from(await apercuPdf(t, propre, await lireParametre('mentions_legales'))).toString('base64');
  });
  return r.ok ? { ...r, pdf } : r;
}
