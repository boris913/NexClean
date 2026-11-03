// Sessions de l'espace candidat (ADR 0024) : cookie « nexclean_candidat », jeton de 256 bits dont
// seule l'empreinte est stockée ; 30 jours avec « rester connecté », 24 h sinon. Indépendant de
// Better Auth : une session candidat n'ouvre jamais le Back-Office.
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, schema } from '@/lib/db';
import { env } from '@/lib/env';
import { empreinteJeton, genererJeton } from '@/lib/collaborateurs/jetons';

export const COOKIE_CANDIDAT = 'nexclean_candidat';
export const DUREE_SESSION_LONGUE_MS = 30 * 24 * 60 * 60 * 1000;
export const DUREE_SESSION_COURTE_MS = 24 * 60 * 60 * 1000;

const securise = () => env().BETTER_AUTH_URL.startsWith('https://');

/** Ouvre une session et pose le cookie. */
export async function ouvrirSession(candidatId: number, resterConnecte: boolean, ip: string | null): Promise<void> {
  const jeton = genererJeton();
  const duree = resterConnecte ? DUREE_SESSION_LONGUE_MS : DUREE_SESSION_COURTE_MS;
  const expireLe = new Date(Date.now() + duree);
  const db = getDb();
  // Ménage : sessions expirées de ce candidat.
  await db.delete(schema.candidatSession).where(and(eq(schema.candidatSession.candidatId, candidatId), lt(schema.candidatSession.expireLe, new Date())));
  await db.insert(schema.candidatSession).values({ empreinte: empreinteJeton(jeton), candidatId, expireLe, ip });
  await db.update(schema.candidat).set({ derniereConnexionLe: new Date() }).where(eq(schema.candidat.id, candidatId));
  (await cookies()).set(COOKIE_CANDIDAT, jeton, {
    httpOnly: true,
    secure: securise(),
    sameSite: 'lax',
    path: '/',
    // Sans « rester connecté », cookie de session du navigateur (la base fait foi pour les 24 h).
    ...(resterConnecte ? { expires: expireLe } : {}),
  });
}

/** Candidat connecté, ou null (session absente, expirée, ou compte en cours de suppression). */
export async function candidatConnecte(): Promise<{ id: number; prenom: string; nom: string } | null> {
  const jeton = (await cookies()).get(COOKIE_CANDIDAT)?.value;
  if (!jeton) return null;
  const [ligne] = await getDb()
    .select({ id: schema.candidat.id, prenom: schema.candidat.prenom, nom: schema.candidat.nom })
    .from(schema.candidatSession)
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.candidatSession.candidatId))
    .where(
      and(
        eq(schema.candidatSession.empreinte, empreinteJeton(jeton)),
        gt(schema.candidatSession.expireLe, new Date()),
        isNull(schema.candidat.suppressionDemandeeLe),
        isNull(schema.candidat.supprimeLe),
      ),
    );
  return ligne ?? null;
}

/** Pour les pages et actions de l'espace candidat : renvoie vers la connexion sans session valide. */
export async function exigerCandidat() {
  const c = await candidatConnecte();
  if (!c) redirect('/candidat/connexion');
  return c;
}

/** Ferme la session courante (déconnexion). */
export async function fermerSession(): Promise<void> {
  const jar = await cookies();
  const jeton = jar.get(COOKIE_CANDIDAT)?.value;
  if (jeton) await getDb().delete(schema.candidatSession).where(eq(schema.candidatSession.empreinte, empreinteJeton(jeton)));
  jar.delete(COOKIE_CANDIDAT);
}

/** Ferme toutes les sessions d'un candidat (mot de passe changé, suppression demandée). */
export async function fermerToutesLesSessions(candidatId: number, tx: Pick<ReturnType<typeof getDb>, 'delete'> = getDb()): Promise<void> {
  await tx.delete(schema.candidatSession).where(eq(schema.candidatSession.candidatId, candidatId));
}
