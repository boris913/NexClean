// POST-03 RG-07 : justificatif d'une dépense, servi après contrôle des droits (`depense.saisir`)
// et de la 2FA ; lectures et refus journalisés (lib/depenses/service.ts).
import { NextResponse } from 'next/server';
import { exige2FA } from '@/lib/authz/permissions';
import { collaborateurCourant } from '@/lib/authz/session';
import { ErreurAccesDepense, lireJustificatif } from '@/lib/depenses/service';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await collaborateurCourant();
  if (!c) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 });
  if (exige2FA(c.roles) && !c.deuxFacteurs) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ erreur: 'Justificatif introuvable' }, { status: 404 });
  try {
    const f = await lireJustificatif(id, { id: c.id, roles: c.roles, ip: c.ip });
    if (!f) return NextResponse.json({ erreur: 'Justificatif introuvable' }, { status: 404 });
    return new Response(Buffer.from(f.octets), {
      headers: {
        'Content-Type': f.mime,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.nom)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    if (e instanceof ErreurAccesDepense) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
    throw e;
  }
}
