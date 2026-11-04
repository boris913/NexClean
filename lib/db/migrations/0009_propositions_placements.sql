CREATE TYPE "public"."mode_accord" AS ENUM('espace', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."mode_confirmation" AS ENUM('client', 'preuve');--> statement-breakpoint
CREATE TYPE "public"."retour_client" AS ENUM('rencontrer', 'ne_correspond_pas');--> statement-breakpoint
CREATE TYPE "public"."statut_placement" AS ENUM('annonce', 'confirme', 'rompu_garantie', 'termine', 'abandonne');--> statement-breakpoint
CREATE TYPE "public"."statut_proposition" AS ENUM('en_attente_accord', 'proposee', 'entretien', 'retenue', 'refusee', 'placee', 'refusee_candidat', 'retiree');--> statement-breakpoint
ALTER TYPE "public"."type_evenement" ADD VALUE 'proposition';--> statement-breakpoint
ALTER TYPE "public"."type_evenement" ADD VALUE 'placement';--> statement-breakpoint
CREATE TABLE "acces_profil" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposition_id" integer NOT NULL,
	"empreinte" text NOT NULL,
	"objet" text DEFAULT 'profil' NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"revoque_le" timestamp with time zone,
	"auteur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acces_profil_empreinte_unique" UNIQUE("empreinte")
);
--> statement-breakpoint
CREATE TABLE "notification_candidat" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidat_id" integer NOT NULL,
	"titre" text NOT NULL,
	"texte" text NOT NULL,
	"lien" text,
	"cle" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"lu_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "placement" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposition_id" integer NOT NULL,
	"dossier_id" integer NOT NULL,
	"ligne_poste_id" integer NOT NULL,
	"candidat_id" integer NOT NULL,
	"statut" "statut_placement" DEFAULT 'annonce' NOT NULL,
	"date_prevue" date NOT NULL,
	"poste" text NOT NULL,
	"salaire" text,
	"remplacement" boolean DEFAULT false NOT NULL,
	"remplace_placement_id" integer,
	"auteur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"confirme_le" timestamp with time zone,
	"confirmation_mode" "mode_confirmation",
	"date_prise_de_poste" date,
	"signataire_nom" text,
	"signataire_fonction" text,
	"confirmation_ip" text,
	"confirme_par_id" text,
	"preuve_cle" text,
	"preuve_mime" text,
	"preuve_nom" text,
	"fin_le" date,
	"fin_motif" text
);
--> statement-breakpoint
CREATE TABLE "proposition" (
	"id" serial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"ligne_poste_id" integer NOT NULL,
	"candidat_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"statut" "statut_proposition" DEFAULT 'en_attente_accord' NOT NULL,
	"auteur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"salaire_communicable" boolean DEFAULT false NOT NULL,
	"accord_mode" "mode_accord",
	"accord_le" timestamp with time zone,
	"accord_par_id" text,
	"accord_preuve_cle" text,
	"accord_preuve_mime" text,
	"accord_ip" text,
	"motif" text,
	"reponse_le" timestamp with time zone,
	"relance_accord_le" timestamp with time zone,
	"numero_communicable" boolean DEFAULT false NOT NULL,
	"entretien_le" timestamp with time zone,
	"entretien_lieu" text,
	"decision_le" timestamp with time zone,
	"retour_client" "retour_client",
	"retour_client_motif" text,
	"retour_client_le" timestamp with time zone,
	"acces_revoque_le" timestamp with time zone,
	"remplace_placement_id" integer
);
--> statement-breakpoint
CREATE TABLE "verification_client" (
	"cle" text PRIMARY KEY NOT NULL,
	"echecs" integer DEFAULT 0 NOT NULL,
	"premier_echec_le" timestamp with time zone,
	"bloque_jusqu_a" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "delai_recherche_jours" integer;--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "alerte_echeance_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "recherche_cloture_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "recherche_cloture_motif" text;--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "placements_retenus" integer;--> statement-breakpoint
ALTER TABLE "acces_profil" ADD CONSTRAINT "acces_profil_proposition_id_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."proposition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acces_profil" ADD CONSTRAINT "acces_profil_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_candidat" ADD CONSTRAINT "notification_candidat_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement" ADD CONSTRAINT "placement_proposition_id_proposition_id_fk" FOREIGN KEY ("proposition_id") REFERENCES "public"."proposition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement" ADD CONSTRAINT "placement_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement" ADD CONSTRAINT "placement_ligne_poste_id_ligne_poste_id_fk" FOREIGN KEY ("ligne_poste_id") REFERENCES "public"."ligne_poste"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement" ADD CONSTRAINT "placement_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement" ADD CONSTRAINT "placement_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement" ADD CONSTRAINT "placement_confirme_par_id_user_id_fk" FOREIGN KEY ("confirme_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposition" ADD CONSTRAINT "proposition_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposition" ADD CONSTRAINT "proposition_ligne_poste_id_ligne_poste_id_fk" FOREIGN KEY ("ligne_poste_id") REFERENCES "public"."ligne_poste"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposition" ADD CONSTRAINT "proposition_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposition" ADD CONSTRAINT "proposition_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposition" ADD CONSTRAINT "proposition_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposition" ADD CONSTRAINT "proposition_accord_par_id_user_id_fk" FOREIGN KEY ("accord_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acces_profil_proposition_idx" ON "acces_profil" USING btree ("proposition_id");--> statement-breakpoint
CREATE INDEX "notification_candidat_idx" ON "notification_candidat" USING btree ("candidat_id","lu_le");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_candidat_cle_uq" ON "notification_candidat" USING btree ("candidat_id","cle");--> statement-breakpoint
CREATE INDEX "placement_dossier_idx" ON "placement" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "placement_ligne_idx" ON "placement" USING btree ("ligne_poste_id");--> statement-breakpoint
CREATE INDEX "placement_candidat_idx" ON "placement" USING btree ("candidat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "placement_proposition_uq" ON "placement" USING btree ("proposition_id") WHERE "placement"."statut" <> 'abandonne';--> statement-breakpoint
CREATE INDEX "proposition_dossier_idx" ON "proposition" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "proposition_candidat_idx" ON "proposition" USING btree ("candidat_id");--> statement-breakpoint
CREATE INDEX "proposition_statut_idx" ON "proposition" USING btree ("statut");--> statement-breakpoint
CREATE UNIQUE INDEX "proposition_active_uq" ON "proposition" USING btree ("ligne_poste_id","candidat_id") WHERE "proposition"."statut" NOT IN ('refusee', 'refusee_candidat', 'retiree');