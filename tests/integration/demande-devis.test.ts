// Formulaires de devis « enregistrer puis WhatsApp » (specs/MVP1-04) sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Formulaires de devis (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const { soumettreDemandeDevis } = await import('@/lib/dossiers/demande-devis');
  const geo = await import('@/lib/geo/service');

  let lieu: { villeId: number; villeAutre: string; quartierId: number; quartierAutre: string };
  let n = 0;
  const ip = () => `10.1.0.${++n}`;

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const v = (await geo.listesLieux()).find((l) => l.nom === 'Douala')!;
    lieu = { villeId: v.id, villeAutre: '', quartierId: v.quartiers.find((q) => q.nom === 'Akwa')!.id, quartierAutre: '' };
  });

  const dossier = async (numero: string) => (await getDb().select().from(schema.dossier).where(eq(schema.dossier.numero, numero)))[0]!;

  it('RG-01 : devis pro valide → dossier NET, client entreprise, demande conservée', async () => {
    const r = await soumettreDemandeDevis(
      {
        formId: 'devis-pro',
        valeurs: { company: 'ACME SARL', sector: 'Bureaux', contact: 'M. Talla', phone: '690 22 33 44', surface: '250 m²', frequency: 'Hebdomadaire', need: 'Entretien des bureaux, 3 étages' },
        lieu,
        consentement: true,
      },
      { ip: ip() },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.numero).toMatch(/^NET-\d{4}-00001$/);
    expect(r.type).toBe('NET');
    expect(r.lienSuivi).toMatch(/\/suivi\/[\w-]+$/);
    const d = await dossier(r.numero);
    expect([d.type, d.statut, d.secteur, d.description, d.villeId, d.quartierId]).toEqual(['NET', 'nouvelle_demande', 'Bureaux', 'Entretien des bureaux, 3 étages', lieu.villeId, lieu.quartierId]);
    const [c] = await getDb().select().from(schema.client).where(eq(schema.client.id, d.clientId));
    expect([c!.type, c!.nom, c!.contact, c!.whatsapp]).toEqual(['entreprise', 'ACME SARL', 'M. Talla', '+237690223344']);
    const [dem] = await getDb().select().from(schema.demande).where(eq(schema.demande.dossierId, d.id));
    expect([dem!.canal, dem!.formulaire]).toEqual(['site', 'devis-pro']);
    expect((dem!.donnees as { valeurs: Record<string, string> }).valeurs.surface).toBe('250 m²');
  });

  it('RG-04 : formulaire général avec « Entretien Espaces Verts » → dossier EV ; Abonnement → ABO', async () => {
    const base = { name: 'Paul Ngando', phone: '690 22 33 45', date: '', message: 'Jardin de 300 m²' };
    const ev = await soumettreDemandeDevis({ formId: 'devis', valeurs: { ...base, service: 'Entretien Espaces Verts' }, lieu, consentement: true }, { ip: ip() });
    const abo = await soumettreDemandeDevis({ formId: 'devis', valeurs: { ...base, service: 'Entretien Régulier (Abonnement)' }, lieu, consentement: true }, { ip: ip() });
    const net = await soumettreDemandeDevis({ formId: 'devis', valeurs: { ...base, service: 'Désinfection' }, lieu, consentement: true }, { ip: ip() });
    if (!ev.ok || !abo.ok || !net.ok) throw new Error('envoi');
    expect([(await dossier(ev.numero)).type, (await dossier(abo.numero)).type, (await dossier(net.numero)).type]).toEqual(['EV', 'ABO', 'NET']);
    expect(ev.numero).toMatch(/^EV-/);
  });

  it('formulaire espaces verts → dossier EV ; « Autre » ville acceptée', async () => {
    const r = await soumettreDemandeDevis(
      { formId: 'devis-espaces-verts', valeurs: { name: 'Hôtel du Lac', phone: '690 22 33 46', siteType: 'Hôtel' }, lieu: { villeId: null, villeAutre: 'Kribi', quartierId: null, quartierAutre: 'Centre' }, consentement: true },
      { ip: ip() },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const d = await dossier(r.numero);
    expect([d.type, d.villeAutre, d.quartierAutre]).toEqual(['EV', 'Kribi', 'Centre']);
    const [c] = await getDb().select().from(schema.client).where(eq(schema.client.id, d.clientId));
    expect(c!.type).toBe('entreprise');
  });

  it('RG-08 : anti-doublon — le même envoi deux fois donne le même numéro', async () => {
    const e = { formId: 'devis-pro', valeurs: { company: 'Doublon SA', sector: 'Commerce', contact: 'X', phone: '690 22 33 47', need: 'Vitrines' }, lieu, consentement: true };
    const a = await soumettreDemandeDevis(e, { ip: ip() });
    const b = await soumettreDemandeDevis(e, { ip: ip() });
    if (!a.ok || !b.ok) throw new Error('envoi');
    expect(b.numero).toBe(a.numero);
    expect(b.doublon).toBe(true);
  });

  it('RG-08 : champ piège rempli → refusé, aucun dossier ; formulaire inconnu refusé', async () => {
    const avant = (await getDb().select().from(schema.dossier)).length;
    const r = await soumettreDemandeDevis({ formId: 'devis-pro', siteWeb: 'spam', valeurs: { company: 'Robot', sector: 'Bureaux', contact: 'R', phone: '690 22 33 48', need: 'x' }, lieu, consentement: true }, { ip: ip() });
    expect(r.ok).toBe(false);
    expect((await soumettreDemandeDevis({ formId: 'inconnu' }, { ip: ip() })).ok).toBe(false);
    expect((await getDb().select().from(schema.dossier)).length).toBe(avant);
  });

  it('saisie invalide → erreurs par champ, aucun dossier', async () => {
    const r = await soumettreDemandeDevis({ formId: 'devis-pro', valeurs: { company: 'ACME', phone: '12' }, lieu, consentement: false }, { ip: ip() });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs).toHaveProperty('phone');
    expect(r.erreurs).toHaveProperty('consentement');
  });
});
