# ADR 0001 – Application Next.js unique pour le site, l'espace candidat et le Back-Office

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le site nexclean.xyz est une application Next.js 15 (App Router, TypeScript, Tailwind) déployée sur Vercel, sans base de données ni authentification. Les formulaires de devis génèrent un message WhatsApp prérempli ; seule l'API `/api/candidature` a un traitement serveur (e-mail via Resend, webhook Google Sheet optionnel). Les données de référence (villes, services, métiers, tarifs, offres) vivent dans `content/` et `lib/constants.ts`.

Le projet ajoute un espace candidat et un Back-Office qui exigent persistance, authentification, rôles et pages dynamiques.

## Options envisagées

- **A. Étendre l'application existante** : espaces `/espace` (candidat) et `/admin` (Back-Office) dans le même dépôt et le même déploiement.
- **B. Application séparée** (`app.nexclean.xyz`, dépôt distinct).
- **C. Outil no-code / CRM du marché** branché sur le site.

## Décision

Option **A**. Une seule application Next.js :

- le site public reste statique / pré-rendu ;
- l'espace candidat et le Back-Office sont des segments dynamiques protégés par un middleware d'authentification ;
- le Back-Office pourra être servi sur un sous-domaine (`app.nexclean.xyz`) par réécriture, sans changer de base de code.

## Conséquences

- Un seul projet à maintenir et déployer ; design system et données de référence partagés.
- Les données de référence aujourd'hui figées dans `content/` (offres, tarifs, villes) devront progressivement migrer vers la base pour devenir administrables (grille tarifaire, offres).
- La sécurité du Back-Office repose sur une séparation stricte des routes et des contrôles d'accès côté serveur (pas seulement côté interface).
- L'option C est écartée car contraire au critère de réussite (« sans logiciel externe ») et limitante pour le PDF, le Mobile Money et les droits fins.
