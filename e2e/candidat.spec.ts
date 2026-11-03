// Espace candidat (MVP2-01), sur mobile 375 px : inscription en 7 étapes, espace, profil,
// documents, déconnexion / connexion, mot de passe oublié, suppression du compte.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { contexteMobile, sansDefilementHorizontal } from './outils';

test.describe.configure({ mode: 'serial' });

const TELEPHONE = '6 99 12 34 56';
const MDP = 'mon-mot-de-passe-1';
const PDF = { name: 'cv-josiane.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 0x20)]) };

let ctx: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser, baseURL }) => {
  ctx = await contexteMobile(browser, baseURL);
  page = await ctx.newPage();
});
test.afterAll(async () => ctx?.close());

const continuer = () => page.getByRole('button', { name: 'Continuer' }).click();
const erreurs = () => page.locator('p.text-red-700');

test('inscription en 7 étapes : validations, consentements distincts, CV, confirmation', async () => {
  await page.goto('/candidat/inscription');
  await expect(page.getByRole('heading', { name: 'Créer mon profil candidat' })).toBeVisible();
  await expect(page.getByText(/100 % gratuites/).first()).toBeVisible();

  // 1. Identité
  await continuer();
  await expect(erreurs().first()).toBeVisible();
  await page.getByLabel(/^Prénom/).fill('Josiane');
  await page.getByLabel(/^Nom/).fill('Mballa');
  await page.getByLabel(/^Téléphone/).fill(TELEPHONE);
  await sansDefilementHorizontal(page);
  await continuer();

  // 2. Localisation
  await expect(page.getByRole('heading', { name: 'Localisation' })).toBeVisible();
  await continuer();
  await expect(page.getByText('Choisissez au moins un arrondissement ou un quartier, ou « toute la ville »')).toBeVisible();
  await page.getByLabel(/^Ville/).selectOption({ label: 'Douala' });
  await page.getByLabel(/^Quartier/).selectOption({ label: 'Bonapriso' });
  await page.getByLabel('Douala I', { exact: true }).check();
  await sansDefilementHorizontal(page);
  await continuer();

  // 3. Recherche
  await expect(page.getByRole('heading', { name: 'Recherche' })).toBeVisible();
  await page.getByLabel(/^Métiers recherchés/).fill('Agent d’entretien');
  await page.getByRole('button', { name: 'Ajouter' }).first().click();
  await page.getByLabel('CDI', { exact: true }).check();
  await page.getByLabel('Hôtellerie').check();
  await sansDefilementHorizontal(page);
  await continuer();

  // 4. Parcours
  await expect(page.getByRole('heading', { name: 'Parcours' })).toBeVisible();
  await page.getByLabel(/^Niveau d’études/).selectOption('BEPC / CAP');
  await page.getByRole('button', { name: /Ajouter une expérience/ }).click();
  await page.getByLabel(/^Poste occupé/).fill('Femme de chambre');
  await page.getByLabel(/^Employeur/).fill('Hôtel Essai');
  await sansDefilementHorizontal(page);
  await continuer();

  // 5. Disponibilité
  await page.getByLabel('Disponible immédiatement').check();
  await page.getByLabel('De jour').check();
  await continuer();

  // 6. Documents
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await page.getByLabel(/^CV/).setInputFiles(PDF);
  await expect(page.getByText(/cv-josiane\.pdf/)).toBeVisible();
  await continuer();

  // 7. Compte : sans le consentement (b), refus (RG-03)
  await expect(page.getByRole('heading', { name: 'Compte' })).toBeVisible();
  await page.getByLabel(/^Mot de passe/).fill(MDP);
  await page.getByLabel(/^Confirmez le mot de passe/).fill(MDP);
  await page.getByRole('checkbox', { name: /enregistre et utilise les informations de mon profil/ }).check();
  await page.getByRole('checkbox', { name: /au moins 18 ans/ }).check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Ce consentement est nécessaire pour vous inscrire')).toBeVisible();
  await page.getByRole('checkbox', { name: /me contacte par téléphone, WhatsApp ou e-mail/ }).check();
  await sansDefilementHorizontal(page);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page.getByRole('heading', { name: 'Inscription réussie' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/cv-josiane\.pdf : enregistré/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Recevoir la confirmation sur WhatsApp/ })).toHaveAttribute('href', /wa\.me/);
});

test('espace : complétude, CV téléchargeable, « Je ne cherche plus », profil modifiable', async () => {
  await page.getByRole('link', { name: 'Accéder à mon espace' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Josiane' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await sansDefilementHorizontal(page);

  const lien = page.getByRole('link', { name: /cv-josiane\.pdf/ });
  await expect(lien).toBeVisible();
  const reponse = await page.request.get(await lien.getAttribute('href') as string);
  expect(reponse.status()).toBe(200);
  expect((await reponse.body()).subarray(0, 4).toString()).toBe('%PDF');

  await page.getByRole('button', { name: 'Je ne cherche plus' }).click();
  await expect(page.getByRole('button', { name: 'Je suis toujours en recherche' })).toBeVisible();
  await page.getByRole('button', { name: 'Je suis toujours en recherche' }).click();
  await expect(page.getByRole('button', { name: 'Je ne cherche plus' })).toBeVisible();

  await page.getByRole('link', { name: 'Modifier mon profil' }).click();
  await expect(page.getByLabel(/^Téléphone/)).toBeDisabled();
  await page.getByLabel(/^E-mail/).fill('josiane@exemple.cm');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toContainText('Profil enregistré');
  await sansDefilementHorizontal(page);
});

test('déconnexion, puis connexion par téléphone ; numéro déjà inscrit refusé (RG-04)', async () => {
  await page.goto('/candidat/espace');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/candidat\/connexion/);
  await page.goto('/candidat/espace');
  await expect(page).toHaveURL(/\/candidat\/connexion/);

  await page.getByLabel('Téléphone', { exact: true }).fill('+237699123456');
  await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('Numéro ou mot de passe incorrect');
  await page.getByLabel('Mot de passe', { exact: true }).fill(MDP);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/candidat\/espace/);

  // Un autre visiteur tente de s'inscrire avec le même numéro.
  const autre = await ctx.browser()!.newContext({ baseURL: page.url().split('/candidat')[0], viewport: { width: 375, height: 812 } });
  const p2 = await autre.newPage();
  // Brouillon injecté avant tout script de la page (sinon la page, hydratée plus tard,
  // enregistre son propre brouillon vide par-dessus).
  await p2.addInitScript(() =>
    localStorage.setItem(
      'nexclean:inscription-candidat:v1',
      JSON.stringify({ etape: 7, b: { nom: 'X', prenom: 'Y', telephone: '699 12 34 56', whatsappIdentique: true, villeId: null, villeAutre: 'Kribi', quartierAutre: 'Centre', zonesTouteVille: true, metiers: ['Serveur'], typesContrat: ['CDI'], niveauEtudes: 'Probatoire', disponibilite: 'immediate' } }),
    ),
  );
  await p2.goto('/candidat/inscription');
  await p2.getByLabel(/^Mot de passe/).fill(MDP);
  await p2.getByLabel(/^Confirmez le mot de passe/).fill(MDP);
  for (const c of await p2.getByRole('checkbox').all()) if (!(await c.isChecked()) && (await c.isVisible())) await c.check();
  await p2.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(p2.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('Ce numéro a déjà un compte');
  await expect(p2.locator('[role=alert]:not(#__next-route-announcer__)').getByRole('link', { name: 'Mot de passe oublié' })).toBeVisible();
  await autre.close();
});

test('mot de passe oublié : réponse neutre', async () => {
  const p = await ctx.newPage();
  await p.goto('/candidat/mot-de-passe-oublie');
  await p.getByLabel('Téléphone', { exact: true }).fill('6 98 76 54 32');
  await p.getByRole('button', { name: 'Continuer' }).click();
  await expect(p.getByText('Demande enregistrée.')).toBeVisible();
  await sansDefilementHorizontal(p);
  await p.close();
});

test('suppression du compte : confirmation par mot de passe, puis connexion refusée (RG-16)', async () => {
  await page.goto('/candidat/espace/supprimer');
  await sansDefilementHorizontal(page);
  await page.getByLabel(/Mot de passe/).fill('pas-le-bon');
  await page.getByRole('button', { name: 'Supprimer mon compte et mes données' }).click();
  await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('Mot de passe incorrect');
  await page.getByLabel(/Mot de passe/).fill(MDP);
  await page.getByRole('button', { name: 'Supprimer mon compte et mes données' }).click();
  await expect(page.getByText('Demande enregistrée.')).toBeVisible();

  await page.goto('/candidat/espace');
  await expect(page).toHaveURL(/\/candidat\/connexion/);
  await page.getByLabel('Téléphone', { exact: true }).fill(TELEPHONE);
  await page.getByLabel('Mot de passe', { exact: true }).fill(MDP);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toContainText('La suppression de ce compte et de ses données est en cours');
});
