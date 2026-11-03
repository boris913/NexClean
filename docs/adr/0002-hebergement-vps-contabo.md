# ADR 0002 – Hébergement complet sur un VPS Contabo (Ubuntu), PostgreSQL auto-hébergé

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange
- **Remplace :** l'hébergement Vercel actuel (`vercel.json`, région `iad1`)

## Contexte

L'ADR 0001 retient une application Next.js unique. Elle a désormais besoin d'une base relationnelle, d'une authentification et d'un stockage de fichiers privés. Le brief exige sauvegardes, journalisation et protection des documents. Le budget est serré et l'exploitation sera assurée par une seule personne (Ange).

Options écartées : Supabase managé (coût récurrent, choix du client) ; Vercel + base sur VPS (PostgreSQL exposé sur Internet, latence inter-réseaux, pression de connexions des fonctions serverless).

## Décision

- **Tout est hébergé sur un VPS Contabo Cloud VPS (Ubuntu), région UE (Allemagne)** : application Next.js (site public, espace candidat, Back-Office), PostgreSQL, fichiers.
- **Déploiement via Coolify** (ou Docker Compose équivalent) : build depuis Git, HTTPS automatique, reverse proxy.
- **PostgreSQL non exposé** sur Internet ; accessible uniquement depuis le réseau Docker interne.
- **Authentification intégrée à l'application** (bibliothèque type Better Auth / Auth.js), sessions et comptes en base.
- **Sauvegardes quotidiennes chiffrées hors serveur** (base + documents) vers un stockage objet externe (Contabo Object Storage ou Backblaze B2), avec procédure de restauration testée.
- **Durcissement minimal** : pare-feu (ports 22/80/443 uniquement), SSH par clé, fail2ban, mises à jour de sécurité automatiques.
- L'hébergement Vercel est abandonné ; `vercel.json` et la région `iad1` deviennent obsolètes.

## Conséquences

- Coût fixe et prévisible ; aucune dépendance à un BaaS.
- **Ange est seul responsable** des mises à jour, de la surveillance, des sauvegardes et des restaurations : risque de « bus factor = 1 » à documenter (livrable « documentation d'administration et de maintenance »).
- Pas de CDN par défaut : les ressources statiques sont servies depuis l'UE ; un CDN (ex. Cloudflare en proxy) pourra être ajouté si la performance mobile au Cameroun l'exige.
- Les en-têtes de sécurité actuellement définis dans `vercel.json` doivent être conservés via `next.config.ts` (déjà présents) ou le reverse proxy.
- Une supervision minimale (disponibilité, espace disque, échec de sauvegarde) devra être mise en place.
