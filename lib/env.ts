// Variables d'environnement serveur, validées à la première lecture (M1-SOC-07).
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  /** Secret Better Auth (≥ 32 caractères aléatoires). */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** URL publique de l'application, ex. https://nexclean.xyz */
  BETTER_AUTH_URL: z.string().url(),
  /** Répertoire des documents, hors racine web (ADR 0003). */
  STORAGE_DIR: z.string().min(1).default('./storage'),
  RESEND_API_KEY: z.string().optional(),
  /** Expéditeur des e-mails du Back-Office. */
  BACKOFFICE_FROM_EMAIL: z.string().default('NexClean <no-reply@nexclean.xyz>'),
  // WhatsApp Cloud API (COM2-01, ADR 0025). Absentes : le webhook répond 404, rien n'est appelé.
  /** Secret de l'application Meta : vérifie la signature X-Hub-Signature-256 des webhooks. */
  WHATSAPP_APP_SECRET: z.string().min(16).optional(),
  /** Jeton choisi par nous, saisi dans la console Meta pour le défi de vérification du webhook. */
  WHATSAPP_VERIFY_TOKEN: z.string().min(16).optional(),
  /** Jeton d'accès (utilisateur système) : téléchargement des médias, puis envoi (COM2-02). */
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  /** Identifiant du numéro (envoi des messages, COM2-02) et du compte WhatsApp Business (synchronisation des modèles). */
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_WABA_ID: z.string().optional(),
  WHATSAPP_GRAPH_VERSION: z.string().default('v21.0'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const champs = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new Error(`Configuration invalide ou incomplète : ${champs}`);
    }
    cached = parsed.data;
  }
  return cached;
}
