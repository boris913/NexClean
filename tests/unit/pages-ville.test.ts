// Pages par ville (specs/COM1-01 RG-11) : adresses et données structurées.
import { describe, expect, it } from 'vitest';
import { cheminVille, slugVille, villeDepuisSlug } from '@/lib/geo/slug';
import { villeServicesSchema } from '@/lib/seo';
import { services } from '@/content/services-data';

describe('slugVille', () => {
  it('retire accents, majuscules et espaces', () => {
    expect(slugVille('Douala')).toBe('douala');
    expect(slugVille('Yaoundé')).toBe('yaounde');
    expect(slugVille('  Bafoussam II ')).toBe('bafoussam-ii');
    expect(slugVille('Ebolowa-Centre')).toBe('ebolowa-centre');
  });

  it('cheminVille préfixe /zones/', () => {
    expect(cheminVille('Yaoundé')).toBe('/zones/yaounde');
  });
});

describe('villeDepuisSlug', () => {
  const villes = ['Douala', 'Yaoundé'];
  it('retrouve la ville couverte', () => {
    expect(villeDepuisSlug(villes, 'yaounde')).toBe('Yaoundé');
  });
  it('null pour une ville non couverte ou un slug inconnu', () => {
    expect(villeDepuisSlug(villes, 'kribi')).toBeNull();
    expect(villeDepuisSlug(villes, 'Douala')).toBeNull();
    expect(villeDepuisSlug([], 'douala')).toBeNull();
  });
});

describe('villeServicesSchema', () => {
  const s = villeServicesSchema('Douala', ['Akwa', 'Bonapriso'], '/zones/douala');
  const json = JSON.parse(JSON.stringify(s));

  it('liste chaque prestation, servie dans la ville et ses quartiers', () => {
    expect(json.itemListElement).toHaveLength(services.length);
    const premier = json.itemListElement[0].item;
    expect(premier['@type']).toBe('Service');
    expect(premier['@context']).toBeUndefined();
    expect(premier.areaServed).toEqual([
      { '@type': 'City', name: 'Douala' },
      { '@type': 'Place', name: 'Akwa, Douala' },
      { '@type': 'Place', name: 'Bonapriso, Douala' },
    ]);
  });

  it('URL absolue de la page', () => {
    expect(json.url).toBe('https://nexclean.xyz/zones/douala');
  });
});
