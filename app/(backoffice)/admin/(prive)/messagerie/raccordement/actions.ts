'use server';
// ADR 0025 : fin de l'inscription intégrée Meta, côté serveur (Direction).
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { lireSessionInscription, raccorderNumero, type ResultatRaccordement } from '@/lib/whatsapp/raccordement';

export async function terminerRaccordement(code: string, sessionBrute: unknown): Promise<{ ok: true; resultat: ResultatRaccordement } | { ok: false; erreur: string }> {
  let resultat: ResultatRaccordement | null = null;
  const r = await executer(async () => {
    const c = await exigerCollaborateur({ permission: 'whatsapp.raccorder' });
    // La session est relue côté serveur : rien de ce que transmet le navigateur n'est pris tel quel.
    resultat = await raccorderNumero({ code: String(code ?? ''), session: lireSessionInscription(sessionBrute) }, { id: c.id, ip: c.ip });
    revalidatePath('/admin/messagerie/raccordement');
  });
  return r.ok && resultat ? { ok: true, resultat } : { ok: false, erreur: r.ok ? 'Raccordement incomplet.' : r.erreur };
}
