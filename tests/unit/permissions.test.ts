// M1-ROL-01, M1-ROL-04, M1-AUT-02 — matrice des droits (ADR 0018).
import { describe, expect, it } from 'vitest';
import { exige2FA, peut, permissionsDe } from '@/lib/authz/permissions';

describe('Matrice des droits (ADR 0018)', () => {
  it("M1-ROL-04 : l'Administrateur seul ne voit aucun dossier ni CV", () => {
    expect(peut(['admin'], 'dossier.voir_siens')).toBe(false);
    expect(peut(['admin'], 'dossier.voir_tous')).toBe(false);
    expect(peut(['admin'], 'candidat.voir')).toBe(false);
    expect(peut(['admin'], 'ligne_poste.voir_salaire')).toBe(false);
  });

  it("l'Administrateur gère comptes, tarifs, modèles, référentiel et journal", () => {
    for (const p of ['collaborateurs.gerer', 'tarifs.modifier', 'modeles.gerer', 'referentiel.gerer', 'audit.consulter'] as const) {
      expect(peut(['admin'], p)).toBe(true);
    }
  });

  it('la Direction voit tout, réaffecte, valide les remboursements, mais ne gère pas les comptes', () => {
    expect(peut(['direction'], 'dossier.voir_tous')).toBe(true);
    expect(peut(['direction'], 'dossier.reaffecter')).toBe(true);
    expect(peut(['direction'], 'remboursement.valider')).toBe(true);
    expect(peut(['direction'], 'collaborateurs.gerer')).toBe(false);
  });

  it('le Référent ne voit que ses dossiers et ne réaffecte pas', () => {
    expect(peut(['referent'], 'dossier.voir_siens')).toBe(true);
    expect(peut(['referent'], 'dossier.voir_tous')).toBe(false);
    expect(peut(['referent'], 'dossier.reaffecter')).toBe(false);
    expect(peut(['referent'], 'export.donnees')).toBe(false);
    expect(peut(['referent'], 'remboursement.valider')).toBe(false);
  });

  it('le Responsable finances lit tous les dossiers, exporte, mais ne voit ni salaires ni CV', () => {
    expect(peut(['finances'], 'dossier.voir_tous')).toBe(true);
    expect(peut(['finances'], 'export.donnees')).toBe(true);
    expect(peut(['finances'], 'encaissement.enregistrer')).toBe(true);
    expect(peut(['finances'], 'ligne_poste.voir_salaire')).toBe(false);
    expect(peut(['finances'], 'candidat.voir')).toBe(false);
    expect(peut(['finances'], 'dossier.traiter')).toBe(false);
  });

  it('les rôles sont combinables (union des droits)', () => {
    const roles = ['admin', 'referent'] as const;
    expect(peut(roles, 'collaborateurs.gerer')).toBe(true);
    expect(peut(roles, 'dossier.voir_siens')).toBe(true);
    expect(permissionsDe(roles)).toEqual(expect.arrayContaining(['collaborateurs.gerer', 'dossier.traiter']));
  });

  it('aucun rôle → aucune permission', () => {
    expect(permissionsDe([])).toEqual([]);
  });
});

describe('M1-AUT-02 : 2FA obligatoire', () => {
  it('pour Direction, Responsable finances et Administrateur', () => {
    expect(exige2FA(['direction'])).toBe(true);
    expect(exige2FA(['finances'])).toBe(true);
    expect(exige2FA(['admin'])).toBe(true);
    expect(exige2FA(['referent', 'direction'])).toBe(true);
  });
  it('facultative pour un Référent seul', () => {
    expect(exige2FA(['referent'])).toBe(false);
  });
});
