// Aperçu PDF d'un modèle de document avec des données d'exemple (specs/POST-05 RG-13). Module
// sans accès à la base : l'appelant fournit le contenu saisi et les mentions légales courantes.
import { genererAttestation } from '@/lib/propositions/pdf';
import { pdfAccuseReception, pdfDevis, pdfFacture, pdfRecu, type ClientDocument } from './modeles';
import type { ContenuModele, TypeDocument } from './personnalisation';

const CLIENT: ClientDocument = { nom: 'Hôtel du Lac (exemple)', contact: 'M. Kamga', whatsapp: '+237 6 99 00 11 22', email: 'contact@exemple.cm', ville: 'Douala' };
const DOSSIER = 'REC-2026-00042';
const jourIso = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(d);

/** PDF d'exemple du type demandé, rendu avec `modele` (contenu supposé déjà validé). */
export async function apercuPdf(type: TypeDocument, modele: ContenuModele, mentionsLegales: string, maintenant = new Date()): Promise<Uint8Array> {
  const lignesDevis = [
    { intitule: 'Serveur (hôtellerie)', nombre: 4, commission: 5000, montantHt: 20000 },
    { intitule: 'Agent d’entretien', nombre: 2, commission: 5000, montantHt: 10000 },
  ];
  switch (type) {
    case 'accuse_reception':
      return pdfAccuseReception({ numeroDossier: DOSSIER, creeLe: maintenant, client: CLIENT, postes: lignesDevis.map((l) => ({ intitule: l.intitule, nombre: l.nombre })), mentionsLegales, modele });
    case 'devis':
      return pdfDevis({
        type: 'devis',
        numero: 'DEV-2026-00012',
        version: 1,
        numeroDossier: DOSSIER,
        date: maintenant,
        validiteJours: 15,
        expireLe: new Date(maintenant.getTime() + 15 * 86_400_000),
        client: CLIENT,
        lignes: lignesDevis,
        tauxTva: 0,
        totalHt: 30000,
        montantTva: 0,
        totalTtc: 30000,
        tauxAcompte: 50,
        acompte: 15000,
        delaiRechercheJours: 30,
        garantieJours: 15,
        conditions: 'Conditions générales en vigueur (Paramètres), figées sur chaque devis.',
        conditionsParticulieres: 'Exemple de conditions particulières saisies par le référent.',
        mentionsLegales,
        modele,
      });
    case 'facture':
    case 'avoir': {
      const avoir = type === 'avoir';
      return pdfFacture({
        type: avoir ? 'avoir' : 'acompte',
        numero: avoir ? 'FAC-2026-00031' : 'FAC-2026-00030',
        emiseLe: maintenant,
        numeroDossier: DOSSIER,
        libelle: avoir ? 'Avoir sur la facture d’acompte (exemple)' : 'Acompte de 50 % sur le devis DEV-2026-00012 (version 1)',
        devis: { numero: 'DEV-2026-00012', version: 1 },
        factureOrigine: avoir ? { numero: 'FAC-2026-00030', emiseLe: maintenant } : null,
        client: CLIENT,
        lignes: [{ libelle: avoir ? 'Trop-perçu sur acompte' : 'Acompte 50 % — devis DEV-2026-00012 v1', quantite: 1, prixUnitaire: avoir ? 5000 : 15000, montantHt: avoir ? 5000 : 15000 }],
        tauxTva: 0,
        totalHt: avoir ? 5000 : 15000,
        montantTva: 0,
        totalTtc: avoir ? 5000 : 15000,
        mentionsLegales,
        modele,
      });
    }
    case 'recu':
      return pdfRecu({
        numero: 'REÇ-2026-00018',
        recuLe: jourIso(maintenant),
        emisLe: maintenant,
        numeroDossier: DOSSIER,
        client: CLIENT,
        nature: 'Acompte',
        moyen: 'Orange Money',
        reference: 'OM-EXEMPLE-0001',
        montant: 15000,
        devis: { numero: 'DEV-2026-00012', version: 1 },
        situation: { libelleBase: 'Montant du devis', base: 30000, totalRegle: 15000 },
        mentionsLegales,
        modele,
      });
    case 'attestation':
      return genererAttestation({
        numeroDossier: DOSSIER,
        client: CLIENT.nom,
        contact: CLIENT.contact,
        candidatPrenom: 'Awa',
        candidatNom: 'Exemple',
        poste: 'Serveuse',
        datePrevue: jourIso(maintenant),
        garantieJours: 15,
        etablieLe: maintenant,
        mentionsLegales,
        modele,
      });
  }
}
