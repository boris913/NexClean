// Export « Mes données » (ADR 0017 §6, specs/POST-04 RG-09..14) : JSON ou PDF, pour le seul
// candidat connecté (session de l'espace candidat, ADR 0024), limité et journalisé.
import { ipDepuisEnTetes } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { estFormatExport, MESSAGE_LIMITE_EXPORT } from '@/lib/candidats/donnees';
import { exporterDonnees } from '@/lib/candidats/export';
import { candidatConnecte } from '@/lib/candidats/session';

export const dynamic = 'force-dynamic';

const texte = (message: string, status: number) => new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' } });

export async function GET(req: Request) {
  const c = await candidatConnecte();
  if (!c) return texte('Connexion requise.', 401);
  const format = new URL(req.url).searchParams.get('format');
  if (!estFormatExport(format)) return texte('Format inconnu : json ou pdf.', 400);
  try {
    const f = await exporterDonnees(c.id, format, ipDepuisEnTetes(req.headers));
    return new Response(new Blob([new Uint8Array(f.octets)], { type: f.mime }), {
      headers: {
        'Content-Type': f.mime,
        'Content-Disposition': `attachment; filename="${f.nom}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    if (e instanceof ErreurMetier) return texte(e.message, e.message === MESSAGE_LIMITE_EXPORT ? 429 : 404);
    throw e;
  }
}
