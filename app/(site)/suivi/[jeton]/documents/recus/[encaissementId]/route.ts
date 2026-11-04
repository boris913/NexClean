// MVP2-05 RG-04, RG-15 : PDF du reçu d'un paiement du Dossier (contrôle du jeton et du cookie de
// vérification ; le reçu doit appartenir au Dossier du jeton).
import { servirDocumentSuivi } from '../../../reponses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jeton: string; encaissementId: string }> }) {
  const { jeton, encaissementId } = await params;
  return servirDocumentSuivi(jeton, { type: 'recu', id: encaissementId });
}
