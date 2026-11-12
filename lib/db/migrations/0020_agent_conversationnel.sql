CREATE TABLE "connaissance" (
	"id" serial PRIMARY KEY NOT NULL,
	"titre" text NOT NULL,
	"contenu" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_par" text
);
--> statement-breakpoint
CREATE TABLE "evenement_agent" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"dossier_id" integer,
	"type" text NOT NULL,
	"motif" text,
	"texte" text,
	"outils" jsonb,
	"modele" text,
	"version_prompt" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "agent_coupe" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "agent" text DEFAULT 'actif' NOT NULL;--> statement-breakpoint
ALTER TABLE "connaissance" ADD CONSTRAINT "connaissance_maj_par_user_id_fk" FOREIGN KEY ("maj_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenement_agent" ADD CONSTRAINT "evenement_agent_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenement_agent" ADD CONSTRAINT "evenement_agent_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evenement_agent_conversation_idx" ON "evenement_agent" USING btree ("conversation_id","cree_le");--> statement-breakpoint
CREATE INDEX "evenement_agent_type_idx" ON "evenement_agent" USING btree ("type","cree_le");