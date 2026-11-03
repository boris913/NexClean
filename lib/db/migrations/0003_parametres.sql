CREATE TABLE "parametre" (
	"cle" text PRIMARY KEY NOT NULL,
	"valeur" jsonb NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_par" text
);
--> statement-breakpoint
ALTER TABLE "parametre" ADD CONSTRAINT "parametre_modifie_par_user_id_fk" FOREIGN KEY ("modifie_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;