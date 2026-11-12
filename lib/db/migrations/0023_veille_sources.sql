CREATE TYPE "public"."type_source_veille" AS ENUM('rss', 'site_annonces', 'appels_offres', 'api_recherche', 'saisie_assistee');--> statement-breakpoint
CREATE TABLE "source_veille" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"type" "type_source_veille" NOT NULL,
	"url" text,
	"requetes" text[] DEFAULT '{}' NOT NULL,
	"frequence_heures" integer DEFAULT 12 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"derniere_collecte_le" timestamp with time zone,
	"dernier_resultat" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "piste" ADD COLUMN "source_id" integer;--> statement-breakpoint
ALTER TABLE "piste" ADD COLUMN "requete" text;--> statement-breakpoint
ALTER TABLE "piste" ADD CONSTRAINT "piste_source_id_source_veille_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_veille"("id") ON DELETE set null ON UPDATE no action;