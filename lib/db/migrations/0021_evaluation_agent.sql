CREATE TABLE "evaluation_agent" (
	"id" serial PRIMARY KEY NOT NULL,
	"statut" text DEFAULT 'en_cours' NOT NULL,
	"version_jeu" text NOT NULL,
	"version_prompt" text NOT NULL,
	"version_base" text NOT NULL,
	"modele" text NOT NULL,
	"nb_cas" integer NOT NULL,
	"score_interdits" real,
	"score_qualification" real,
	"score_comportement" real,
	"resultats" jsonb,
	"erreur" text,
	"lancee_par" text,
	"lancee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"terminee_le" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "evaluation_agent" ADD CONSTRAINT "evaluation_agent_lancee_par_user_id_fk" FOREIGN KEY ("lancee_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;