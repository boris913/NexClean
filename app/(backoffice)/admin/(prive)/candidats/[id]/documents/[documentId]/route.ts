// MVP2-02 RG-13 : téléchargement d'un CV ou justificatif candidat par un collaborateur ayant accès
// au vivier ; refus journalisé, téléchargement journalisé (`candidat.cv_telecharge`).
import { NextResponse } from 'next/server';
import { journaliser } from '@/lib/audit';
import { exige2FA } from '@/lib/authz/permissions';
import { collaborateurCourant } from '@/lib/authz/session';
import { peutAccederVivier } from '@/lib/candidats/acces';
import { lireDocumentPourCollaborateur } from '@/lib/candidats/fiche';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const c = await collaborateurCourant();
  if (!c) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 });
  const p = await params;
  const candidatId = Number(p.id);
  const documentId = Number(p.documentId);
  if (!Number.isInteger(candidatId) || candidatId <= 0 || !Number.isInteger(documentId) || documentId <= 0) return NextResponse.json({ erreur: 'Document introuvable' }, { status: 404 });
  if ((exige2FA(c.roles) && !c.deuxFacteurs) || !(await peutAccederVivier(c))) {
    await journaliser({ acteurType: 'collaborateur', acteurId: c.id, action: 'acces.refuse', details: { permission: 'candidat.voir', vivier: true, candidatId, documentId }, ip: c.ip });
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
  }
  const doc = await lireDocumentPourCollaborateur(candidatId, documentId, { id: c.id, roles: c.roles, ip: c.ip });
  if (!doc) return NextResponse.json({ erreur: 'Document introuvable' }, { status: 404 });
  return new Response(Buffer.from(doc.octets), {
    headers: {
      'Content-Type': doc.mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.nom)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
