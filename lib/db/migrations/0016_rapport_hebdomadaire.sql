CREATE TABLE "rapport_hebdomadaire" (
	"id" serial PRIMARY KEY NOT NULL,
	"semaine" date NOT NULL,
	"portee" text NOT NULL,
	"contenu" jsonb NOT NULL,
	"genere_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rapport_hebdomadaire_uq" ON "rapport_hebdomadaire" USING btree ("semaine","portee");