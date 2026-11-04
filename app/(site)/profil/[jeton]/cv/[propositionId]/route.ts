// RG-09, RG-10 : CV filigrané servi via un lien d'accès temporaire.
import { servirCv } from '../../../../suivi/[jeton]/reponses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jeton: string; propositionId: string }> }) {
  const { jeton, propositionId } = await params;
  return servirCv('profil', jeton, propositionId);
}
