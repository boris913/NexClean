// Téléchargement d'un document par son propriétaire (espace candidat, ADR 0024).
import { lireDocument } from '@/lib/candidats/service';
import { candidatConnecte } from '@/lib/candidats/session';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await candidatConnecte();
  if (!c) return new Response('Connexion requise', { status: 401 });
  const id = Number((await params).id);
  const d = Number.isInteger(id) && id > 0 ? await lireDocument(c.id, id) : null;
  if (!d) return new Response('Document introuvable', { status: 404 });
  return new Response(new Blob([new Uint8Array(d.octets)], { type: d.mime }), {
    headers: {
      'Content-Type': d.mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(d.nom)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
