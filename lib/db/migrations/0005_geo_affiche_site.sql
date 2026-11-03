ALTER TABLE "quartier" ADD COLUMN "affiche_site" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Quartiers affichés jusqu'ici en dur sur le site (content/zones-coverage.ts, zones « actives »).
UPDATE "quartier" SET "affiche_site" = true
WHERE "ville_id" = (SELECT "id" FROM "ville" WHERE "nom" = 'Douala')
  AND "nom" IN ('Bonapriso', 'Akwa', 'Bonanjo', 'Bali', 'Makepe', 'Bonamoussadi', 'Deido', 'New Bell');
