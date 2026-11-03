import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Back-Office', template: '%s · Back-Office NEXCLEAN' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-ink-50 text-ink-900">{children}</div>;
}
