// RG-09 : CV d'un profil transmis, filigrané, servi via la page de suivi.
import { servirCv } from '../../reponses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jeton: string; propositionId: string }> }) {
  const { jeton, propositionId } = await params;
  return servirCv('suivi', jeton, propositionId);
}
