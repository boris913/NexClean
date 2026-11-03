'use client';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { classeBouton } from '@/components/backoffice/ui';

export default function BoutonDeconnexion() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={classeBouton('secondaire')}
      onClick={async () => {
        await authClient.signOut();
        router.replace('/admin/connexion');
        router.refresh();
      }}
    >
      Déconnexion
    </button>
  );
}
