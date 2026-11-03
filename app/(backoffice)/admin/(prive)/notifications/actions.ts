'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { marquerLue, marquerToutesLues } from '@/lib/notifications';

export async function ouvrirNotification(id: number) {
  const c = await exigerCollaborateur({ sans2FA: true });
  const lien = await marquerLue(id, c.id);
  revalidatePath('/admin', 'layout');
  // Seuls les chemins internes du Back-Office sont suivis.
  redirect(lien && lien.startsWith('/admin') ? lien : '/admin/notifications');
}

export async function toutMarquerLu() {
  const c = await exigerCollaborateur({ sans2FA: true });
  await marquerToutesLues(c.id);
  revalidatePath('/admin', 'layout');
}
