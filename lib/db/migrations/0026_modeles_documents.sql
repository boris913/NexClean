CREATE TYPE "public"."type_modele_document" AS ENUM('accuse_reception', 'devis', 'facture', 'avoir', 'recu', 'attestation');--> statement-breakpoint
CREATE TABLE "modele_document_version" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "type_modele_document" NOT NULL,
	"version" integer NOT NULL,
	"contenu" jsonb NOT NULL,
	"commentaire" text,
	"restaure_de" integer,
	"cree_par" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modele_document_version" ADD CONSTRAINT "modele_document_version_cree_par_user_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "modele_document_version_uq" ON "modele_document_version" USING btree ("type","version");--> statement-breakpoint
CREATE INDEX "modele_document_vigueur_idx" ON "modele_document_version" USING btree ("type","cree_le");--> statement-breakpoint
-- POST-05 RG-09 : une version de modèle n'est jamais modifiée ni supprimée (ajout seul).
CREATE OR REPLACE FUNCTION modele_document_version_interdire_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'modele_document_version est en ajout seul (% interdit)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER modele_document_version_sans_update_delete
  BEFORE UPDATE OR DELETE ON modele_document_version
  FOR EACH ROW EXECUTE FUNCTION modele_document_version_interdire_modification();