// RG-15 : attestation de prise de poste servie via un lien d'accès temporaire.
import { servirAttestation } from '../../../../suivi/[jeton]/reponses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jeton: string; placementId: string }> }) {
  const { jeton, placementId } = await params;
  return servirAttestation('profil', jeton, placementId);
}
