// Redirection rapide vers la connexion quand aucun cookie de session n'est présent.
// ⚠ Ce n'est PAS un contrôle d'accès : chaque page vérifie la session et les droits
// côté serveur (lib/authz/session.ts, M1-ROL-03).
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const PUBLIQUES = ['/admin/connexion', '/admin/activation', '/admin/mot-de-passe'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIQUES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '-'))) return NextResponse.next();
  if (!getSessionCookie(request)) {
    const url = new URL('/admin/connexion', request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
