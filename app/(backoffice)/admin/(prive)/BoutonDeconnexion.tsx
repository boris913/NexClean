'use client';
import { LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth/client';

export default function BoutonDeconnexion() {
  return (
    <button
      type="button"
      className="flex w-full min-h-11 lg:min-h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100/70 hover:text-ink-900"
      onClick={async () => {
        await authClient.signOut();
        // Session fermée : navigation complète (aucun écran du Back-Office ne reste en cache).
        window.location.replace('/admin/connexion');
      }}
    >
      <LogOut aria-hidden className="h-[18px] w-[18px] text-ink-400" />
      Déconnexion
    </button>
  );
}
