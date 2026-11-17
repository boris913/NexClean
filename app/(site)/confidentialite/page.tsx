import type { Metadata } from 'next';
import LegalPage from '@/components/ui/LegalPage';
import { COMPANY, CONTACT } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Politique de confidentialité',
  description: 'Comment NEXCLEAN collecte, utilise et protège vos données personnelles, y compris les données de candidature.',
  path: '/confidentialite',
});

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updated="novembre 2026">
      <p>
        {COMPANY.legalName} attache une grande importance à la protection de vos données personnelles. Cette politique explique
        quelles données nous collectons, pourquoi, et quels sont vos droits.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        {COMPANY.legalName}, {CONTACT.address} — <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
      </p>

      <h2>Demandes de devis et commandes</h2>
      <p>
        Les formulaires de devis et les boutons de commande ouvrent une conversation WhatsApp : les informations saisies
        (nom, téléphone, quartier, besoin) sont transmises via WhatsApp et utilisées uniquement pour répondre à votre demande,
        établir un devis, organiser l&apos;intervention ou la livraison. Elles sont conservées le temps de la relation commerciale.
      </p>

      <h2 id="whatsapp">Messages WhatsApp</h2>
      <p>
        Lorsque vous écrivez à NEXCLEAN sur WhatsApp, vos messages, les photos ou documents que vous envoyez et votre numéro
        de téléphone nous parviennent par l&apos;API WhatsApp Business de Meta. Ils sont enregistrés dans notre outil de gestion
        interne pour suivre votre demande et vous répondre. Seules les personnes de NEXCLEAN qui traitent les demandes y ont
        accès. Ces données ne sont ni vendues ni cédées à des tiers et ne servent pas à de la publicité. Elles sont conservées
        le temps de la relation commerciale.
      </p>
      <p>
        Pour aider notre équipe à répondre, le texte d&apos;une conversation peut être analysé par un service d&apos;intelligence
        artificielle (Anthropic), sans votre nom, votre numéro ni votre adresse e-mail. Vous pouvez répondre STOP à tout moment
        pour ne plus recevoir de messages de notre part.
      </p>

      <h2 id="candidatures">Candidatures</h2>
      <p>Lorsque vous postulez via la page Recrutement, nous collectons :</p>
      <ul>
        <li>vos coordonnées (nom, prénom, ville, quartier, téléphone, e-mail) ;</li>
        <li>les informations de votre candidature (poste, expérience, disponibilité, permis, message) ;</li>
        <li>votre CV.</li>
      </ul>
      <p>
        Ces données servent exclusivement à étudier votre candidature et à vous recontacter. Elles sont accessibles uniquement
        aux personnes chargées du recrutement chez NEXCLEAN, ne sont jamais publiées et ne sont pas cédées à des tiers.
        Après <strong>2 ans</strong> sans connexion ni mise à jour de votre part, nous vous demandons si vous souhaitez garder
        votre profil ; sans réponse sous 30 jours, il est anonymisé et vos documents sont supprimés. Vous pouvez aussi demander
        la suppression de vos données à tout moment. Les placements réalisés sont conservés sous un pseudonyme, pour nos
        obligations comptables.
      </p>

      <h2>Mesure d&apos;audience</h2>
      <p>
        Nous pouvons utiliser un outil de mesure d&apos;audience (Google Analytics) pour savoir quelles pages sont consultées et
        quels boutons sont utilisés, afin d&apos;améliorer le site. Ces statistiques sont agrégées.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l&apos;accès, la rectification ou la suppression de vos données à tout moment en écrivant à{' '}
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> ou par WhatsApp au {CONTACT.phoneDisplay}.
      </p>
    </LegalPage>
  );
}
