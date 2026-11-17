// Configuration des formulaires de devis (MVP1-04). Partagée navigateur / serveur :
// le serveur valide la saisie avec ces mêmes champs (libellés, options, obligatoires).
import type { ConfigDevis, FormField } from '@/lib/dossiers/formulaire-devis';
import { serviceNames } from '@/content/services-data';

const PHOTO_NOTE = 'Vous serez redirigé vers WhatsApp : joignez-y vos photos ou vidéos pour un devis plus précis.';

export const generalQuoteForm = {
  formId: 'devis',
  subject: 'Demande de devis',
  note: PHOTO_NOTE,
  fields: [
    { name: 'name', label: 'Nom complet', required: true, placeholder: 'Votre nom' },
    { name: 'phone', label: 'Téléphone / WhatsApp', type: 'tel', required: true, placeholder: '+237 6XX XXX XXX' },
    { name: 'service', label: 'Service souhaité', type: 'select', required: true, options: [...serviceNames, 'Autre'] },
    // Ville + Quartier du référentiel ; message : « Ville : … » puis « Quartier : … » (RG-02).
    { name: 'location', label: 'Ville / quartier', type: 'lieu', required: true },
    { name: 'date', label: 'Date souhaitée', type: 'date' },
    { name: 'message', label: 'Précisions (surface, état, accès…)', type: 'textarea', placeholder: 'Décrivez votre besoin' },
  ] satisfies FormField[],
} satisfies ConfigDevis;

export const proQuoteForm = {
  formId: 'devis-pro',
  subject: 'Demande de visite technique / devis professionnel',
  note: 'Vous serez redirigé vers WhatsApp : vous pourrez y joindre photos, plans ou cahier des charges.',
  fields: [
    { name: 'company', label: 'Entreprise', required: true },
    {
      name: 'sector',
      label: "Secteur d'activité",
      type: 'select',
      required: true,
      options: ['Bureaux', 'Restaurant', 'Hôtel', 'Résidence', 'Commerce', 'Administration', 'Établissement scolaire', 'Événement', 'Chantier', 'Autre'],
    },
    { name: 'contact', label: 'Nom du contact', required: true },
    { name: 'phone', label: 'Téléphone', type: 'tel', required: true, placeholder: '+237 6XX XXX XXX' },
    { name: 'location', label: 'Ville / quartier', type: 'lieu', required: true, messageCombine: true },
    { name: 'surface', label: 'Surface approximative', placeholder: 'ex. 250 m²' },
    {
      name: 'frequency',
      label: 'Fréquence souhaitée',
      type: 'select',
      options: ['Ponctuelle', 'Quotidienne', 'Plusieurs fois par semaine', 'Hebdomadaire', 'Mensuelle', 'À définir'],
    },
    { name: 'sites', label: 'Nombre de sites', placeholder: '1' },
    { name: 'date', label: 'Date souhaitée', type: 'date' },
    { name: 'need', label: 'Votre besoin', type: 'textarea', required: true, placeholder: 'Prestations attendues, horaires, contraintes…' },
  ] satisfies FormField[],
} satisfies ConfigDevis;

export const greenSpacesQuoteForm = {
  formId: 'devis-espaces-verts',
  subject: 'Demande d\'état des lieux / devis espaces verts',
  note: PHOTO_NOTE,
  fields: [
    { name: 'name', label: 'Nom / Entreprise', required: true },
    { name: 'phone', label: 'Téléphone / WhatsApp', type: 'tel', required: true, placeholder: '+237 6XX XXX XXX' },
    {
      name: 'siteType',
      label: 'Type de site',
      type: 'select',
      required: true,
      options: ['Jardin privé', 'Cour', 'Résidence', 'Entreprise', 'Hôtel', 'Administration', 'Terrain', 'Autre'],
    },
    { name: 'location', label: 'Ville / quartier', type: 'lieu', required: true, messageCombine: true },
    { name: 'surface', label: 'Superficie approximative', placeholder: 'ex. 500 m²' },
    {
      name: 'frequency',
      label: 'Fréquence souhaitée',
      type: 'select',
      options: ['Ponctuelle', 'Hebdomadaire', 'Toutes les 2 semaines', 'Mensuelle', 'À définir'],
    },
    { name: 'need', label: 'Travaux souhaités', type: 'textarea', placeholder: 'Tonte, débroussaillage, taille de haies…' },
  ] satisfies FormField[],
} satisfies ConfigDevis;

/** Formules affichées sur /abonnements (components/sections/SubscriptionsSection.tsx). */
export const FORMULES_ABONNEMENT = ['Particuliers', 'Professionnels', 'Espaces verts'] as const;

/** Formulaire abonnement (ADR 0022 §2, POST-02) : même circuit « enregistrer puis WhatsApp », Dossier ABO. */
export const subscriptionForm = {
  formId: 'demande-abonnement',
  subject: "Demande d'abonnement d'entretien",
  note: 'Vous serez redirigé vers WhatsApp pour construire votre formule avec un conseiller.',
  fields: [
    { name: 'name', label: 'Nom / Entreprise', required: true },
    { name: 'clientType', label: 'Vous êtes', type: 'select', required: true, options: ['Particulier', 'Entreprise / organisation'] },
    { name: 'phone', label: 'Téléphone / WhatsApp', type: 'tel', required: true, placeholder: '+237 6XX XXX XXX' },
    { name: 'formula', label: 'Formule', type: 'select', required: true, options: [...FORMULES_ABONNEMENT, 'Je ne sais pas encore'] },
    { name: 'siteType', label: 'Site à entretenir', type: 'select', required: true, options: ['Logement', 'Bureaux', 'Commerce', 'Restaurant / hôtel', 'Résidence', 'Jardin / espace vert', 'Plusieurs sites', 'Autre'] },
    { name: 'location', label: 'Ville / quartier', type: 'lieu', required: true, messageCombine: true },
    { name: 'frequency', label: 'Fréquence souhaitée', type: 'select', required: true, options: ['4 passages par mois', '8 passages par mois', 'Plusieurs passages par semaine', 'Tous les jours', 'Toutes les 2 semaines', 'À définir'] },
    { name: 'surface', label: 'Surface approximative', placeholder: 'ex. 120 m²' },
    { name: 'date', label: 'Début souhaité', type: 'date' },
    { name: 'need', label: 'Précisions', type: 'textarea', full: true, placeholder: 'Pièces ou zones à entretenir, horaires, contraintes…' },
  ] satisfies FormField[],
} satisfies ConfigDevis;

export const FORMULAIRES_DEVIS: Record<string, ConfigDevis> = {
  [generalQuoteForm.formId]: generalQuoteForm,
  [proQuoteForm.formId]: proQuoteForm,
  [greenSpacesQuoteForm.formId]: greenSpacesQuoteForm,
  [subscriptionForm.formId]: subscriptionForm,
};
