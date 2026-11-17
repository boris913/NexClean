// POST-03 RG-15 : export CSV pour le comptable (factures, avoirs, dépenses de la période).
// Permission `export.donnees` ; journalisé (lib/depenses/indicateurs.ts).
import { NextResponse } from 'next/server';
import { collaborateurCourant } from '@/lib/authz/session';
import { exige2FA, peut } from '@/lib/authz/permissions';
import { journaliser } from '@/lib/audit';
import { dateDuJour } from '@/lib/encaissements/domaine';
import { nomFichierExport, periodeDepuis } from '@/lib/depenses/domaine';
import { exporterComptable } from '@/lib/depenses/indicateurs';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const c = await collaborateurCourant();
  if (!c) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 });
  if ((exige2FA(c.roles) && !c.deuxFacteurs) || !peut(c.roles, 'export.donnees')) {
    await journaliser({ acteurType: 'collaborateur', acteurId: c.id, ip: c.ip, action: 'acces.refuse', details: { permission: 'export.donnees', export: 'comptable' } });
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
  }
  const q = new URL(req.url).searchParams;
  const periode = periodeDepuis({ mois: q.get('mois'), du: q.get('du'), au: q.get('au') }, dateDuJour());
  const csv = await exporterComptable(periode, { id: c.id, ip: c.ip });
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomFichierExport(periode)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
