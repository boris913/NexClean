// Exécution sécurisée des actions serveur : traduit les erreurs attendues en message
// affichable, sans masquer redirect() / forbidden() de Next.js.
import { z } from 'zod';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import type { ResultatAction } from '@/components/backoffice/ui';

function estInterruptionNext(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK') || digest === 'NEXT_NOT_FOUND');
}

export async function executer(fn: () => Promise<string | void>): Promise<ResultatAction> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    if (estInterruptionNext(e)) throw e;
    if (e instanceof ErreurMetier) return { ok: false, erreur: e.message };
    if (e instanceof z.ZodError) return { ok: false, erreur: e.issues.map((i) => i.message).join(' · ') };
    console.error(e);
    return { ok: false, erreur: 'Une erreur inattendue est survenue. Réessayez.' };
  }
}
