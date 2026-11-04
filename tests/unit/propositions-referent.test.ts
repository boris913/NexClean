// MVP2-03 lot A : règles pures des modèles WhatsApp de proposition et du masquage des liens.
import { describe, expect, it } from 'vitest';
import { estModeleCandidat, estModeleProposition, variableInconnue } from '@/lib/modeles/variables';
import { destinataireModele, lienRequis, masquerLienAcces, MODELES_PROPOSITION_PAR_DEFAUT } from '@/lib/propositions/service';
import { MODELES_CANDIDAT_PAR_DEFAUT } from '@/lib/candidats/fiche';

describe('Modèles WhatsApp de proposition', () => {
  it('les modèles par défaut n’utilisent que des variables connues et sont reconnus comme modèles de proposition', () => {
    for (const m of MODELES_PROPOSITION_PAR_DEFAUT) {
      expect(variableInconnue(m.texte)).toBeNull();
      expect(estModeleProposition(m.texte)).toBe(true);
    }
    for (const m of MODELES_CANDIDAT_PAR_DEFAUT) expect(estModeleProposition(m.texte)).toBe(false);
  });

  it('destinataire et lien à générer', () => {
    const parNom = Object.fromEntries(MODELES_PROPOSITION_PAR_DEFAUT.map((m) => [m.nom, m.texte]));
    expect(destinataireModele(parNom['Proposition de poste']!)).toBe('candidat');
    expect(destinataireModele(parNom['Convocation entretien']!)).toBe('candidat');
    expect(destinataireModele(parNom['Profil candidat']!)).toBe('client');
    expect(destinataireModele(parNom['Attestation de prise de poste']!)).toBe('client');
    expect(lienRequis(parNom['Profil candidat']!)).toBe('profil');
    expect(lienRequis(parNom['Attestation de prise de poste']!)).toBe('attestation');
    expect(lienRequis(parNom['Proposition de poste']!)).toBeNull();
    expect(estModeleCandidat(parNom['Profil candidat']!)).toBe(false);
  });

  it('le lien d’accès n’est jamais noté en clair', () => {
    const t = 'Voici le profil : https://nexclean.xyz/profil/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde merci';
    expect(masquerLienAcces(t)).toBe('Voici le profil : https://nexclean.xyz/profil/[lien masqué] merci');
  });
});

describe('Migration 0010 — modèles WhatsApp des propositions', () => {
  it('insère chaque modèle par défaut avec le texte exact du code, sans écraser l’existant', async () => {
    const { readFileSync } = await import('node:fs');
    const migration = readFileSync('lib/db/migrations/0010_modeles_proposition.sql', 'utf8').replace(/\r\n/g, '\n');
    const sqlTexte = (s: string) => `'${s.replace(/'/g, "''")}'`;
    expect(MODELES_PROPOSITION_PAR_DEFAUT).toHaveLength(4);
    for (const m of MODELES_PROPOSITION_PAR_DEFAUT) expect(migration).toContain(`(${sqlTexte(m.nom)}, '{}', ${sqlTexte(m.texte)})`);
    expect(migration).toContain('ON CONFLICT ("nom") DO NOTHING');
  });
});
