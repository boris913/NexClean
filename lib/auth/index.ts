// Configuration Better Auth des collaborateurs (ADR 0016 ; M1-AUT-01..08).
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { env } from '@/lib/env';
import { ipDepuisEnTetes, journaliser } from '@/lib/audit';
import { echapperHtml, envoyerEmail } from '@/lib/email';
import { hacherMotDePasse, LONGUEUR_MIN_COLLABORATEUR, verifierMotDePasse } from './mot-de-passe';
import { ACTION_ECHEC, compterEchecsRecents, doitBloquer } from './verrouillage';

const HUIT_HEURES = 8 * 60 * 60;

function creerAuth() {
  const e = env();
  return betterAuth({
    secret: e.BETTER_AUTH_SECRET,
    baseURL: e.BETTER_AUTH_URL,
    appName: 'NEXCLEAN Back-Office',
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        rateLimit: schema.rateLimit,
      },
    }),
    user: {
      additionalFields: {
        active: { type: 'boolean', required: false, defaultValue: true, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      // M1-AUT-03 : pas d'inscription libre, comptes créés par un administrateur.
      disableSignUp: true,
      minPasswordLength: LONGUEUR_MIN_COLLABORATEUR,
      maxPasswordLength: 128,
      password: { hash: hacherMotDePasse, verify: verifierMotDePasse },
      // M1-AUT-07 : lien de réinitialisation à usage unique, 30 min.
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await envoyerEmail({
          to: user.email,
          subject: 'Réinitialisation de votre mot de passe NEXCLEAN',
          text: `Bonjour ${user.name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) :\n${url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
          html: `<p>Bonjour ${echapperHtml(user.name)},</p><p>Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) :</p><p><a href="${echapperHtml(url)}">Choisir un nouveau mot de passe</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
        });
      },
      onPasswordReset: async ({ user }) => {
        await journaliser({ acteurType: 'collaborateur', acteurId: user.id, action: 'auth.mot_de_passe_reinitialise', objetType: 'user', objetId: user.id });
      },
    },
    // M1-AUT-05 : expiration après 8 h d'inactivité (fenêtre glissante rafraîchie toutes les 5 min).
    session: { expiresIn: HUIT_HEURES, updateAge: 5 * 60 },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'] },
      useSecureCookies: e.BETTER_AUTH_URL.startsWith('https://'),
    },
    telemetry: { enabled: false },
    databaseHooks: {
      session: {
        create: {
          // M1-AUT-04 : un compte désactivé ne peut pas ouvrir de session.
          before: async (session) => {
            const [u] = await getDb().select({ active: schema.user.active }).from(schema.user).where(eq(schema.user.id, session.userId));
            if (!u?.active) return false;
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-in/email') return;
        const email = String((ctx.body as { email?: string } | undefined)?.email ?? '').trim().toLowerCase();
        const ip = ctx.request ? ipDepuisEnTetes(ctx.request.headers) : null;
        const echecs = await compterEchecsRecents(email, ip);
        if (doitBloquer(echecs.compte, echecs.ip)) {
          await journaliser({ acteurType: 'anonyme', action: 'auth.connexion_bloquee', details: { email }, ip });
          throw new APIError('TOO_MANY_REQUESTS', {
            message: 'Trop de tentatives. Réessayez dans 15 minutes.',
          });
        }
        const [u] = await getDb().select({ id: schema.user.id, active: schema.user.active }).from(schema.user).where(eq(schema.user.email, email));
        if (u && !u.active) {
          await journaliser({ acteurType: 'collaborateur', acteurId: u.id, action: 'auth.connexion_refusee_compte_desactive', ip });
          throw new APIError('FORBIDDEN', { message: 'Ce compte est désactivé.' });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const ip = ctx.request ? ipDepuisEnTetes(ctx.request.headers) : null;
        const echec = isAPIError(ctx.context.returned);
        const userId = ctx.context.newSession?.user.id ?? null;
        switch (ctx.path) {
          case '/sign-in/email': {
            const email = String((ctx.body as { email?: string } | undefined)?.email ?? '').trim().toLowerCase();
            if (echec) {
              const statut = (ctx.context.returned as APIError).status;
              // Les blocages et comptes désactivés sont déjà journalisés dans le hook « before ».
              if (statut !== 'TOO_MANY_REQUESTS' && statut !== 'FORBIDDEN') {
                await journaliser({ acteurType: 'anonyme', action: ACTION_ECHEC, details: { email }, ip });
              }
            } else {
              await journaliser({ acteurType: 'collaborateur', acteurId: userId, action: userId ? 'auth.connexion' : 'auth.mot_de_passe_ok_2fa_requise', details: { email }, ip });
            }
            break;
          }
          case '/two-factor/verify-totp':
          case '/two-factor/verify-backup-code':
            await journaliser({
              acteurType: 'collaborateur',
              acteurId: userId,
              action: echec ? 'auth.2fa_echec' : ctx.path.endsWith('backup-code') ? 'auth.connexion_code_secours' : 'auth.connexion',
              ip,
            });
            break;
          case '/two-factor/enable':
          case '/two-factor/disable':
            if (!echec) {
              const session = ctx.context.session;
              await journaliser({ acteurType: 'collaborateur', acteurId: session?.user.id ?? null, action: ctx.path.endsWith('enable') ? 'auth.2fa_activation_demandee' : 'auth.2fa_desactivee', ip });
            }
            break;
          case '/sign-out':
            break;
        }
      }),
    },
    plugins: [
      twoFactor({
        issuer: 'NEXCLEAN',
        backupCodeOptions: { amount: 10, length: 10 },
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof creerAuth>;
const globalForAuth = globalThis as unknown as { auth?: Auth };

/** Instance Better Auth, créée à la première utilisation. */
export function getAuth(): Auth {
  if (!globalForAuth.auth) globalForAuth.auth = creerAuth();
  return globalForAuth.auth;
}
