// MVP2-01 RG-15..18 : demande de suppression du compte et des données.
import type { Metadata } from 'next';
import Link from 'next/link';
import { cardClasses } from '@/components/ui/Card';
import { JOURS_AVANT_SUPPRESSION } from '@/lib/candidats/domaine';
import { candidatConnecte } from '@/lib/candidats/session';
import Coque from '../../Coque';
import FormulaireSuppression from './FormulaireSuppression';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Supprimer mon compte', robots: { index: false, follow: false } };

export default async function PageSupprimer() {
  // Pas de redirection ici : après la demande, la session est fermée et la page se rafraîchit ;
  // le formulaire doit rester affiché pour montrer la date de suppression.
  const connecte = !!(await candidatConnecte());
  return (
    <Coque
      titre="Supprimer mon compte"
      intro={
        <p className="text-sm">
          <Link href="/candidat/espace" className="text-primary underline">
            ← Mon espace
          </Link>
        </p>
      }
    >
      <div className={cardClasses({ padding: 'sm', className: 'space-y-4 text-sm text-ink-700' })}>
        <div>
          <p className="font-semibold text-ink-900">Ce qui se passe</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Votre compte est bloqué immédiatement : vous ne pouvez plus vous connecter et vous n’êtes plus proposé(e) pour des offres.</li>
            <li>
              Votre profil, vos expériences, votre CV et vos justificatifs sont supprimés définitivement au bout de {JOURS_AVANT_SUPPRESSION} jours. Pendant ce délai,
              vous pouvez annuler en contactant NEXCLEAN sur WhatsApp.
            </li>
            <li>Les copies de sauvegarde sont effacées dans les 30 jours qui suivent.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink-900">Ce qui est conservé</p>
          <p className="mt-1">
            Si vous avez été placé(e) chez un employeur, la trace de ce placement et les pièces comptables sont conservées sans votre nom (obligations légales), sous un
            pseudonyme du type « Candidat #8F3A ».
          </p>
        </div>
        <FormulaireSuppression connecte={connecte} />
      </div>
    </Coque>
  );
}
