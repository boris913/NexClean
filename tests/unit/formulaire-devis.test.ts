// Formulaires de devis (specs/MVP1-04) : non-régression du message, type de dossier, validation.
import { describe, expect, it } from 'vitest';
import { generalQuoteForm, greenSpacesQuoteForm, proQuoteForm, FORMULAIRES_DEVIS } from '@/components/forms/quote-forms';
import { construireMessage, typeDossierPour, validerDevis } from '@/lib/dossiers/formulaire-devis';

/** Libellés du message avant migration (relevés dans l'ancien quote-forms.ts). */
const LIBELLES_AVANT: Record<string, string[]> = {
  devis: ['Nom complet', 'Téléphone / WhatsApp', 'Service souhaité', 'Ville', 'Quartier', 'Date souhaitée', 'Précisions (surface, état, accès…)'],
  'devis-pro': ['Entreprise', "Secteur d'activité", 'Nom du contact', 'Téléphone', 'Ville / quartier', 'Surface approximative', 'Fréquence souhaitée', 'Nombre de sites', 'Date souhaitée', 'Votre besoin'],
  'devis-espaces-verts': ['Nom / Entreprise', 'Téléphone / WhatsApp', 'Type de site', 'Ville / quartier', 'Superficie approximative', 'Fréquence souhaitée', 'Travaux souhaités'],
};

/** Une valeur valide pour chaque champ (première option pour les listes). */
function valeursCompletes(formId: string) {
  const c = FORMULAIRES_DEVIS[formId]!;
  return Object.fromEntries(
    c.fields.filter((f) => f.type !== 'lieu').map((f) => [f.name, f.type === 'select' ? f.options![0]! : f.type === 'tel' ? '690 00 00 01' : f.type === 'date' ? '2027-01-15' : `valeur ${f.name}`]),
  );
}

describe('Non-régression du message WhatsApp', () => {
  for (const formId of Object.keys(LIBELLES_AVANT)) {
    it(`${formId} : tous les libellés d'origine figurent dans le message`, () => {
      const c = FORMULAIRES_DEVIS[formId]!;
      const msg = construireMessage(c, valeursCompletes(formId), { ville: 'Douala', quartier: 'Akwa' });
      for (const l of LIBELLES_AVANT[formId]!) expect(msg, l).toMatch(new RegExp(`^${l.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} : .+$`, 'm'));
      expect(msg.startsWith('Bonjour NexClean,\n\n*' + c.subject + '*\n\n')).toBe(true);
    });
  }

  it('lieu : « Ville » et « Quartier » séparés (général), « Ville / quartier : Akwa, Douala » (pro, espaces verts)', () => {
    expect(construireMessage(generalQuoteForm, {}, { ville: 'Douala', quartier: 'Akwa' })).toContain('Ville : Douala\nQuartier : Akwa');
    expect(construireMessage(proQuoteForm, {}, { ville: 'Douala', quartier: 'Akwa' })).toContain('Ville / quartier : Akwa, Douala');
    expect(construireMessage(greenSpacesQuoteForm, {}, { ville: 'Kribi', quartier: null })).toContain('Ville / quartier : Kribi');
  });

  it('RG-01 : enregistré → commence par « Demande n° … », lien de suivi en pied', () => {
    const msg = construireMessage(proQuoteForm, valeursCompletes('devis-pro'), { ville: 'Douala', quartier: 'Akwa' }, { numero: 'NET-2026-00042', lienSuivi: 'https://nexclean.xyz/suivi/abc' });
    expect(msg.startsWith('Demande n° NET-2026-00042\n')).toBe(true);
    expect(msg.endsWith('Suivi de ma demande : https://nexclean.xyz/suivi/abc')).toBe(true);
  });

  it('RG-06 : repli → message d’origine, sans numéro', () => {
    const msg = construireMessage(proQuoteForm, valeursCompletes('devis-pro'), { ville: 'Douala', quartier: 'Akwa' }, null);
    expect(msg).not.toContain('Demande n°');
    expect(msg).not.toContain('Suivi');
  });

  it('les champs vides n’apparaissent pas', () => {
    expect(construireMessage(proQuoteForm, { company: 'ACME' }, { ville: null, quartier: null })).not.toContain('Surface');
  });
});

describe('Type de dossier (RG-04)', () => {
  it('général : Espaces verts → EV, Abonnement → ABO, autre → NET', () => {
    expect(typeDossierPour('devis', { service: 'Entretien Espaces Verts' })).toBe('EV');
    expect(typeDossierPour('devis', { service: 'Entretien Régulier (Abonnement)' })).toBe('ABO');
    expect(typeDossierPour('devis', { service: 'Nettoyage de Bureaux' })).toBe('NET');
    expect(typeDossierPour('devis', { service: 'Autre' })).toBe('NET');
  });
  it('devis pro → NET, espaces verts → EV', () => {
    expect(typeDossierPour('devis-pro', {})).toBe('NET');
    expect(typeDossierPour('devis-espaces-verts', {})).toBe('EV');
  });
  it('les services EV / ABO existent bien dans la liste du formulaire', () => {
    const options = generalQuoteForm.fields.find((f) => f.name === 'service')!.options!;
    expect(options).toContain('Entretien Espaces Verts');
    expect(options).toContain('Entretien Régulier (Abonnement)');
  });
});

describe('Validation serveur', () => {
  const lieu = { villeId: 1, villeAutre: '', quartierId: 2, quartierAutre: '' };
  it('accepte un formulaire complet et normalise le téléphone (RG-03)', () => {
    const r = validerDevis(proQuoteForm, { valeurs: valeursCompletes('devis-pro'), lieu, consentement: true });
    if (!r.ok) throw new Error(JSON.stringify(r.erreurs));
    expect(r.donnees.whatsapp).toBe('+237690000001');
    expect(r.donnees.lieu).toEqual({ villeId: 1, villeAutre: null, quartierId: 2, quartierAutre: null });
  });
  it('refuse : champ obligatoire vide, option inconnue, téléphone invalide, lieu manquant, sans consentement', () => {
    const r = validerDevis(proQuoteForm, {
      valeurs: { ...valeursCompletes('devis-pro'), company: '', sector: 'Inventé', phone: '123' },
      lieu: { villeId: null, villeAutre: '', quartierId: null, quartierAutre: '' },
      consentement: false,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.erreurs).sort()).toEqual(['company', 'consentement', 'location.quartier', 'location.ville', 'phone', 'sector']);
  });
  it('accepte « Autre » ville / quartier en texte libre', () => {
    const r = validerDevis(greenSpacesQuoteForm, { valeurs: valeursCompletes('devis-espaces-verts'), lieu: { villeId: null, villeAutre: 'Kribi', quartierId: null, quartierAutre: 'Centre' }, consentement: true });
    expect(r.ok).toBe(true);
  });
  it('ignore les champs non déclarés', () => {
    const r = validerDevis(generalQuoteForm, { valeurs: { ...valeursCompletes('devis'), pirate: 'x' }, lieu, consentement: true });
    if (!r.ok) throw new Error('refusé');
    expect(r.donnees.valeurs).not.toHaveProperty('pirate');
  });
});
