// MVP2-04 RG-16, RG-19 : accusé de réception du Dossier REC, archivé au premier téléchargement.
import { servirDocumentSuivi } from '../../reponses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  return servirDocumentSuivi(jeton, { type: 'accuse_reception' });
}
