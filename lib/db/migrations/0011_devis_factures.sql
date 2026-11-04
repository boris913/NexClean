CREATE TYPE "public"."mode_acceptation" AS ENUM('suivi', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."statut_devis" AS ENUM('brouillon', 'attente_direction', 'valide', 'envoye', 'accepte', 'refuse', 'expire', 'remplace');--> statement-breakpoint
CREATE TYPE "public"."type_devis" AS ENUM('devis', 'avenant');--> statement-breakpoint
CREATE TYPE "public"."type_facture" AS ENUM('acompte', 'solde', 'avoir');--> statement-breakpoint
ALTER TYPE "public"."categorie_document" ADD VALUE 'devis';--> statement-breakpoint
ALTER TYPE "public"."categorie_document" ADD VALUE 'facture';--> statement-breakpoint
ALTER TYPE "public"."categorie_document" ADD VALUE 'accuse_reception';--> statement-breakpoint
ALTER TYPE "public"."categorie_document" ADD VALUE 'attestation';--> statement-breakpoint
CREATE TABLE "devis" (
	"id" serial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"type" "type_devis" DEFAULT 'devis' NOT NULL,
	"numero" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"devis_initial_id" integer,
	"statut" "statut_devis" DEFAULT 'brouillon' NOT NULL,
	"lignes" jsonb NOT NULL,
	"taux_tva" integer NOT NULL,
	"total_ht" integer NOT NULL,
	"montant_tva" integer NOT NULL,
	"total_ttc" integer NOT NULL,
	"taux_acompte" integer NOT NULL,
	"justification_taux" text,
	"acompte" integer NOT NULL,
	"delai_recherche_jours" integer NOT NULL,
	"garantie_jours" integer NOT NULL,
	"validite_jours" integer NOT NULL,
	"conditions" text NOT NULL,
	"conditions_particulieres" text,
	"mentions_legales" text NOT NULL,
	"prolongation_jours" integer,
	"auteur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"valide_direction_par_id" text,
	"valide_direction_le" timestamp with time zone,
	"valide_par_id" text,
	"valide_le" timestamp with time zone,
	"envoye_le" timestamp with time zone,
	"expire_le" timestamp with time zone,
	"document_id" integer,
	"pdf_empreinte" text,
	"acceptation_mode" "mode_acceptation",
	"accepte_le" timestamp with time zone,
	"signataire_nom" text,
	"signataire_fonction" text,
	"acceptation_ip" text,
	"acceptation_navigateur" text,
	"acceptation_preuve_cle" text,
	"acceptation_preuve_mime" text,
	"acceptation_par_id" text,
	"refus_le" timestamp with time zone,
	"refus_motif" text
);
--> statement-breakpoint
CREATE TABLE "facture" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"type" "type_facture" NOT NULL,
	"dossier_id" integer NOT NULL,
	"devis_id" integer,
	"facture_origine_id" integer,
	"libelle" text NOT NULL,
	"lignes" jsonb NOT NULL,
	"taux_tva" integer NOT NULL,
	"total_ht" integer NOT NULL,
	"montant_tva" integer NOT NULL,
	"total_ttc" integer NOT NULL,
	"client" jsonb NOT NULL,
	"mentions_legales" text NOT NULL,
	"emise_le" timestamp with time zone DEFAULT now() NOT NULL,
	"auteur_id" text,
	CONSTRAINT "facture_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "facture_pdf" (
	"facture_id" integer PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"empreinte" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parametre_historique" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cle" text NOT NULL,
	"valeur" jsonb NOT NULL,
	"effet_le" timestamp with time zone DEFAULT now() NOT NULL,
	"auteur_id" text
);
--> statement-breakpoint
CREATE TABLE "sequence_document" (
	"sequence" text NOT NULL,
	"annee" integer NOT NULL,
	"dernier" integer NOT NULL,
	CONSTRAINT "sequence_document_sequence_annee_pk" PRIMARY KEY("sequence","annee")
);
--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_valide_direction_par_id_user_id_fk" FOREIGN KEY ("valide_direction_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_valide_par_id_user_id_fk" FOREIGN KEY ("valide_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_acceptation_par_id_user_id_fk" FOREIGN KEY ("acceptation_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facture" ADD CONSTRAINT "facture_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facture" ADD CONSTRAINT "facture_devis_id_devis_id_fk" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facture" ADD CONSTRAINT "facture_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facture_pdf" ADD CONSTRAINT "facture_pdf_facture_id_facture_id_fk" FOREIGN KEY ("facture_id") REFERENCES "public"."facture"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facture_pdf" ADD CONSTRAINT "facture_pdf_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parametre_historique" ADD CONSTRAINT "parametre_historique_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devis_dossier_idx" ON "devis" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "devis_statut_idx" ON "devis" USING btree ("statut");--> statement-breakpoint
CREATE UNIQUE INDEX "devis_numero_version_uq" ON "devis" USING btree ("numero","version");--> statement-breakpoint
CREATE INDEX "facture_dossier_idx" ON "facture" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "parametre_historique_cle_idx" ON "parametre_historique" USING btree ("cle","effet_le");--> statement-breakpoint
-- MVP2-04 RG-17 (ADR 0020) : une facture ou un avoir émis n'est jamais modifié ni supprimé ;
-- une erreur se corrige par un avoir. Idem pour le rattachement de son PDF.
CREATE OR REPLACE FUNCTION facture_interdire_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% est en ajout seul (% interdit) : corrigez par un avoir', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER facture_sans_update_delete BEFORE UPDATE OR DELETE ON "facture" FOR EACH ROW EXECUTE FUNCTION facture_interdire_modification();
--> statement-breakpoint
CREATE TRIGGER facture_sans_truncate BEFORE TRUNCATE ON "facture" FOR EACH STATEMENT EXECUTE FUNCTION facture_interdire_modification();
--> statement-breakpoint
CREATE TRIGGER facture_pdf_sans_update_delete BEFORE UPDATE OR DELETE ON "facture_pdf" FOR EACH ROW EXECUTE FUNCTION facture_interdire_modification();
--> statement-breakpoint
CREATE TRIGGER facture_pdf_sans_truncate BEFORE TRUNCATE ON "facture_pdf" FOR EACH STATEMENT EXECUTE FUNCTION facture_interdire_modification();
