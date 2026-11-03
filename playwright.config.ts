// Tests de bout en bout (Définition de « terminé » MVP-1 : parcours principaux, sur mobile 375 px).
// Ils visent une application déjà démarrée, avec une base vierge initialisée :
//   E2E_BASE_URL          adresse de l'application (défaut http://localhost:3000)
//   E2E_LIEN_ACTIVATION   lien d'activation du premier administrateur (sortie de initialiser.cjs)
//   E2E_CANAL_NAVIGATEUR  facultatif, ex. « chrome » pour utiliser le Chrome installé en local
// En CI : job « e2e » de .github/workflows/ci.yml (composition Docker de production).
import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  // Un seul parcours, dans l'ordre : les tests s'appuient sur les données créées par les précédents.
  fullyParallel: false,
  workers: 1,
  // Pas de relance : le parcours consomme un lien d'activation à usage unique.
  retries: 0,
  // Large : le premier affichage d'une page optimise ses images (lent sur une petite machine).
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'mobile-375',
      use: {
        browserName: 'chromium',
        channel: process.env.E2E_CANAL_NAVIGATEUR || undefined,
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
