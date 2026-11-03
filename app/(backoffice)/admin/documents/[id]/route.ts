// M1-DOC-04 : téléchargement d'un document, uniquement après contrôle des droits ; journalisé.
import { NextResponse } from 'next/server';
import { collaborateurCourant } from '@/lib/authz/session';
import { ErreurAccesDossier, lireDocument } from '@/lib/dossiers/service';
import { ErreurMetier } from '@/lib/collaborateurs/service';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await collaborateurCourant();
  if (!c) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ erreur: 'Document introuvable' }, { status: 404 });
  try {
    const doc = await lireDocument(id, { id: c.id, roles: c.roles, ip: c.ip });
    return new Response(Buffer.from(doc.octets), {
      headers: {
        'Content-Type': doc.mime,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.nom)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    if (e instanceof ErreurAccesDossier) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
    if (e instanceof ErreurMetier) return NextResponse.json({ erreur: e.message }, { status: 404 });
    throw e;
  }
}
