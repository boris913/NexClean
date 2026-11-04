// MVP2-04 RG-17, RG-19 : PDF d'une facture ou d'un avoir du Dossier.
import { servirDocumentSuivi } from '../../../reponses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jeton: string; factureId: string }> }) {
  const { jeton, factureId } = await params;
  return servirDocumentSuivi(jeton, { type: 'facture', id: factureId });
}
