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
