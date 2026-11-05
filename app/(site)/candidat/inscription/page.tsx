// MVP2-01 RG-01..05 : inscription gratuite des demandeurs d'emploi.
import type { Metadata } from 'next';
import Link from 'next/link';
import { lireCouverture } from '@/lib/geo/couverture';
import { pageMetadata } from '@/lib/seo';
import { listesLieux } from '@/lib/geo/service';
import { lireParametre } from '@/lib/parametres';
import { MENTION_GRATUITE } from '@/lib/candidats/domaine';
import { candidatConnecte } from '@/lib/candidats/session';
import Coque from '../Coque';
import FormulaireCandidat from '../FormulaireCandidat';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Créer mon profil candidat — emploi à ${villes}`,
    description: 'Inscrivez-vous gratuitement : créez votre profil candidat, postulez aux offres et soyez présenté à des employeurs, toujours avec votre accord.',
    path: '/candidat/inscription',
  });
}

export default async function PageInscription() {
  const [listes, metiers, connecte] = await Promise.all([listesLieux(), lireParametre('metiers'), candidatConnecte()]);
  return (
    <Coque
      surtitre="Emploi"
      titre="Créer mon profil candidat"
      large
      intro={
        <>
          <p>
            <strong className="text-ink-900">{MENTION_GRATUITE}</strong>
          </p>
          <p className="text-sm mt-2">
            Déjà inscrit(e) ?{' '}
            <Link href="/candidat/connexion" className="text-primary underline font-semibold">
              Se connecter
            </Link>
          </p>
        </>
      }
    >
      <FormulaireCandidat mode="inscription" listes={listes} metiers={metiers} dejaConnecte={!!connecte} />
    </Coque>
  );
}
