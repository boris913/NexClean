// Règles pures de la fiche candidat (MVP2-02 lot B ; MVP2-01 RG-07, RG-08).
import { describe, expect, it } from 'vitest';
import {
  MODELES_CANDIDAT_PAR_DEFAUT,
  MODELE_REINITIALISATION,
  controlerVerification,
  elementsDisponibles,
  estReferentOuDirection,
  masquerLienReinitialisation,
  utiliseLienReinitialisation,
} from '@/lib/candidats/fiche';
import { estModeleCandidat, rendreMessage, variableInconnue } from '@/lib/modeles/variables';

describe('Vérification d’identité (RG-07 : au moins 2 informations du profil)', () => {
  const tous = elementsDisponibles({ experiences: 2, quartier: true, metiers: 1 });

  it('liste les informations présentes dans le profil', () => {
    expect(tous).toEqual(['experience', 'quartier', 'metier']);
    expect(elementsDisponibles({ experiences: 0, quartier: true, metiers: 0 })).toEqual(['quartier']);
  });

  it('refuse moins de 2 informations, doublons compris', () => {
    expect(() => controlerVerification([], tous)).toThrow(/au moins 2/);
    expect(() => controlerVerification(['quartier'], tous)).toThrow(/au moins 2/);
    expect(() => controlerVerification(['quartier', 'quartier'], tous)).toThrow(/au moins 2/);
  });

  it('ignore les éléments inconnus et refuse une information absente du profil', () => {
    expect(() => controlerVerification(['quartier', 'pointure'], tous)).toThrow(/au moins 2/);
    expect(() => controlerVerification(['quartier', 'experience'], ['quartier', 'metier'])).toThrow(/absente du profil/);
  });

  it('accepte 2 informations distinctes', () => {
    expect(controlerVerification(['metier', 'experience'], tous)).toEqual(['metier', 'experience']);
  });
});

describe('Droits des procédures assistées', () => {
  it('référent du candidat ou Direction uniquement', () => {
    expect(estReferentOuDirection({ id: 'a', roles: ['referent'] }, 'a')).toBe(true);
    expect(estReferentOuDirection({ id: 'a', roles: ['referent'] }, 'b')).toBe(false);
    expect(estReferentOuDirection({ id: 'a', roles: ['referent'] }, null)).toBe(false);
    expect(estReferentOuDirection({ id: 'd', roles: ['direction'] }, null)).toBe(true);
    expect(estReferentOuDirection({ id: 'x', roles: ['admin'] }, 'x')).toBe(false);
  });
});

describe('Modèles WhatsApp candidat', () => {
  it('les modèles par défaut n’utilisent que des variables connues et sont reconnus comme « candidat »', () => {
    expect(MODELES_CANDIDAT_PAR_DEFAUT.map((m) => m.nom)).toEqual(['Bienvenue candidat', 'Compléter votre profil', MODELE_REINITIALISATION]);
    for (const m of MODELES_CANDIDAT_PAR_DEFAUT) {
      expect(variableInconnue(m.texte)).toBeNull();
      expect(estModeleCandidat(m.texte)).toBe(true);
    }
    expect(MODELES_CANDIDAT_PAR_DEFAUT.filter((m) => utiliseLienReinitialisation(m.texte)).map((m) => m.nom)).toEqual([MODELE_REINITIALISATION]);
  });

  it('un modèle de dossier n’est pas un modèle candidat', () => {
    expect(estModeleCandidat('Bonjour {{client.contact}}, dossier {{dossier.numero}}')).toBe(false);
  });

  it('rend le lien de réinitialisation, puis le masque avant journalisation', () => {
    const texte = rendreMessage(MODELES_CANDIDAT_PAR_DEFAUT[2]!.texte, { 'candidat.prenom': 'Josiane', 'candidat.lien_reinitialisation': 'https://nexclean.xyz/candidat/reinitialiser/Ab-12_xY', 'referent.prenom': 'Awa' });
    expect(texte).toContain('Bonjour Josiane');
    expect(texte).toContain('/candidat/reinitialiser/Ab-12_xY');
    const masque = masquerLienReinitialisation(texte);
    expect(masque).not.toContain('Ab-12_xY');
    expect(masque).toContain('/candidat/reinitialiser/[lien masqué]');
  });
});
