// Candidature à une offre (MVP2-02 RG-07, RG-12), sur mobile 375 px : un visiteur non inscrit
// postule à « Agent de caisse » avec le formulaire court (compte léger), retrouve sa candidature
// dans son espace, ne peut pas postuler deux fois ; une offre pourvue renvoie vers l'inscription.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { contexteMobile, sansDefilementHorizontal } from './outils';

test.describe.configure({ mode: 'serial' });

const TELEPHONE = '6 77 55 44 33';
const MDP = 'mot-de-passe-candidature-1';
const OFFRE = '/recrutement/agent-caisse-akwa';
const PDF = { name: 'cv-awa.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 0x20)]) };

let ctx: BrowserContext;
let page: Page;
const appelsExternes: string[] = [];

test.beforeAll(async ({ browser, baseURL }) => {
  ctx = await contexteMobile(browser, baseURL);
  page = await ctx.newPage();
  const origine = new URL(baseURL ?? 'http://localhost:3000').origin;
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(origine) && !url.startsWith('data:') && !url.startsWith('blob:')) appelsExternes.push(url);
  });
});
test.afterAll(async () => ctx?.close());

test('liens publics vers l’inscription candidat depuis la page Recrutement', async () => {
  await page.goto('/recrutement', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'Créer mon profil candidat' }).first()).toHaveAttribute('href', '/candidat/inscription');
  await expect(page.getByRole('link', { name: 'Se connecter' }).first()).toHaveAttribute('href', '/candidat/connexion');
  await sansDefilementHorizontal(page);
});

test('offre pourvue : « Postuler » remplacé par l’inscription', async () => {
  await page.goto('/recrutement/agent-nettoyage', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: /Offre pourvue — inscrivez-vous pour être contacté/ }).first()).toHaveAttribute('href', '/candidat/inscription');
  await expect(page.getByRole('button', { name: 'Envoyer ma candidature' })).toHaveCount(0);
});

test('visiteur non inscrit : formulaire court, compte léger et candidature (RG-07)', async () => {
  await page.goto(OFFRE);
  await expect(page.getByRole('heading', { name: 'Postuler à cette offre' })).toBeVisible();
  await expect(page.getByLabel(/^Métier recherché/)).toHaveValue('Agent de caisse');

  // Champs obligatoires signalés avant tout envoi.
  await page.getByRole('button', { name: 'Envoyer ma candidature' }).click();
  await expect(page.locator('p.text-red-700').first()).toBeVisible();

  await page.getByLabel(/^Prénom/).fill('Awa');
  await page.getByLabel(/^Nom/).fill('Ngo');
  await page.getByLabel(/^Téléphone/).fill(TELEPHONE);
  await page.getByLabel(/^Ville/).selectOption({ label: 'Douala' });
  await page.getByLabel(/^Quartier/).selectOption({ label: 'Akwa' });
  await page.getByLabel(/^Expérience/).selectOption('1 à 3 ans');
  await page.getByLabel(/^Disponibilité/).selectOption('immediate');
  await page.getByLabel(/^CV/).setInputFiles(PDF);
  await expect(page.getByText('cv-awa.pdf')).toBeVisible();
  await page.getByLabel(/^Message de motivation/).fill('Trois ans de caisse en supermarché.');
  await page.getByLabel(/^Mot de passe de votre espace candidat/).fill(MDP);
  for (const c of await page.getByRole('checkbox').all()) if (!(await c.isChecked()) && (await c.isVisible())) await c.check();
  await sansDefilementHorizontal(page);
  appelsExternes.length = 0;
  await page.getByRole('button', { name: 'Envoyer ma candidature' }).click();

  await expect(page.getByRole('heading', { name: 'Candidature envoyée' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Compléter mon profil' })).toBeVisible();
  // Aucun service externe appelé depuis le navigateur pendant l'envoi.
  expect(appelsExternes).toEqual([]);
});

test('espace candidat : « profil incomplet » et candidature « Reçue » ; pas de seconde candidature (RG-12)', async () => {
  await page.getByRole('link', { name: 'Mon espace candidat' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Awa' })).toBeVisible();
  await expect(page.getByText('Profil incomplet.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Agent de caisse/ })).toBeVisible();
  await expect(page.getByText('Reçue', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /cv-awa\.pdf/ })).toBeVisible();
  await sansDefilementHorizontal(page);

  await page.goto(OFFRE);
  await expect(page.getByText('Vous avez déjà postulé à cette offre.')).toBeVisible();
});

test('candidat connecté : « Postuler » en un clic sur une autre offre', async () => {
  await page.goto('/recrutement/community-manager');
  await expect(page.getByText(/Vous êtes connecté\(e\) en tant que/)).toBeVisible();
  await page.getByRole('button', { name: 'Postuler', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Candidature envoyée' })).toBeVisible({ timeout: 60_000 });
});
