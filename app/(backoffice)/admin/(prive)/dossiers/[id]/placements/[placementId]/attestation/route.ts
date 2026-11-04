// MVP2-03 RG-15 : attestation de prise de poste pré-remplie (PDF), téléchargée par le référent du
// Dossier ou la Direction. Refus et téléchargements journalisés.
import { NextResponse } from 'next/server';
import { journaliser } from '@/lib/audit';
import { exige2FA } from '@/lib/authz/permissions';
import { collaborateurCourant } from '@/lib/authz/session';
import { peutTraiter } from '@/lib/dossiers/acces';
import { donneesAttestation, nomFichierAttestation } from '@/lib/propositions/client';
import { genererAttestation } from '@/lib/propositions/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; placementId: string }> }) {
  const c = await collaborateurCourant();
  if (!c) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 });
  const p = await params;
  const dossierId = Number(p.id);
  const placementId = Number(p.placementId);
  if (!Number.isInteger(dossierId) || dossierId <= 0 || !Number.isInteger(placementId) || placementId <= 0) return NextResponse.json({ erreur: 'Placement introuvable' }, { status: 404 });
  const d = await donneesAttestation(placementId);
  if (!d || d.dossierId !== dossierId) return NextResponse.json({ erreur: 'Placement introuvable' }, { status: 404 });
  if ((exige2FA(c.roles) && !c.deuxFacteurs) || !peutTraiter(c, d.referentId)) {
    await journaliser({ acteurType: 'collaborateur', acteurId: c.id, action: 'acces.refuse', objetType: 'placement', objetId: placementId, details: { dossierId, attestation: true }, ip: c.ip });
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
  }
  const octets = await genererAttestation(d);
  await journaliser({ acteurType: 'collaborateur', acteurId: c.id, action: 'placement.attestation_generee', objetType: 'placement', objetId: placementId, details: { dossierId }, ip: c.ip });
  return new Response(Buffer.from(octets), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nomFichierAttestation(d.numeroDossier, d.candidatPrenom))}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
