'use server';
// COM2-01 RG-07 : rattachement d'une conversation, droits revérifiés côté serveur.
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { getDb, schema } from '@/lib/db';
import { rattacherConversation } from '@/lib/whatsapp/lecture';

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
