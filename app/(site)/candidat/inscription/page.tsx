// MVP2-01 RG-01..05 : inscription gratuite des demandeurs d'emploi.
import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { listesLieux } from '@/lib/geo/service';
import { lireParametre } from '@/lib/parametres';
import { MENTION_GRATUITE } from '@/lib/candidats/domaine';
import { candidatConnecte } from '@/lib/candidats/session';
import Coque from '../Coque';
import FormulaireCandidat from '../FormulaireCandidat';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Inscription candidat — trouvez un emploi avec NEXCLEAN',
  description:
    'Inscrivez-vous gratuitement : agents d’entretien, serveurs, cuisiniers, gardiens, nounous, vendeurs… NEXCLEAN vous propose des emplois qui vous correspondent à Douala et Yaoundé.',
  path: '/candidat/inscription',
});

export default async function PageInscription() {
  const [listes, metiers, connecte] = await Promise.all([listesLieux(), lireParametre('metiers'), candidatConnecte()]);
  return (
    <Coque
      surtitre="Recrutement"
      titre="Créer mon profil candidat"
      large
      intro={
        <>
          <p>
            <strong className="text-ink-900">{MENTION_GRATUITE}</strong> Remplissez votre profil en quelques minutes : un conseiller vous contacte quand une offre vous correspond.
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
