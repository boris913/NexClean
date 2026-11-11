// COM1-02 RG-08 : export CSV du tableau de bord commercial (permission export.donnees), journalisé.
import { NextResponse } from 'next/server';
import { collaborateurCourant } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { bornesPeriode, PERIODES, type Periode } from '@/lib/dossiers/compteurs';
import { dateLocale } from '@/lib/dossiers/heures-ouvrees';
import { exporterCsv } from '@/lib/commercial/service';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const c = await collaborateurCourant();
  if (!c) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 });
  if (!peut(c.roles, 'export.donnees') || !peut(c.roles, 'commercial.tableau_de_bord')) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
  const p = new URL(req.url).searchParams.get('periode');
  const periode: Periode = p && p in PERIODES ? (p as Periode) : 'mois';
  const bornes = bornesPeriode(periode);
  const csv = await exporterCsv(bornes, { id: c.id, roles: c.roles, ip: c.ip });
  const nom = `nexclean-commercial-${dateLocale(bornes.du)}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nom}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
