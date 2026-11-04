// Parcours principaux de MVP-1, sur mobile 375 px, contre l'application de production (base vierge).
// Les étapes s'enchaînent : les demandes envoyées depuis le site sont ensuite traitées dans le Back-Office.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { codeTotp, contexteMobile, lienActivation, MOT_DE_PASSE, NUMERO_DOSSIER, sansDefilementHorizontal } from './outils';

test.describe.configure({ mode: 'serial' });

let visiteur: BrowserContext;
let collaborateur: BrowserContext;
let bo: Page;
let numeroPersonnel = '';
let numeroDevis = '';
const QUARTIER_LIBRE = 'Carrefour Essai E2E';

test.beforeAll(async ({ browser, baseURL }) => {
  visiteur = await contexteMobile(browser, baseURL);
  collaborateur = await contexteMobile(browser, baseURL);
  bo = await collaborateur.newPage();
});

test.afterAll(async () => {
  await visiteur?.close();
  await collaborateur?.close();
});

test.describe('Site public', () => {
  test('pages principales lisibles sur mobile, couverture lue dans le référentiel', async () => {
    const page = await visiteur.newPage();
    // Simple lecture des pages : inutile d'attendre toutes les images (premier affichage lent).
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('#zones')).toContainText('Nous intervenons à Douala et Yaoundé');
    await expect(page.locator('#zones')).toContainText('Bonapriso');
    await expect(page).toHaveTitle(/Douala et Yaoundé/);
    await sansDefilementHorizontal(page);
    for (const chemin of ['/recrutement', '/professionnels', '/particuliers', '/contact', '/services', '/tarifs']) {
      const r = await page.goto(chemin, { waitUntil: 'domcontentloaded' });
      expect(r?.status(), chemin).toBe(200);
      await sansDefilementHorizontal(page);
    }
    await page.close();
  });

  test('« Demander du personnel » : 4 étapes, validation, brouillon et numéro de dossier', async () => {
    const page = await visiteur.newPage();
    await page.goto('/recrutement');
    await page.getByRole('link', { name: 'Demander du personnel' }).first().click();
    await expect(page.getByRole('heading', { name: 'Demander du personnel' })).toBeVisible();

    // Étape 1 : les champs obligatoires sont signalés.
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.locator('p.text-red-700').first()).toBeVisible();
    await page.getByLabel(/Entreprise \/ organisation/).last().fill('Hôtel Essai E2E');
    await page.getByLabel(/Nom du contact/).fill('Mme Essomba');
    await page.getByLabel(/Numéro WhatsApp/).fill('690 11 22 33');
    await page.getByLabel(/^E-mail/).fill('essomba@exemple.cm');
    await page.getByRole('button', { name: 'Continuer' }).click();

    // Étape 2 : lieu tiré du référentiel.
    await expect(page.getByRole('heading', { name: 'Lieu' })).toBeVisible();
    await page.selectOption('#dp-villeId', { label: 'Douala' });
    await page.selectOption('#dp-quartierId', { label: 'Akwa' });
    await page.selectOption('#dp-secteur', 'Hôtellerie');
    await sansDefilementHorizontal(page);
    await page.getByRole('button', { name: 'Continuer' }).click();

    // Étape 3 : postes (un CDD exige une durée).
    await expect(page.getByRole('heading', { name: 'Postes à pourvoir' })).toBeVisible();
    await page.locator('#dp-lignes-0-intitule').fill('Serveur');
    await page.locator('#dp-lignes-0-nombre').fill('3');
    await page.locator('#dp-lignes-0-missions').fill('Service en salle et au bar');
    await page.selectOption('#dp-lignes-0-experience', '1 à 3 ans');
    await page.selectOption('#dp-lignes-0-typeContrat', 'CDD');
    await page.getByLabel('Dès que possible').first().check();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByRole('heading', { name: 'Postes à pourvoir' })).toBeVisible();
    await page.locator('#dp-lignes-0-duree').fill('6 mois');
    await page.locator('#dp-lignes-0-salaire').fill('80 000');
    await sansDefilementHorizontal(page);

    // Le brouillon survit à un rechargement.
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Postes à pourvoir' })).toBeVisible();
    await expect(page.locator('#dp-lignes-0-intitule')).toHaveValue('Serveur');
    await page.getByRole('button', { name: 'Continuer' }).click();

    // Étape 4 : consentement obligatoire, puis envoi.
    await expect(page.getByRole('heading', { name: 'Récapitulatif' })).toBeVisible();
    await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
    await expect(page.getByText('Demande envoyée')).toHaveCount(0);
    await page.getByRole('checkbox', { name: /J’accepte que NEXCLEAN/ }).check();
    await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
    await expect(page.getByText('Demande envoyée')).toBeVisible({ timeout: 30_000 });
    numeroPersonnel = (await page.locator('p.font-mono').innerText()).trim();
    expect(numeroPersonnel).toMatch(/^REC-\d{4}-\d{5}$/);
    await sansDefilementHorizontal(page);
    await page.close();
  });

  test('devis professionnel avec « Autre quartier » : enregistré puis ouverture de WhatsApp', async () => {
    const page = await visiteur.newPage();
    await page.goto('/professionnels#devis-pro');
    await page.locator('#devis-pro-location-ville option', { hasText: 'Douala' }).waitFor({ state: 'attached' });
    await page.locator('#devis-pro-company').fill('Bureaux Essai E2E');
    await page.selectOption('#devis-pro-sector', 'Bureaux');
    await page.locator('#devis-pro-contact').fill('M. Talla');
    await page.locator('#devis-pro-phone').fill('690 44 55 66');
    await page.selectOption('#devis-pro-location-ville', { label: 'Douala' });
    await page.selectOption('#devis-pro-location-quartier', 'autre');
    await page.locator('#devis-pro-location-quartier').fill(QUARTIER_LIBRE);
    await page.locator('#devis-pro-need').fill('Entretien quotidien de 400 m² de bureaux');
    await page.locator('#devis-pro form').getByRole('checkbox').check();
    const [whatsapp] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Envoyer ma demande' }).click()]);
    await expect(page.getByRole('status')).toContainText(NUMERO_DOSSIER, { timeout: 30_000 });
    numeroDevis = (await page.getByRole('status').innerText()).match(NUMERO_DOSSIER)![0];
    // L'onglet est ouvert vide au clic (anti-blocage des fenêtres), puis dirigé vers WhatsApp une fois la demande enregistrée.
    await expect.poll(() => whatsapp.url()).toMatch(/wa\.me|whatsapp\.com/);
    await whatsapp.close();
    await page.close();
  });

  test('page de suivi : un lien inconnu ne révèle rien', async () => {
    const page = await visiteur.newPage();
    await page.goto('/suivi/jeton-inexistant');
    await expect(page.getByText('Lien invalide ou expiré')).toBeVisible();
    await page.close();
  });
});

test.describe('Back-Office', () => {
  test('sans session, le Back-Office renvoie vers la connexion', async () => {
    const page = await visiteur.newPage();
    await page.goto('/admin/dossiers');
    await expect(page).toHaveURL(/\/admin\/connexion/);
    await sansDefilementHorizontal(page);
    await page.close();
  });

  test('activation du compte, connexion et double authentification obligatoire', async () => {
    await bo.goto(lienActivation());
    // Mot de passe trop court : message visible dans la page.
    await bo.getByLabel(/^Mot de passe/).fill('court');
    await bo.getByLabel('Confirmation').fill('court');
    await bo.getByRole('button', { name: 'Activer mon compte' }).click();
    await expect(bo.getByText(/au moins 10 caractères/)).toBeVisible();
    await bo.getByLabel(/^Mot de passe/).fill(MOT_DE_PASSE);
    await bo.getByLabel('Confirmation').fill(MOT_DE_PASSE);
    await bo.getByRole('button', { name: 'Activer mon compte' }).click();
    await expect(bo.getByText('Compte activé')).toBeVisible();

    await bo.goto('/admin/connexion');
    await bo.getByLabel('E-mail').fill(process.env.E2E_EMAIL_ADMIN ?? 'ci@nexclean.test');
    await bo.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
    await bo.getByRole('button', { name: 'Se connecter' }).click();
    await expect(bo).toHaveURL(/\/admin\/securite/);

    // Étape 1 : un mauvais mot de passe est signalé comme tel.
    await bo.getByPlaceholder('Mot de passe de votre compte').fill('pas-le-bon-mot-de-passe');
    await bo.getByRole('button', { name: 'Continuer' }).click();
    await expect(bo.getByText(/Mot de passe incorrect/)).toBeVisible();
    await bo.getByPlaceholder('Mot de passe de votre compte').fill(MOT_DE_PASSE);
    await bo.getByRole('button', { name: 'Continuer' }).click();

    // Étape 2 : code QR et code à 6 chiffres.
    await expect(bo.getByRole('img', { name: /Code QR/ })).toBeVisible();
    const secret = (await bo.locator('span.font-mono').first().innerText()).trim();
    await sansDefilementHorizontal(bo);
    await bo.getByLabel('Code à 6 chiffres').fill(codeTotp(secret));
    await bo.getByRole('button', { name: 'Activer' }).click();
    await expect(bo.getByText('Vos codes de secours')).toBeVisible();
    await bo.getByRole('button', { name: 'J’ai noté mes codes' }).click();
    await expect(bo).toHaveURL(/\/admin$/);
    await sansDefilementHorizontal(bo);
  });

  test('les demandes du site arrivent dans la file « Non attribués »', async () => {
    expect(numeroPersonnel && numeroDevis, 'numéros des demandes du site').toBeTruthy();
    await bo.goto('/admin/attribution');
    await expect(bo.locator('main')).toContainText(numeroPersonnel);
    await expect(bo.locator('main')).toContainText(numeroDevis);
    await sansDefilementHorizontal(bo);

    // Page au repos (hydratée, préchargements terminés) avant de cliquer : un clic pendant le
    // préchargement du même lien peut être perdu par le routeur.
    await bo.goto('/admin/dossiers?q=' + encodeURIComponent(numeroPersonnel), { waitUntil: 'networkidle' });
    await bo.getByRole('link', { name: new RegExp(numeroPersonnel) }).first().click();
    await expect(bo.locator('h1').first()).toContainText(numeroPersonnel);
    await expect(bo.locator('main')).toContainText('Hôtel Essai E2E');
    await expect(bo.locator('main')).toContainText('Akwa');
    await bo.getByRole('link', { name: 'Postes' }).click();
    await expect(bo.locator('main')).toContainText('Postes (3 personnes)');
    await expect(bo.getByLabel('Intitulé').first()).toHaveValue('Serveur');
    await sansDefilementHorizontal(bo);
  });

  test('saisie manuelle, changement de statut et page de suivi du client', async () => {
    await bo.goto('/admin/dossiers/nouveau');
    await bo.selectOption('#type', 'REC');
    await bo.getByLabel('Entreprise / nom').fill('Résidence Saisie E2E');
    await bo.getByLabel('Nom du contact').fill('M. Ngando');
    await bo.getByLabel('Numéro WhatsApp').fill('690 77 88 99');
    await bo.selectOption('#ville', { label: 'Douala' });
    await bo.selectOption('#quartier', { label: 'Bonapriso' });
    await bo.getByLabel('Lieu d’affectation / repère').fill('Face pharmacie du rond-point');
    if ((await bo.locator('#intitule-0').count()) === 0) await bo.getByRole('button', { name: /Ajouter un poste/ }).click();
    await bo.locator('#intitule-0').fill('Agent d’entretien');
    await bo.locator('#nombre-0').fill('2');
    if (await bo.locator('#salaire-0').count()) await bo.locator('#salaire-0').fill('75 000 FCFA');
    await sansDefilementHorizontal(bo);
    await bo.getByRole('button', { name: 'Créer le dossier' }).click();
    await expect(bo.locator('h1').first()).toContainText(/REC-\d{4}-\d{5}/);
    await expect(bo.locator('main')).toContainText('Attribuée');

    await bo.selectOption('#vers', { label: 'En qualification' });
    await bo.getByRole('button', { name: 'Valider' }).click();
    await expect(bo.locator('main')).toContainText('En qualification');
    await sansDefilementHorizontal(bo);

    // Le client suit son dossier sans compte ; le salaire proposé n'y apparaît pas.
    const lienSuivi = await bo.getByLabel('Lien de suivi').inputValue();
    const client = await visiteur.newPage();
    await client.goto(lienSuivi);
    await expect(client.locator('h1')).toHaveText('En cours d’étude');
    await expect(client.locator('body')).not.toContainText('75 000');
    await expect(client.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
    await sansDefilementHorizontal(client);
    await client.close();
  });

  test('référentiel : la saisie « Autre quartier » du site est rattachée à un nouveau quartier', async () => {
    await bo.goto('/admin/referentiel', { waitUntil: 'networkidle' });
    await bo.getByRole('link', { name: 'Les rattacher au référentiel' }).click();
    await expect(bo).toHaveURL(/\/admin\/referentiel\/saisies/);
    await sansDefilementHorizontal(bo);
    const carte = bo.locator('div').filter({ hasText: `« ${QUARTIER_LIBRE} »` }).filter({ has: bo.getByRole('button', { name: 'Rattacher les dossiers' }) }).last();
    await carte.getByLabel('Nouveau quartier').check();
    await carte.getByLabel('Arrondissement').selectOption({ label: 'Douala I' });
    await carte.getByRole('button', { name: 'Rattacher les dossiers' }).click();
    await expect(bo.getByText(/1 dossier\(s\) rattaché\(s\)/)).toBeVisible();
    await expect(bo.getByText('Aucune saisie à revoir.')).toBeVisible();

    await bo.goto('/admin/dossiers?q=' + encodeURIComponent(numeroDevis), { waitUntil: 'networkidle' });
    await bo.getByRole('link', { name: new RegExp(numeroDevis) }).first().click();
    await expect(bo.locator('main')).toContainText(QUARTIER_LIBRE);
  });

  test('déconnexion', async () => {
    await bo.goto('/admin');
    // Sur mobile, la déconnexion est dans le tiroir de navigation.
    await bo.getByRole('button', { name: 'Menu', exact: true }).click();
    await bo.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(bo).toHaveURL(/\/admin\/connexion/);
    await bo.goto('/admin/dossiers');
    await expect(bo).toHaveURL(/\/admin\/connexion/);
  });
});
