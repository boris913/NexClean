CREATE TABLE "modele_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"types" "type_dossier"[] DEFAULT '{}' NOT NULL,
	"langue" text DEFAULT 'fr' NOT NULL,
	"texte" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_par" text,
	CONSTRAINT "modele_message_nom_unique" UNIQUE("nom")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"destinataire_id" text NOT NULL,
	"type" text NOT NULL,
	"dossier_id" integer,
	"titre" text NOT NULL,
	"texte" text NOT NULL,
	"lien" text,
	"cle" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"lu_le" timestamp with time zone,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT false NOT NULL,
	"email_envoye_le" timestamp with time zone,
	"email_echec_le" timestamp with time zone,
	"email_essais" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collaborateur_profil" ADD COLUMN "derniere_attribution_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "en_file_depuis" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dossier" ADD COLUMN "derniere_relance_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "modele_message" ADD CONSTRAINT "modele_message_modifie_par_user_id_fk" FOREIGN KEY ("modifie_par") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_destinataire_id_user_id_fk" FOREIGN KEY ("destinataire_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_dossier_id_dossier_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_destinataire_idx" ON "notification" USING btree ("destinataire_id","lu_le");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_cle_uq" ON "notification" USING btree ("destinataire_id","cle");--> statement-breakpoint
CREATE INDEX "notification_email_idx" ON "notification" USING btree ("email","email_envoye_le");--> statement-breakpoint
-- Dossiers ouverts déjà sans référent : entrée dans la file « Non attribués » à leur création.
UPDATE "dossier" SET "en_file_depuis" = "cree_le" WHERE "referent_id" IS NULL AND "statut" NOT IN ('cloture', 'refuse', 'sans_suite');--> statement-breakpoint
-- Modèles de messages WhatsApp initiaux (MVP1-05 RG-16).
INSERT INTO "modele_message" ("nom", "types", "texte") VALUES
('Premier contact', '{}', 'Bonjour {{client.contact}}, je suis {{referent.prenom}} de NEXCLEAN. J''ai bien reçu votre demande n° {{dossier.numero}} ({{dossier.type}}, {{dossier.ville}}). Quand puis-je vous appeler pour en parler ?

Vous pouvez suivre votre demande ici : {{dossier.lien_suivi}}'),
('Informations complémentaires', '{}', 'Bonjour {{client.contact}}, pour avancer sur votre demande n° {{dossier.numero}}, il me manque quelques informations :
- 
- 

Merci d''avance ! {{referent.prenom}}, NEXCLEAN'),
('Relance sans réponse', '{}', 'Bonjour {{client.contact}}, je reviens vers vous au sujet de votre demande n° {{dossier.numero}}. Êtes-vous toujours intéressé(e) ? Je reste disponible au {{referent.telephone}}.

{{referent.prenom}}, NEXCLEAN'),
('Lien de suivi', '{}', 'Bonjour {{client.contact}}, voici le lien pour suivre l''avancement de votre demande n° {{dossier.numero}} : {{dossier.lien_suivi}}

NEXCLEAN'),
('Relance demande de devis', '{NET,EV,ABO}', 'Bonjour {{client.contact}}, vous avez fait une demande de devis sur notre site (n° {{dossier.numero}}). Pouvez-vous nous envoyer quelques photos ou vidéos des lieux ici, pour que nous préparions votre devis ?

{{referent.prenom}}, NEXCLEAN');
