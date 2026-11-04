// MVP2-03 RG-03 : capture de l'accord WhatsApp d'une Proposition, lue par le référent du Dossier ou
// la Direction. Refus et lectures journalisés (lib/propositions/service.ts).
import { NextResponse } from 'next/server';
import { exige2FA } from '@/lib/authz/permissions';
import { collaborateurCourant } from '@/lib/authz/session';
import { ErreurAccesDossier } from '@/lib/dossiers/service';
import { lirePreuveAccord } from '@/lib/propositions/service';
import { reponseFichier } from '../../../reponse-preuve';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; propositionId: string }> }) {
  const c = await collaborateurCourant();
  if (!c) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 });
  if (exige2FA(c.roles) && !c.deuxFacteurs) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
  const p = await params;
  const dossierId = Number(p.id);
  const propositionId = Number(p.propositionId);
  if (!Number.isInteger(dossierId) || dossierId <= 0 || !Number.isInteger(propositionId) || propositionId <= 0) return NextResponse.json({ erreur: 'Preuve introuvable' }, { status: 404 });
  try {
    const f = await lirePreuveAccord(dossierId, propositionId, { id: c.id, roles: c.roles, ip: c.ip });
    if (!f) return NextResponse.json({ erreur: 'Preuve introuvable' }, { status: 404 });
    return reponseFichier(f);
  } catch (e) {
    if (e instanceof ErreurAccesDossier) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 });
    throw e;
  }
}
