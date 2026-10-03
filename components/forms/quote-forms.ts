import type { FormField } from '@/components/forms/WhatsAppForm';
import { serviceNames } from '@/content/services-data';
import { ACTIVE_CITIES } from '@/lib/constants';

const PHOTO_NOTE = 'Vous serez redirigé vers WhatsApp : joignez-y vos photos ou vidéos pour un devis plus précis.';

export const generalQuoteForm = {
  formId: 'devis',
  subject: 'Demande de devis',
  note: PHOTO_NOTE,
  fields: [
    { name: 'name', label: 'Nom complet', required: true, placeholder: 'Votre nom' },
    { name: 'phone', label: 'Téléphone / WhatsApp', type: 'tel', required: true, placeholder: '+237 6XX XXX XXX' },
    { name: 'service', label: 'Service souhaité', type: 'select', required: true, options: [...serviceNames, 'Autre'] },
    { name: 'city', label: 'Ville', type: 'select', required: true, options: [...ACTIVE_CITIES, 'Autre'] },
    { name: 'location', label: 'Quartier', required: true, placeholder: 'Bonapriso, Akwa…' },
    { name: 'date', label: 'Date souhaitée', type: 'date' },
    { name: 'message', label: 'Précisions (surface, état, accès…)', type: 'textarea', placeholder: 'Décrivez votre besoin' },
  ] satisfies FormField[],
};

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
    { name: 'location', label: 'Ville / quartier', required: true },
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
};

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
    { name: 'location', label: 'Ville / quartier', required: true },
    { name: 'surface', label: 'Superficie approximative', placeholder: 'ex. 500 m²' },
    {
      name: 'frequency',
      label: 'Fréquence souhaitée',
      type: 'select',
      options: ['Ponctuelle', 'Hebdomadaire', 'Toutes les 2 semaines', 'Mensuelle', 'À définir'],
    },
    { name: 'need', label: 'Travaux souhaités', type: 'textarea', placeholder: 'Tonte, débroussaillage, taille de haies…' },
  ] satisfies FormField[],
};
