'use server';
// COM2-01 RG-07 : rattachement d'une conversation, droits revérifiés côté serveur.
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { getDb, schema } from '@/lib/db';
import { rattacherConversation } from '@/lib/whatsapp/lecture';
import * as envoi from '@/lib/whatsapp/envoi';
import { ErreurEnvoi } from '@/lib/whatsapp/envoi';

export async function rattacher(conversationId: number, numeroDossier: string) {
  return executer(async () => {
    const c = await exigerCollaborateur();
    const numero = numeroDossier.trim().toUpperCase();
    const [d] = await getDb().select({ id: schema.dossier.id }).from(schema.dossier).where(eq(schema.dossier.numero, numero));
    if (!d) throw new ErreurMetier(`Aucun dossier ${numero}.`);
    await rattacherConversation(conversationId, d.id, { id: c.id, roles: c.roles, ip: c.ip });
    revalidatePath(`/admin/messagerie/${conversationId}`);
    revalidatePath(`/admin/dossiers/${d.id}`);
    return `Conversation rattachée à ${numero}.`;
  });
}

// ─── COM2-02 : réponses depuis le Back-Office ─────────────────

export type ResultatEnvoi = { ok: true; message?: string } | { ok: false; erreur: string; repli?: string };

async function acteurMessagerie() {
  const c = await exigerCollaborateur();
  return { id: c.id, roles: c.roles, ip: c.ip, nom: c.nom };
}

/** Comme `executer`, en conservant le lien de repli wa.me d'un échec d'envoi (RG-04). */
async function executerEnvoi(conversationId: number, fn: () => Promise<string>): Promise<ResultatEnvoi> {
  try {
    const message = await fn();
    revalidatePath(`/admin/messagerie/${conversationId}`);
    revalidatePath('/admin/messagerie');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof ErreurEnvoi) return { ok: false, erreur: e.message, repli: e.repli };
    return executer(async () => {
      throw e;
    }) as Promise<ResultatEnvoi>;
  }
}

export async function envoyerTexte(conversationId: number, texte: string) {
  return executerEnvoi(conversationId, async () => {
    await envoi.envoyerTexte(conversationId, texte, await acteurMessagerie());
    return 'Message envoyé.';
  });
}

export async function envoyerModele(conversationId: number, modeleId: number) {
  return executerEnvoi(conversationId, async () => {
    await envoi.envoyerModele(conversationId, modeleId, await acteurMessagerie());
    return 'Modèle envoyé.';
  });
}

export async function changerAutomate(conversationId: number, mode: 'actif' | 'manuel') {
  return executer(async () => {
    await envoi.changerAutomate(conversationId, mode, await acteurMessagerie());
    revalidatePath(`/admin/messagerie/${conversationId}`);
    return mode === 'manuel' ? 'Réponses automatiques arrêtées pour cette conversation.' : 'Réponses automatiques réactivées.';
  });
}

export async function enregistrerAccord(conversationId: number, numero: string, formulation: string, canal: string) {
  return executer(async () => {
    const a = await acteurMessagerie();
    const lec = await import('@/lib/whatsapp/lecture');
    if (!(await lec.lireConversation(conversationId, a))) throw new ErreurMetier('Accès refusé.');
    await envoi.enregistrerAccord(numero, formulation, canal, a);
    revalidatePath(`/admin/messagerie/${conversationId}`);
    return 'Accord enregistré.';
  });
}
