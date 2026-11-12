CREATE TYPE "public"."statut_rendez_vous" AS ENUM('prevu', 'fait', 'annule', 'non_honore');--> statement-breakpoint
CREATE TYPE "public"."type_rendez_vous" AS ENUM('visite_site', 'appel', 'entretien', 'reunion');--> statement-breakpoint
ALTER TYPE "public"."type_evenement" ADD VALUE 'rendez_vous';--> statement-breakpoint
CREATE TABLE "rendez_vous" (
	"id" serial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"type" "type_rendez_vous" NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"planifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	"duree_minutes" integer DEFAULT 60 NOT NULL,
	"lieu" text,
	"participants" text[] DEFAULT '{}' NOT NULL,
	"statut" "statut_rendez_vous" DEFAULT 'prevu' NOT NULL,
	"compte_rendu" text,
	"cree_par" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_cree_par_user_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rendez_vous_debut_idx" ON "rendez_vous" USING btree ("debut");--> statement-breakpoint
CREATE INDEX "rendez_vous_dossier_idx" ON "rendez_vous" USING btree ("dossier_id");