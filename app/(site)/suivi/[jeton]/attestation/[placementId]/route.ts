// RG-15 : attestation de prise de poste téléchargée depuis la page de suivi.
import { servirAttestation } from '../../reponses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jeton: string; placementId: string }> }) {
  const { jeton, placementId } = await params;
  return servirAttestation('suivi', jeton, placementId);
}
