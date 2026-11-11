CREATE TABLE "consentement_whatsapp" (
	"numero" text PRIMARY KEY NOT NULL,
	"accord_le" timestamp with time zone,
	"formulation" text,
	"canal" text,
	"retire_le" timestamp with time zone,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etat_whatsapp" (
	"cle" text PRIMARY KEY NOT NULL,
	"valeur" jsonb NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modele_message" ADD COLUMN "meta_nom" text;--> statement-breakpoint
ALTER TABLE "modele_message" ADD COLUMN "meta_langue" text DEFAULT 'fr' NOT NULL;--> statement-breakpoint
ALTER TABLE "modele_message" ADD COLUMN "meta_parametres" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "modele_message" ADD COLUMN "meta_categorie" text;--> statement-breakpoint
ALTER TABLE "modele_message" ADD COLUMN "meta_statut" text;--> statement-breakpoint
ALTER TABLE "modele_message" ADD COLUMN "meta_synchro_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "automate" text DEFAULT 'actif' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_whatsapp" ADD COLUMN "automatique" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "message_whatsapp" ADD COLUMN "auteur_id" text;--> statement-breakpoint
ALTER TABLE "message_whatsapp" ADD COLUMN "modele" text;--> statement-breakpoint
ALTER TABLE "message_whatsapp" ADD COLUMN "categorie" text;--> statement-breakpoint
ALTER TABLE "message_whatsapp" ADD CONSTRAINT "message_whatsapp_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;