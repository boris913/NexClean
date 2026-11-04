CREATE TYPE "public"."choix_ajustement" AS ENUM('remboursement', 'credit');--> statement-breakpoint
CREATE TYPE "public"."moyen_paiement" AS ENUM('orange_money', 'mtn_momo', 'especes', 'virement', 'cheque', 'autre', 'credit_client');--> statement-breakpoint
CREATE TYPE "public"."nature_encaissement" AS ENUM('acompte', 'solde', 'autre');--> statement-breakpoint
CREATE TYPE "public"."statut_demande_annulation" AS ENUM('en_attente', 'acceptee', 'refusee');--> statement-breakpoint
CREATE TYPE "public"."statut_remboursement" AS ENUM('a_valider', 'valide', 'refuse', 'effectue');--> statement-breakpoint
CREATE TYPE "public"."type_ecriture" AS ENUM('encaissement', 'annulation', 'remboursement', 'credit');--> statement-breakpoint
ALTER TYPE "public"."categorie_document" ADD VALUE 'recu';--> statement-breakpoint
CREATE TABLE "ajustement" (
	"id" serial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"montant" integer NOT NULL,
	"choix" "choix_ajustement" NOT NULL,
	"avoir_id" integer,
	"commentaire" text,
	"auteur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demande_annulation" (
	"id" serial PRIMARY KEY NOT NULL,
	"encaissement_id" integer NOT NULL,
	"motif" text NOT NULL,
	"statut" "statut_demande_annulation" DEFAULT 'en_attente' NOT NULL,
	"demande_par_id" text,
	"demande_le" timestamp with time zone DEFAULT now() NOT NULL,
	"traitee_par_id" text,
	"traitee_le" timestamp with time zone,
	"reponse" text
);
--> statement-breakpoint
CREATE TABLE "encaissement" (
	"id" serial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"devis_id" integer,
	"type" "type_ecriture" DEFAULT 'encaissement' NOT NULL,
	"nature" "nature_encaissement" NOT NULL,
	"montant" integer NOT NULL,
	"moyen" "moyen_paiement" NOT NULL,
	"reference" text,
	"reference_normalisee" text,
	"recu_le" date NOT NULL,
	"justificatif_document_id" integer,
	"commentaire" text,
	"annule_encaissement_id" integer,
	"motif" text,
	"remboursement_id" integer,
	"recu_numero" text,
	"auteur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "encaissement_recu_numero_unique" UNIQUE("recu_numero")
);
--> statement-breakpoint
CREATE TABLE "mouvement_credit" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"montant" integer NOT NULL,
	"libelle" text NOT NULL,
	"dossier_id" integer,
	"ajustement_id" integer,
	"devis_id" integer,
	"facture_id" integer,
	"auteur_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recu_pdf" (
	"encaissement_id" integer PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"empreinte" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remboursement" (
	"id" serial PRIMARY KEY NOT NULL,
	"dossier_id" integer NOT NULL,
	"ajustement_id" integer,
	"montant" integer NOT NULL,
	"statut" "statut_remboursement" DEFAULT 'a_valider' NOT NULL,
	"prepare_par_id" text,
	"prepare_le" timestamp with time zone DEFAULT now() NOT NULL,
	"valide_par_id" text,
	"valide_le" timestamp with time zone,
	"motif_refus" text,
	"effectue_par_id" text,
	"effectue_le" timestamp with time zone,
	"encaissement_id" integer
);
--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "acompte_complet_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "derniere_relance_solde_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "montant_final_ttc" integer;--> statement-breakpoint
ALTER TABLE "devis" ADD COLUMN "deduction_credit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ajustement" ADD CONSTRAINT "ajustement_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustement" ADD CONSTRAINT "ajustement_avoir_id_facture_id_fk" FOREIGN KEY ("avoir_id") REFERENCES "public"."facture"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustement" ADD CONSTRAINT "ajustement_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demande_annulation" ADD CONSTRAINT "demande_annulation_encaissement_id_encaissement_id_fk" FOREIGN KEY ("encaissement_id") REFERENCES "public"."encaissement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demande_annulation" ADD CONSTRAINT "demande_annulation_demande_par_id_user_id_fk" FOREIGN KEY ("demande_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demande_annulation" ADD CONSTRAINT "demande_annulation_traitee_par_id_user_id_fk" FOREIGN KEY ("traitee_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encaissement" ADD CONSTRAINT "encaissement_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encaissement" ADD CONSTRAINT "encaissement_devis_id_devis_id_fk" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encaissement" ADD CONSTRAINT "encaissement_justificatif_document_id_document_id_fk" FOREIGN KEY ("justificatif_document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encaissement" ADD CONSTRAINT "encaissement_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvement_credit" ADD CONSTRAINT "mouvement_credit_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvement_credit" ADD CONSTRAINT "mouvement_credit_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvement_credit" ADD CONSTRAINT "mouvement_credit_ajustement_id_ajustement_id_fk" FOREIGN KEY ("ajustement_id") REFERENCES "public"."ajustement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvement_credit" ADD CONSTRAINT "mouvement_credit_devis_id_devis_id_fk" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvement_credit" ADD CONSTRAINT "mouvement_credit_facture_id_facture_id_fk" FOREIGN KEY ("facture_id") REFERENCES "public"."facture"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvement_credit" ADD CONSTRAINT "mouvement_credit_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recu_pdf" ADD CONSTRAINT "recu_pdf_encaissement_id_encaissement_id_fk" FOREIGN KEY ("encaissement_id") REFERENCES "public"."encaissement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recu_pdf" ADD CONSTRAINT "recu_pdf_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remboursement" ADD CONSTRAINT "remboursement_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remboursement" ADD CONSTRAINT "remboursement_ajustement_id_ajustement_id_fk" FOREIGN KEY ("ajustement_id") REFERENCES "public"."ajustement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remboursement" ADD CONSTRAINT "remboursement_prepare_par_id_user_id_fk" FOREIGN KEY ("prepare_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remboursement" ADD CONSTRAINT "remboursement_valide_par_id_user_id_fk" FOREIGN KEY ("valide_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remboursement" ADD CONSTRAINT "remboursement_effectue_par_id_user_id_fk" FOREIGN KEY ("effectue_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remboursement" ADD CONSTRAINT "remboursement_encaissement_id_encaissement_id_fk" FOREIGN KEY ("encaissement_id") REFERENCES "public"."encaissement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ajustement_dossier_idx" ON "ajustement" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "demande_annulation_encaissement_idx" ON "demande_annulation" USING btree ("encaissement_id");--> statement-breakpoint
CREATE INDEX "encaissement_dossier_idx" ON "encaissement" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "encaissement_reference_idx" ON "encaissement" USING btree ("moyen","reference_normalisee");--> statement-breakpoint
CREATE UNIQUE INDEX "encaissement_annulation_uq" ON "encaissement" USING btree ("annule_encaissement_id");--> statement-breakpoint
CREATE INDEX "mouvement_credit_client_idx" ON "mouvement_credit" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "remboursement_dossier_idx" ON "remboursement" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "remboursement_statut_idx" ON "remboursement" USING btree ("statut");
--> statement-breakpoint
-- MVP2-05 RG-02 : un Encaissement (et son reçu, et un mouvement de crédit client) n'est jamais
-- modifié ni supprimé ; une erreur se corrige par une écriture d'annulation liée.
CREATE OR REPLACE FUNCTION encaissement_interdire_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% est en ajout seul (% interdit) : corrigez par une annulation', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER encaissement_sans_update_delete BEFORE UPDATE OR DELETE ON "encaissement" FOR EACH ROW EXECUTE FUNCTION encaissement_interdire_modification();
--> statement-breakpoint
CREATE TRIGGER encaissement_sans_truncate BEFORE TRUNCATE ON "encaissement" FOR EACH STATEMENT EXECUTE FUNCTION encaissement_interdire_modification();
--> statement-breakpoint
CREATE TRIGGER recu_pdf_sans_update_delete BEFORE UPDATE OR DELETE ON "recu_pdf" FOR EACH ROW EXECUTE FUNCTION encaissement_interdire_modification();
--> statement-breakpoint
CREATE TRIGGER recu_pdf_sans_truncate BEFORE TRUNCATE ON "recu_pdf" FOR EACH STATEMENT EXECUTE FUNCTION encaissement_interdire_modification();
--> statement-breakpoint
CREATE TRIGGER mouvement_credit_sans_update_delete BEFORE UPDATE OR DELETE ON "mouvement_credit" FOR EACH ROW EXECUTE FUNCTION encaissement_interdire_modification();
--> statement-breakpoint
CREATE TRIGGER mouvement_credit_sans_truncate BEFORE TRUNCATE ON "mouvement_credit" FOR EACH STATEMENT EXECUTE FUNCTION encaissement_interdire_modification();
--> statement-breakpoint
-- Modèle WhatsApp « Relance solde » (MVP2-05 RG-09) : texte identique à MODELE_RELANCE_SOLDE
-- (lib/encaissements/modeles.ts) ; un modèle déjà présent (même nom) est conservé tel quel.
INSERT INTO "modele_message" ("nom", "types", "texte") VALUES
('Relance solde', '{REC}', 'Bonjour {{client.contact}}, sauf erreur de notre part, la facture de solde {{solde.facture}} du {{solde.emise_le}} (dossier {{dossier.numero}}) reste à régler : {{solde.reste}}.

Vos factures et reçus sont disponibles sur votre page de suivi : {{dossier.lien_suivi}}

Merci de nous indiquer la date de votre règlement.
{{referent.prenom}}, NEXCLEAN — {{referent.telephone}}')
ON CONFLICT ("nom") DO NOTHING;
