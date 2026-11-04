// MVP2-04 RG-15 : capture de l'acceptation WhatsApp d'un devis, lue par le référent du Dossier ou la
// Direction. Refus et lectures journalisés (lib/devis/service.ts).
import { NextResponse } from 'next/server';
import { exige2FA } from '@/lib/authz/permissions';
import { collaborateurCourant } from '@/lib/authz/session';
import { ErreurAccesDossier } from '@/lib/dossiers/service';
import { lirePreuveAcceptation } from '@/lib/devis/service';
import { reponseFichier } from '../../../reponse-preuve';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; devisId: string }> }) {
  const c = await collaborateurCourant();
  if (!c) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 });
  if (exige2FA(c.roles) && !c.deuxFacteurs) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
  const p = await params;
  const dossierId = Number(p.id);
  const devisId = Number(p.devisId);
  if (!Number.isInteger(dossierId) || dossierId <= 0 || !Number.isInteger(devisId) || devisId <= 0) return NextResponse.json({ erreur: 'Preuve introuvable' }, { status: 404 });
  try {
    const f = await lirePreuveAcceptation(dossierId, devisId, { id: c.id, roles: c.roles, ip: c.ip });
    if (!f) return NextResponse.json({ erreur: 'Preuve introuvable' }, { status: 404 });
    return reponseFichier(f);
  } catch (e) {
    if (e instanceof ErreurAccesDossier) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
    throw e;
  }
}
