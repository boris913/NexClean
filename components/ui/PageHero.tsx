import Breadcrumb from '@/components/ui/Breadcrumb';
import SectionLabel from '@/components/ui/SectionLabel';
import Reveal from '@/components/ui/Reveal';

interface PageHeroProps {
  label?: string;
  title: string;
  subtitle?: string;
  breadcrumb: { name: string; href?: string }[];
  children?: React.ReactNode;
}

/** En-tête standard des pages internes. */
export default function PageHero({ label, title, subtitle, breadcrumb, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-100 via-brand-50 to-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 right-[-10%] w-[420px] h-[420px] rounded-full bg-brand-200/80 blur-3xl animate-blob" />
        <div className="absolute inset-0 bg-dots opacity-30 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_65%)]" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-14 sm:pb-20">
        <Breadcrumb items={[{ name: 'Accueil', href: '/' }, ...breadcrumb]} />
        <Reveal>
          {label && <SectionLabel className="mb-5">{label}</SectionLabel>}
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-ink-900 mb-5 max-w-3xl">{title}</h1>
          {subtitle && <p className="text-ink-600 text-lg sm:text-xl max-w-2xl leading-relaxed">{subtitle}</p>}
          {children && <div className="mt-8 flex flex-col sm:flex-row gap-3">{children}</div>}
        </Reveal>
      </div>
    </section>
  );
}
