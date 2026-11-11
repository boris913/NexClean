// WhatsApp Cloud API, réception (specs/COM2-01 RG-01, RG-03, RG-04, RG-06).
import { describe, expect, it } from 'vitest';
import { signatureValide, signer } from '@/lib/whatsapp/signature';
import { lireWebhook, texteDuMessage } from '@/lib/whatsapp/evenements';
import { lieuProbable, posteProbable, typeProbable } from '@/lib/whatsapp/qualification';

const SECRET = 'secret-application-meta-test';

describe('signature (RG-01)', () => {
  const corps = '{"object":"whatsapp_business_account"}';
  it('accepte la bonne signature, refuse le reste', () => {
    expect(signatureValide(corps, signer(corps, SECRET), SECRET)).toBe(true);
    expect(signatureValide(corps + ' ', signer(corps, SECRET), SECRET)).toBe(false);
    expect(signatureValide(corps, signer(corps, 'autre-secret-xxxxxxxx'), SECRET)).toBe(false);
    expect(signatureValide(corps, null, SECRET)).toBe(false);
    expect(signatureValide(corps, 'sha256=zz', SECRET)).toBe(false);
    expect(signatureValide(corps, 'md5=abc', SECRET)).toBe(false);
  });
});

const webhook = (field: string, value: object) => ({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field, value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '237696370479', phone_number_id: 'PNID' }, ...value } }] }] });

describe('lecture des webhooks (RG-03, RG-04)', () => {
  it('message texte reçu, avec le nom de profil', () => {
    const e = lireWebhook(webhook('messages', { contacts: [{ profile: { name: 'Mme Ngo' }, wa_id: '237690112233' }], messages: [{ from: '237690112233', id: 'wamid.A', timestamp: '1762851600', type: 'text', text: { body: 'Bonjour [FB] je cherche une ménagère' } }] }));
    expect(e).toEqual([{ genre: 'message', waId: 'wamid.A', sens: 'entrant', origine: 'client', numero: '+237690112233', nomProfil: 'Mme Ngo', horodatage: new Date(1762851600_000), type: 'text', texte: 'Bonjour [FB] je cherche une ménagère', media: null }]);
  });

  it('médias : image avec légende, document, note vocale', () => {
    const e = lireWebhook(webhook('messages', { messages: [
      { from: '237690112233', id: 'wamid.I', timestamp: '1', type: 'image', image: { id: 'MEDIA1', mime_type: 'image/jpeg', caption: 'Le salon' } },
      { from: '237690112233', id: 'wamid.D', timestamp: '2', type: 'document', document: { id: 'MEDIA2', mime_type: 'application/pdf', filename: 'plan.pdf' } },
      { from: '237690112233', id: 'wamid.V', timestamp: '3', type: 'audio', audio: { id: 'MEDIA3', mime_type: 'audio/ogg; codecs=opus', voice: true } },
    ] }));
    expect(e.map((x) => x.genre === 'message' && [x.texte, x.media])).toEqual([
      ['Le salon', { mediaId: 'MEDIA1', mime: 'image/jpeg', nom: null }],
      ['', { mediaId: 'MEDIA2', mime: 'application/pdf', nom: 'plan.pdf' }],
      ['Note vocale', { mediaId: 'MEDIA3', mime: 'audio/ogg; codecs=opus', nom: null }],
    ]);
  });

  it('localisation, contact, bouton, type inconnu', () => {
    expect(texteDuMessage({ type: 'location', location: { latitude: 4.05, longitude: 9.7, name: 'Akwa', address: 'Bd de la Liberté' } })).toBe('Localisation : Akwa, Bd de la Liberté (4.05, 9.7)');
    expect(texteDuMessage({ type: 'contacts', contacts: [{ name: { formatted_name: 'Paul' }, phones: [{ phone: '+237 699' }] }] })).toBe('Contact : Paul +237 699');
    expect(texteDuMessage({ type: 'interactive', interactive: { button_reply: { id: 'oui', title: 'Oui' } } })).toBe('Oui');
    expect(texteDuMessage({ type: 'ephemeral' })).toMatch(/non pris en charge/);
  });

  it('statuts : envoyé, lu, échec avec erreur ; statut inconnu ignoré', () => {
    const e = lireWebhook(webhook('messages', { statuses: [
      { id: 'wamid.S', status: 'read', timestamp: '10', recipient_id: '237690112233' },
      { id: 'wamid.T', status: 'failed', timestamp: '11', errors: [{ code: 131047, title: 'Re-engagement message' }] },
      { id: 'wamid.U', status: 'deleted', timestamp: '12' },
    ] }));
    expect(e).toEqual([
      { genre: 'statut', waId: 'wamid.S', statut: 'lu', horodatage: new Date(10_000), erreur: null },
      { genre: 'statut', waId: 'wamid.T', statut: 'echec', horodatage: new Date(11_000), erreur: '131047 Re-engagement message' },
    ]);
  });

  it('coexistence : message envoyé depuis le téléphone → sortant « application »', () => {
    const e = lireWebhook(webhook('smb_message_echoes', { message_echoes: [{ from: '237696370479', to: '237690112233', id: 'wamid.E', timestamp: '20', type: 'text', text: { body: 'Bonjour, nous passons demain' } }] }));
    expect(e[0]).toMatchObject({ sens: 'sortant', origine: 'application', numero: '+237690112233', texte: 'Bonjour, nous passons demain' });
  });

  it('autre objet ou champ : ignoré', () => {
    expect(lireWebhook({ object: 'page', entry: [] })).toEqual([]);
    expect(lireWebhook(webhook('account_update', {}))).toEqual([]);
    expect(lireWebhook(null)).toEqual([]);
  });
});

describe('pré-qualification (RG-06)', () => {
  it('type probable', () => {
    expect(typeProbable('Bonjour [FB] je cherche une ménagère à Bonamoussadi')).toBe('REC');
    expect(typeProbable('Il faut tondre la pelouse et tailler la haie')).toBe('EV');
    expect(typeProbable('Grand ménage de fin de chantier')).toBe('NET');
    expect(typeProbable('Bonsoir')).toBe('NET');
    expect(typeProbable('Je veux faire une réclamation sur la prestation')).toBe('RCL');
  });

  it('premier poste d’un dossier de recrutement', () => {
    expect(posteProbable('je cherche une ménagère à Bonamoussadi')).toBe('Ménagère');
    expect(posteProbable('Il me faut une aide ménagère')).toBe('Aide ménagère');
    expect(posteProbable('je recrute du personnel')).toBe('Poste à préciser');
  });

  const lieux = [
    { id: 1, nom: 'Douala', quartiers: [{ id: 10, nom: 'Bonamoussadi' }, { id: 11, nom: 'Akwa' }, { id: 12, nom: 'Centre' }] },
    { id: 2, nom: 'Yaoundé', quartiers: [{ id: 20, nom: 'Bastos' }, { id: 21, nom: 'Centre' }] },
  ];
  it('lieu cité', () => {
    expect(lieuProbable('je cherche une ménagère à Bonamoussadi', lieux)).toEqual({ villeId: 1, quartierId: 10 });
    expect(lieuProbable('nettoyage de bureaux à Yaounde', lieux)).toEqual({ villeId: 2, quartierId: null });
    expect(lieuProbable('au Centre', lieux)).toEqual({ villeId: null, quartierId: null }); // ambigu
    expect(lieuProbable('Centre-ville de Yaoundé', lieux)).toEqual({ villeId: 2, quartierId: 21 });
    expect(lieuProbable('Bonjour', lieux)).toEqual({ villeId: null, quartierId: null });
  });
});
