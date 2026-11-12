CREATE TYPE "public"."statut_piste" AS ENUM('nouvelle', 'retenue', 'ecartee', 'contactee', 'en_conversation', 'convertie', 'sans_suite');--> statement-breakpoint
CREATE TABLE "contact_piste" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"piste_id" integer NOT NULL,
	"type" text NOT NULL,
	"canal" text NOT NULL,
	"texte" text NOT NULL,
	"collaborateur_id" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piste" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"url" text,
	"url_normalisee" text,
	"extrait" text NOT NULL,
	"publie_le" timestamp with time zone,
	"type" "type_dossier",
	"postes" text[] DEFAULT '{}' NOT NULL,
	"effectif" integer,
	"besoin" text,
	"ville_id" integer,
	"quartier_id" integer,
	"lieu_texte" text,
	"contact_nom" text,
	"contact_email" text,
	"contact_telephone" text,
	"score" integer,
	"justification" text,
	"statut" "statut_piste" DEFAULT 'nouvelle' NOT NULL,
	"motif_ecart" text,
	"assigne_a" text,
	"message" text,
	"version_prompt" text,
	"dossier_id" integer,
	"convertie_le" timestamp with time zone,
	"cree_par" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "piste_url_normalisee_unique" UNIQUE("url_normalisee")
);
--> statement-breakpoint
CREATE TABLE "signalement_client" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"url" text,
	"extrait" text NOT NULL,
	"cree_par" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_piste" ADD CONSTRAINT "contact_piste_piste_id_piste_id_fk" FOREIGN KEY ("piste_id") REFERENCES "public"."piste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_piste" ADD CONSTRAINT "contact_piste_collaborateur_id_user_id_fk" FOREIGN KEY ("collaborateur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piste" ADD CONSTRAINT "piste_ville_id_ville_id_fk" FOREIGN KEY ("ville_id") REFERENCES "public"."ville"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piste" ADD CONSTRAINT "piste_quartier_id_quartier_id_fk" FOREIGN KEY ("quartier_id") REFERENCES "public"."quartier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piste" ADD CONSTRAINT "piste_assigne_a_user_id_fk" FOREIGN KEY ("assigne_a") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piste" ADD CONSTRAINT "piste_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piste" ADD CONSTRAINT "piste_cree_par_user_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signalement_client" ADD CONSTRAINT "signalement_client_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signalement_client" ADD CONSTRAINT "signalement_client_cree_par_user_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_piste_collab_idx" ON "contact_piste" USING btree ("collaborateur_id","cree_le");--> statement-breakpoint
CREATE INDEX "contact_piste_piste_idx" ON "contact_piste" USING btree ("piste_id");--> statement-breakpoint
CREATE INDEX "piste_statut_idx" ON "piste" USING btree ("statut","score");--> statement-breakpoint
CREATE INDEX "piste_contact_idx" ON "piste" USING btree ("contact_telephone");--> statement-breakpoint
CREATE INDEX "piste_cree_idx" ON "piste" USING btree ("cree_le");