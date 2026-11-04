-- Modèle WhatsApp « Envoi du devis » (MVP2-04 RG-10) : texte identique à MODELE_ENVOI_DEVIS
-- (lib/devis/service.ts) ; un modèle déjà présent (même nom) est conservé tel quel.
INSERT INTO "modele_message" ("nom", "types", "texte") VALUES
('Envoi du devis', '{REC}', 'Bonjour {{client.contact}}, voici votre devis {{devis.numero}} pour le dossier {{dossier.numero}} ({{postes.resume}}).

Montant : {{devis.montant}}
Acompte à l’acceptation : {{devis.acompte}}
Valable jusqu’au {{devis.validite}}.

Consultez-le et acceptez-le en ligne (les 4 derniers chiffres de votre numéro vous seront demandés) : {{dossier.lien_suivi}}

{{referent.prenom}}, NEXCLEAN — {{referent.telephone}}')
ON CONFLICT ("nom") DO NOTHING;
