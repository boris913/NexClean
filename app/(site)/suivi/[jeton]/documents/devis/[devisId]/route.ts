// MVP2-04 RG-12, RG-19 : PDF archivé d'un devis ou avenant envoyé au client.
import { servirDocumentSuivi } from '../../../reponses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jeton: string; devisId: string }> }) {
  const { jeton, devisId } = await params;
  return servirDocumentSuivi(jeton, { type: 'devis', id: devisId });
}
