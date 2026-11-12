// Collecte de la veille (specs/COM4-01 RG-05) : lecture des flux et filtrage par requête.
import { describe, expect, it } from 'vitest';
import { lireFlux, motsRequete, requeteCorrespondante, texteBrut } from '@/lib/veille/flux';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Annonces</title>
<item>
  <title><![CDATA[Recherche gardien de nuit – Bastos]]></title>
  <link>https://annonces.example.cm/a/123?utm_source=rss</link>
  <description>&lt;p&gt;Villa à &lt;b&gt;Bastos&lt;/b&gt;, gardien sérieux.&lt;br/&gt;Tél&amp;nbsp;: 699 11 22 33&lt;/p&gt;</description>
  <pubDate>Wed, 11 Nov 2026 08:30:00 +0100</pubDate>
</item>
<item><title>Vends voiture</title><link>https://annonces.example.cm/a/124</link><description>Toyota</description><pubDate>pas une date</pubDate></item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title type="html">Appel d&#39;offres : nettoyage des locaux</title>
<link rel="alternate" href="https://marches.example.cm/ao/9"/><updated>2026-11-10T09:00:00Z</updated>
<summary>Entretien des bureaux à Douala &#8211; lot unique</summary></entry></feed>`;

describe('veille : flux RSS / Atom', () => {
  it('RSS 2.0 : titre (CDATA), lien, texte sans HTML ni entités, date', () => {
    const [a, b] = lireFlux(RSS);
    expect(a).toEqual({ titre: 'Recherche gardien de nuit – Bastos', lien: 'https://annonces.example.cm/a/123?utm_source=rss', texte: 'Villa à Bastos , gardien sérieux.\nTél : 699 11 22 33', publieLe: new Date('2026-11-11T07:30:00Z') });
    expect(b).toMatchObject({ titre: 'Vends voiture', publieLe: null });
  });

  it('Atom : lien href, entités numériques, date', () => {
    expect(lireFlux(ATOM)).toEqual([{ titre: 'Appel d\'offres : nettoyage des locaux', lien: 'https://marches.example.cm/ao/9', texte: 'Entretien des bureaux à Douala – lot unique', publieLe: new Date('2026-11-10T09:00:00Z') }]);
  });

  it('flux invalide ou vide → aucun élément ; scripts retirés', () => {
    expect(lireFlux('<html>pas un flux</html>')).toEqual([]);
    expect(texteBrut('<p>ok<script>alert(1)</script></p>')).toBe('ok');
  });
});

describe('veille : requêtes', () => {
  it('mots significatifs (4 lettres et plus, hors mots généraux, sans accents)', () => {
    expect(motsRequete('Recherche femme de ménage Douala')).toEqual(['femme', 'menage', 'douala']);
    expect(motsRequete('besoin urgent')).toEqual([]);
  });

  it('tous les mots d’une requête doivent figurer (pluriel accepté) ; première requête retenue', () => {
    const r = ['femme de ménage Douala', 'agent de sécurité Yaoundé'];
    expect(requeteCorrespondante('Cherchons des agents de sécurité pour Yaoundé', r)).toEqual({ ok: true, requete: 'agent de sécurité Yaoundé' });
    expect(requeteCorrespondante('Femme de ménage à Yaoundé', r)).toEqual({ ok: false, requete: null });
    expect(requeteCorrespondante('Rien à voir', [])).toEqual({ ok: true, requete: null });
  });
});
