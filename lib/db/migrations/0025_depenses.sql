CREATE TABLE "categorie_depense" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"ordre" integer DEFAULT 100 NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "depense" (
	"id" serial PRIMARY KEY NOT NULL,
	"depense_le" date NOT NULL,
	"categorie_id" integer NOT NULL,
	"libelle" text NOT NULL,
	"montant" integer NOT NULL,
	"moyen" "moyen_paiement" NOT NULL,
	"reference" text,
	"ville_id" integer,
	"dossier_id" integer,
	"service" "type_dossier",
	"commentaire" text,
	"justificatif_cle" text,
	"justificatif_nom" text,
	"justificatif_mime" text,
	"justificatif_taille" integer,
	"auteur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_par_id" text,
	"annulee_le" timestamp with time zone,
	"annulee_par_id" text,
	"motif_annulation" text,
	CONSTRAINT "depense_justificatif_cle_unique" UNIQUE("justificatif_cle"),
	CONSTRAINT "depense_montant_positif" CHECK ("depense"."montant" > 0)
);
--> statement-breakpoint
ALTER TABLE "depense" ADD CONSTRAINT "depense_categorie_id_categorie_depense_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categorie_depense"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depense" ADD CONSTRAINT "depense_ville_id_ville_id_fk" FOREIGN KEY ("ville_id") REFERENCES "public"."ville"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depense" ADD CONSTRAINT "depense_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depense" ADD CONSTRAINT "depense_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depense" ADD CONSTRAINT "depense_maj_par_id_user_id_fk" FOREIGN KEY ("maj_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depense" ADD CONSTRAINT "depense_annulee_par_id_user_id_fk" FOREIGN KEY ("annulee_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categorie_depense_libelle_uq" ON "categorie_depense" USING btree (lower("libelle"));--> statement-breakpoint
CREATE INDEX "depense_date_idx" ON "depense" USING btree ("depense_le");--> statement-breakpoint
CREATE INDEX "depense_categorie_idx" ON "depense" USING btree ("categorie_id");--> statement-breakpoint
CREATE INDEX "depense_dossier_idx" ON "depense" USING btree ("dossier_id");--> statement-breakpoint
-- POST-03 RG-02 : liste initiale des catégories de dépenses (valeur par défaut, modifiable par la Direction).
INSERT INTO "categorie_depense" ("libelle", "ordre") VALUES
('Salaires et primes', 10),
('Transport', 20),
('Produits et consommables', 30),
('Matériel', 40),
('Loyer et charges', 50),
('Communication et publicité', 60),
('Téléphone et internet', 70),
('Impôts et taxes', 80),
('Frais bancaires et mobile money', 90),
('Autre', 1000);