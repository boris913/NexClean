// COM2-01 RG-03 : média d'un message WhatsApp, après contrôle d'accès ; journalisé.
import { NextResponse } from 'next/server';
import { collaborateurCourant } from '@/lib/authz/session';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { lireMedia } from '@/lib/whatsapp/lecture';

export const runtime = 'nodejs';
/** Types affichés dans le navigateur ; les autres sont téléchargés. */
const AFFICHABLES = /^(image\/(jpeg|png|webp)|audio\/|video\/mp4|application\/pdf)/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await collaborateurCourant();
  if (!c) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ erreur: 'Introuvable' }, { status: 404 });
  try {
    const m = await lireMedia(id, { id: c.id, roles: c.roles, ip: c.ip });
    const affichable = AFFICHABLES.test(m.mime);
    return new Response(Buffer.from(m.octets), {
      headers: {
        'Content-Type': affichable ? m.mime : 'application/octet-stream',
        'Content-Disposition': `${affichable ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(m.nom)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'",
      },
    });
  } catch (e) {
    if (e instanceof ErreurMetier) return NextResponse.json({ erreur: e.message }, { status: e.message.startsWith('Accès') ? 403 : 404 });
    throw e;
  }
}
