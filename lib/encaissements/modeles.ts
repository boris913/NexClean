// Modèle WhatsApp « Relance solde » (specs/MVP2-05 RG-09). Le texte est inséré en base par la
// migration 0013 (même texte, vérifié par tests/unit/encaissements.test.ts) ; les variables
// `solde.*` sont définies dans lib/modeles/variables.ts.
export const NOM_MODELE_RELANCE_SOLDE = 'Relance solde';
export const MODELE_RELANCE_SOLDE =
  'Bonjour {{client.contact}}, sauf erreur de notre part, la facture de solde {{solde.facture}} du {{solde.emise_le}} (dossier {{dossier.numero}}) reste à régler : {{solde.reste}}.\n\nVos factures et reçus sont disponibles sur votre page de suivi : {{dossier.lien_suivi}}\n\nMerci de nous indiquer la date de votre règlement.\n{{referent.prenom}}, NEXCLEAN — {{referent.telephone}}';
