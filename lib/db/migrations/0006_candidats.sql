CREATE TYPE "public"."canal_consentement" AS ENUM('site', 'assiste');--> statement-breakpoint
CREATE TYPE "public"."categorie_document_candidat" AS ENUM('cv', 'justificatif');--> statement-breakpoint
CREATE TYPE "public"."disponibilite_candidat" AS ENUM('immediate', 'a_partir_du', 'preavis');--> statement-breakpoint
CREATE TYPE "public"."statut_candidat" AS ENUM('nouveau', 'a_contacter', 'preselectionne', 'entretien', 'propose', 'place', 'indisponible');--> statement-breakpoint
CREATE TYPE "public"."type_consentement" AS ENUM('traitement', 'contact', 'majorite');--> statement-breakpoint
CREATE TYPE "public"."type_jeton_candidat" AS ENUM('reinitialisation', 'activation');--> statement-breakpoint
CREATE TABLE "candidat" (
	"id" serial PRIMARY KEY NOT NULL,
	"telephone" text,
	"whatsapp" text,
	"email" text,
	"nom" text NOT NULL,
	"prenom" text NOT NULL,
	"ville_id" integer,
	"ville_autre" text,
	"arrondissement_id" integer,
	"quartier_id" integer,
	"quartier_autre" text,
	"repere" text,
	"zones_toute_ville" boolean DEFAULT false NOT NULL,
	"zones_arrondissement_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"zones_quartier_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"metiers" text[] DEFAULT '{}'::text[] NOT NULL,
	"secteurs" text[] DEFAULT '{}'::text[] NOT NULL,
	"types_contrat" text[] DEFAULT '{}'::text[] NOT NULL,
	"salaire_min" integer,
	"salaire_max" integer,
	"niveau_etudes" text,
	"qualifications" text,
	"competences" text[] DEFAULT '{}'::text[] NOT NULL,
	"disponibilite" "disponibilite_candidat",
	"disponible_le" date,
	"preavis" text,
	"horaires" text[] DEFAULT '{}'::text[] NOT NULL,
	"statut" "statut_candidat" DEFAULT 'nouveau' NOT NULL,
	"statut_avant_indisponible" "statut_candidat",
	"referent_id" text,
	"mot_de_passe" text,
	"canal_inscription" text DEFAULT 'site' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"profil_mis_a_jour_le" timestamp with time zone DEFAULT now() NOT NULL,
	"derniere_connexion_le" timestamp with time zone,
	"suppression_demandee_le" timestamp with time zone,
	"suppression_prevue_le" timestamp with time zone,
	"supprime_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "candidat_consentement" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidat_id" integer NOT NULL,
	"type" "type_consentement" NOT NULL,
	"version" text NOT NULL,
	"canal" "canal_consentement" NOT NULL,
	"ip" text,
	"horodatage" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidat_demande_reinitialisation" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidat_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"traitee_le" timestamp with time zone,
	"traitee_par" text
);
--> statement-breakpoint
CREATE TABLE "candidat_document" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidat_id" integer NOT NULL,
	"categorie" "categorie_document_candidat" NOT NULL,
	"cle" text NOT NULL,
	"nom_origine" text NOT NULL,
	"mime" text NOT NULL,
	"taille" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidat_document_cle_unique" UNIQUE("cle")
);
--> statement-breakpoint
CREATE TABLE "candidat_experience" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidat_id" integer NOT NULL,
	"ordre" integer NOT NULL,
	"poste" text NOT NULL,
	"employeur" text,
	"ville" text,
	"duree" text,
	"missions" text
);
--> statement-breakpoint
CREATE TABLE "candidat_jeton" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidat_id" integer NOT NULL,
	"type" "type_jeton_candidat" NOT NULL,
	"empreinte" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"utilise_le" timestamp with time zone,
	"cree_par" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidat_jeton_empreinte_unique" UNIQUE("empreinte")
);
--> statement-breakpoint
CREATE TABLE "candidat_session" (
	"empreinte" text PRIMARY KEY NOT NULL,
	"candidat_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"ip" text
);
--> statement-breakpoint
ALTER TABLE "candidat" ADD CONSTRAINT "candidat_ville_id_ville_id_fk" FOREIGN KEY ("ville_id") REFERENCES "public"."ville"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat" ADD CONSTRAINT "candidat_arrondissement_id_arrondissement_id_fk" FOREIGN KEY ("arrondissement_id") REFERENCES "public"."arrondissement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat" ADD CONSTRAINT "candidat_quartier_id_quartier_id_fk" FOREIGN KEY ("quartier_id") REFERENCES "public"."quartier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat" ADD CONSTRAINT "candidat_referent_id_user_id_fk" FOREIGN KEY ("referent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat_consentement" ADD CONSTRAINT "candidat_consentement_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat_demande_reinitialisation" ADD CONSTRAINT "candidat_demande_reinitialisation_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat_demande_reinitialisation" ADD CONSTRAINT "candidat_demande_reinitialisation_traitee_par_user_id_fk" FOREIGN KEY ("traitee_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat_document" ADD CONSTRAINT "candidat_document_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat_experience" ADD CONSTRAINT "candidat_experience_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat_jeton" ADD CONSTRAINT "candidat_jeton_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat_jeton" ADD CONSTRAINT "candidat_jeton_cree_par_user_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidat_session" ADD CONSTRAINT "candidat_session_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidat_telephone_uq" ON "candidat" USING btree ("telephone");--> statement-breakpoint
CREATE INDEX "candidat_statut_idx" ON "candidat" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "candidat_referent_idx" ON "candidat" USING btree ("referent_id");--> statement-breakpoint
CREATE INDEX "candidat_ville_idx" ON "candidat" USING btree ("ville_id");--> statement-breakpoint
CREATE INDEX "candidat_consentement_candidat_idx" ON "candidat_consentement" USING btree ("candidat_id");--> statement-breakpoint
CREATE INDEX "candidat_demande_reinit_candidat_idx" ON "candidat_demande_reinitialisation" USING btree ("candidat_id");--> statement-breakpoint
CREATE INDEX "candidat_document_candidat_idx" ON "candidat_document" USING btree ("candidat_id");--> statement-breakpoint
CREATE INDEX "candidat_experience_candidat_idx" ON "candidat_experience" USING btree ("candidat_id");--> statement-breakpoint
CREATE INDEX "candidat_jeton_candidat_idx" ON "candidat_jeton" USING btree ("candidat_id");--> statement-breakpoint
CREATE INDEX "candidat_session_candidat_idx" ON "candidat_session" USING btree ("candidat_id");