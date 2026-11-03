CREATE TYPE "public"."type_dossier" AS ENUM('REC', 'NET', 'EV', 'ABO', 'MAD', 'PAR', 'RCL');--> statement-breakpoint
CREATE TYPE "public"."role_collaborateur" AS ENUM('referent', 'finances', 'direction', 'admin');--> statement-breakpoint
CREATE TYPE "public"."type_acteur" AS ENUM('collaborateur', 'client', 'candidat', 'systeme', 'anonyme');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arrondissement" (
	"id" serial PRIMARY KEY NOT NULL,
	"ville_id" integer NOT NULL,
	"nom" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	CONSTRAINT "arrondissement_ville_nom_uq" UNIQUE("ville_id","nom")
);
--> statement-breakpoint
CREATE TABLE "quartier" (
	"id" serial PRIMARY KEY NOT NULL,
	"ville_id" integer NOT NULL,
	"arrondissement_id" integer,
	"nom" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"actif" boolean DEFAULT true NOT NULL,
	CONSTRAINT "quartier_ville_nom_uq" UNIQUE("ville_id","nom")
);
--> statement-breakpoint
CREATE TABLE "ville" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"couverte" boolean DEFAULT false NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"ordre" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "ville_nom_unique" UNIQUE("nom")
);
--> statement-breakpoint
CREATE TABLE "collaborateur_profil" (
	"user_id" text PRIMARY KEY NOT NULL,
	"telephone" text,
	"capacite" integer,
	"absent_du" date,
	"absent_au" date
);
--> statement-breakpoint
CREATE TABLE "collaborateur_role" (
	"user_id" text NOT NULL,
	"role" "role_collaborateur" NOT NULL,
	CONSTRAINT "collaborateur_role_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "collaborateur_service" (
	"user_id" text NOT NULL,
	"type_dossier" "type_dossier" NOT NULL,
	CONSTRAINT "collaborateur_service_user_id_type_dossier_pk" PRIMARY KEY("user_id","type_dossier")
);
--> statement-breakpoint
CREATE TABLE "collaborateur_ville" (
	"user_id" text NOT NULL,
	"ville_id" integer NOT NULL,
	CONSTRAINT "collaborateur_ville_user_id_ville_id_pk" PRIMARY KEY("user_id","ville_id")
);
--> statement-breakpoint
CREATE TABLE "jeton_activation" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"empreinte" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"utilise_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jeton_activation_empreinte_unique" UNIQUE("empreinte")
);
--> statement-breakpoint
CREATE TABLE "journal_audit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"horodatage" timestamp with time zone DEFAULT now() NOT NULL,
	"acteur_type" "type_acteur" NOT NULL,
	"acteur_id" text,
	"action" text NOT NULL,
	"objet_type" text,
	"objet_id" text,
	"avant" jsonb,
	"apres" jsonb,
	"details" jsonb,
	"ip" text
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrondissement" ADD CONSTRAINT "arrondissement_ville_id_ville_id_fk" FOREIGN KEY ("ville_id") REFERENCES "public"."ville"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quartier" ADD CONSTRAINT "quartier_ville_id_ville_id_fk" FOREIGN KEY ("ville_id") REFERENCES "public"."ville"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quartier" ADD CONSTRAINT "quartier_arrondissement_id_arrondissement_id_fk" FOREIGN KEY ("arrondissement_id") REFERENCES "public"."arrondissement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateur_profil" ADD CONSTRAINT "collaborateur_profil_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateur_role" ADD CONSTRAINT "collaborateur_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateur_service" ADD CONSTRAINT "collaborateur_service_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateur_ville" ADD CONSTRAINT "collaborateur_ville_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateur_ville" ADD CONSTRAINT "collaborateur_ville_ville_id_ville_id_fk" FOREIGN KEY ("ville_id") REFERENCES "public"."ville"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jeton_activation" ADD CONSTRAINT "jeton_activation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "quartier_arrondissement_idx" ON "quartier" USING btree ("arrondissement_id");--> statement-breakpoint
CREATE INDEX "jeton_activation_user_idx" ON "jeton_activation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "journal_horodatage_idx" ON "journal_audit" USING btree ("horodatage");--> statement-breakpoint
CREATE INDEX "journal_action_horodatage_idx" ON "journal_audit" USING btree ("action","horodatage");--> statement-breakpoint
CREATE INDEX "journal_objet_idx" ON "journal_audit" USING btree ("objet_type","objet_id");--> statement-breakpoint
CREATE INDEX "journal_acteur_idx" ON "journal_audit" USING btree ("acteur_id");