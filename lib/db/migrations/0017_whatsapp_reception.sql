CREATE TYPE "public"."origine_message_whatsapp" AS ENUM('client', 'application', 'back_office');--> statement-breakpoint
CREATE TYPE "public"."sens_message_whatsapp" AS ENUM('entrant', 'sortant');--> statement-breakpoint
CREATE TYPE "public"."statut_message_whatsapp" AS ENUM('envoye', 'remis', 'lu', 'echec');--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"nom_profil" text,
	"client_id" integer,
	"candidat_id" integer,
	"dossier_id" integer,
	"dernier_entrant_le" timestamp with time zone,
	"dernier_sortant_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "message_whatsapp" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"wa_id" text NOT NULL,
	"sens" "sens_message_whatsapp" NOT NULL,
	"origine" "origine_message_whatsapp" NOT NULL,
	"type" text NOT NULL,
	"texte" text DEFAULT '' NOT NULL,
	"media" jsonb,
	"horodatage" timestamp with time zone NOT NULL,
	"statut" "statut_message_whatsapp",
	"statut_le" timestamp with time zone,
	"erreur" text,
	"recu_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_whatsapp_wa_id_unique" UNIQUE("wa_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_whatsapp" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"recu_le" timestamp with time zone DEFAULT now() NOT NULL,
	"corps" jsonb NOT NULL,
	"traite_le" timestamp with time zone,
	"essais" integer DEFAULT 0 NOT NULL,
	"erreur" text
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_candidat_id_candidat_id_fk" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_whatsapp" ADD CONSTRAINT "message_whatsapp_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_dossier_idx" ON "conversation" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "conversation_entrant_idx" ON "conversation" USING btree ("dernier_entrant_le");--> statement-breakpoint
CREATE INDEX "message_whatsapp_conversation_idx" ON "message_whatsapp" USING btree ("conversation_id","horodatage");--> statement-breakpoint
CREATE INDEX "webhook_whatsapp_attente_idx" ON "webhook_whatsapp" USING btree ("traite_le","essais");