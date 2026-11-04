// Réponse HTTP d'un fichier de preuve (affichage dans le navigateur, jamais mis en cache).
import type { FichierLu } from '@/lib/propositions/service';

export function reponseFichier(f: FichierLu): Response {
  return new Response(Buffer.from(f.octets), {
    headers: {
      'Content-Type': f.mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.nom)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
