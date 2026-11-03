CREATE TYPE "public"."statut_candidature" AS ENUM('recue', 'retenue', 'refusee');--> statement-breakpoint
CREATE TABLE "candidature" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidat_id" integer NOT NULL,
	"offre_slug" text NOT NULL,
	"offre_titre" text NOT NULL,
	"motivation" text,
	"statut" "statut_candidature" DEFAULT 'recue' NOT NULL,
	"referent_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"traitee_le" timestamp with time zone,
	"traitee_par" text
);
--> statement-breakpoint
CREATE TABLE "offre_responsable" (
	"offre_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offre_responsable_offre_slug_user_id_pk" PRIMARY KEY("offre_slug","user_id")
);
--> statement-breakpoint
ALTER TABLE "candidat" ADD COLUMN "attribue_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidat" ADD COLUMN "en_file_depuis" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidat" ADD COLUMN "derniere_relance_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidat" ADD COLUMN "alerte_non_traite_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidat" ADD COLUMN "compte_leger" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "candidature" ADD CONSTRAINT "candidature_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidature" ADD CONSTRAINT "candidature_referent_id_user_id_fk" FOREIGN KEY ("referent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidature" ADD CONSTRAINT "candidature_traitee_par_user_id_fk" FOREIGN KEY ("traitee_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offre_responsable" ADD CONSTRAINT "offre_responsable_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidature_candidat_offre_uq" ON "candidature" USING btree ("candidat_id","offre_slug");--> statement-breakpoint
CREATE INDEX "candidature_offre_idx" ON "candidature" USING btree ("offre_slug");--> statement-breakpoint
CREATE INDEX "candidature_referent_idx" ON "candidature" USING btree ("referent_id");