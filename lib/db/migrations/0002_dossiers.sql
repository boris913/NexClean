CREATE TYPE "public"."canal_demande" AS ENUM('site', 'whatsapp', 'telephone', 'email', 'visite', 'autre');--> statement-breakpoint
CREATE TYPE "public"."categorie_document" AS ENUM('piece_client', 'devis_externe', 'justificatif', 'autre');--> statement-breakpoint
CREATE TYPE "public"."type_client" AS ENUM('entreprise', 'particulier');--> statement-breakpoint
CREATE TYPE "public"."type_evenement" AS ENUM('creation', 'transition', 'modification', 'attribution', 'reaffectation', 'note', 'document', 'rattachement', 'whatsapp', 'lien_suivi', 'client');--> statement-breakpoint
CREATE TYPE "public"."statut_dossier" AS ENUM('nouvelle_demande', 'attribuee', 'en_qualification', 'a_completer', 'devis_pret', 'devis_envoye', 'accepte', 'acompte_recu', 'recherche_en_cours', 'candidats_proposes', 'placements_confirmes', 'en_cours', 'termine', 'solde_recu', 'cloture', 'refuse', 'sans_suite');--> statement-breakpoint
CREATE TABLE "client" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "type_client" NOT NULL,
	"nom" text NOT NULL,
	"contact" text,
	"whatsapp" text NOT NULL,
	"autre_telephone" text,
	"email" text,
	"ville_id" integer,
	"quartier_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_whatsapp_unique" UNIQUE("whatsapp")
);
--> statement-breakpoint
CREATE TABLE "demande" (
	"id" serial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"canal" "canal_demande" NOT NULL,
	"formulaire" text NOT NULL,
	"donnees" jsonb NOT NULL,
	"empreinte" text NOT NULL,
	"auteur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" serial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"cle" text NOT NULL,
	"nom_origine" text NOT NULL,
	"mime" text NOT NULL,
	"taille" integer NOT NULL,
	"categorie" "categorie_document" NOT NULL,
	"auteur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"supprime_le" timestamp with time zone,
	"supprime_par" text,
	CONSTRAINT "document_cle_unique" UNIQUE("cle")
);
--> statement-breakpoint
CREATE TABLE "dossier" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"type" "type_dossier" NOT NULL,
	"client_id" integer NOT NULL,
	"referent_id" text,
	"statut" "statut_dossier" DEFAULT 'nouvelle_demande' NOT NULL,
	"ville_id" integer,
	"ville_autre" text,
	"quartier_id" integer,
	"quartier_autre" text,
	"lieu" text,
	"secteur" text,
	"description" text,
	"jeton_suivi" text NOT NULL,
	"ferme_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"derniere_action_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossier_numero_unique" UNIQUE("numero"),
	CONSTRAINT "dossier_jeton_suivi_unique" UNIQUE("jeton_suivi")
);
--> statement-breakpoint
CREATE TABLE "evenement_dossier" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"horodatage" timestamp with time zone DEFAULT now() NOT NULL,
	"auteur_id" text,
	"type" "type_evenement" NOT NULL,
	"de_statut" "statut_dossier",
	"vers_statut" "statut_dossier",
	"commentaire" text,
	"avant" jsonb,
	"apres" jsonb
);
--> statement-breakpoint
CREATE TABLE "ligne_poste" (
	"id" serial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"ordre" integer NOT NULL,
	"intitule" text NOT NULL,
	"nombre" integer NOT NULL,
	"missions" text,
	"competences" text,
	"experience" text,
	"salaire" text,
	"type_contrat" text,
	"duree" text,
	"horaires" text,
	"jours_repos" text[] DEFAULT '{}'::text[] NOT NULL,
	"avantages" text,
	"date_prise_fonction" date,
	"des_que_possible" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_dossier" (
	"type" "type_dossier" NOT NULL,
	"annee" integer NOT NULL,
	"dernier" integer NOT NULL,
	CONSTRAINT "sequence_dossier_type_annee_pk" PRIMARY KEY("type","annee")
);
--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_ville_id_ville_id_fk" FOREIGN KEY ("ville_id") REFERENCES "public"."ville"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_quartier_id_quartier_id_fk" FOREIGN KEY ("quartier_id") REFERENCES "public"."quartier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demande" ADD CONSTRAINT "demande_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demande" ADD CONSTRAINT "demande_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demande" ADD CONSTRAINT "demande_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_supprime_par_user_id_fk" FOREIGN KEY ("supprime_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier" ADD CONSTRAINT "dossier_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier" ADD CONSTRAINT "dossier_referent_id_user_id_fk" FOREIGN KEY ("referent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier" ADD CONSTRAINT "dossier_ville_id_ville_id_fk" FOREIGN KEY ("ville_id") REFERENCES "public"."ville"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier" ADD CONSTRAINT "dossier_quartier_id_quartier_id_fk" FOREIGN KEY ("quartier_id") REFERENCES "public"."quartier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenement_dossier" ADD CONSTRAINT "evenement_dossier_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenement_dossier" ADD CONSTRAINT "evenement_dossier_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ligne_poste" ADD CONSTRAINT "ligne_poste_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demande_dossier_idx" ON "demande" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "demande_doublon_idx" ON "demande" USING btree ("client_id","formulaire","empreinte","cree_le");--> statement-breakpoint
CREATE INDEX "document_dossier_idx" ON "document" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "dossier_referent_idx" ON "dossier" USING btree ("referent_id");--> statement-breakpoint
CREATE INDEX "dossier_client_idx" ON "dossier" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "dossier_statut_idx" ON "dossier" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "dossier_cree_le_idx" ON "dossier" USING btree ("cree_le");--> statement-breakpoint
CREATE INDEX "evenement_dossier_idx" ON "evenement_dossier" USING btree ("dossier_id","horodatage");--> statement-breakpoint
CREATE INDEX "ligne_poste_dossier_idx" ON "ligne_poste" USING btree ("dossier_id");