CREATE TABLE "journal_ia" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tache" text NOT NULL,
	"modele" text NOT NULL,
	"version_prompt" text NOT NULL,
	"jetons_entree" integer,
	"jetons_sortie" integer,
	"duree_ms" integer NOT NULL,
	"issue" text NOT NULL,
	"erreur" text,
	"dossier_id" integer,
	"collaborateur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestion_ia" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"tache" text NOT NULL,
	"contenu" jsonb NOT NULL,
	"version_prompt" text NOT NULL,
	"statut" text DEFAULT 'proposee' NOT NULL,
	"traite_le" timestamp with time zone,
	"traite_par" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_ia" ADD CONSTRAINT "journal_ia_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_ia" ADD CONSTRAINT "journal_ia_collaborateur_id_user_id_fk" FOREIGN KEY ("collaborateur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_ia" ADD CONSTRAINT "suggestion_ia_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_ia" ADD CONSTRAINT "suggestion_ia_traite_par_user_id_fk" FOREIGN KEY ("traite_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_ia_cree_idx" ON "journal_ia" USING btree ("cree_le");--> statement-breakpoint
CREATE INDEX "suggestion_ia_dossier_idx" ON "suggestion_ia" USING btree ("dossier_id","tache","cree_le");