// Version du code en service : identifiant du commit déployé, fourni par Coolify (SOURCE_COMMIT).
// Sert à la CI pour confirmer que le déploiement est bien en ligne. Le dépôt étant public,
// l'identifiant du commit n'est pas une information sensible.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ commit: process.env.SOURCE_COMMIT ?? 'inconnu' }, { headers: { 'Cache-Control': 'no-store' } });
}
