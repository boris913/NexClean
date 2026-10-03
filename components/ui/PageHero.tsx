import Breadcrumb from '@/components/ui/Breadcrumb';
import SectionLabel from '@/components/ui/SectionLabel';

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
    <section className="bg-gradient-to-b from-primary-light/60 to-white border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 sm:pt-14 sm:pb-16">
        <Breadcrumb items={[{ name: 'Accueil', href: '/' }, ...breadcrumb]} />
        {label && <SectionLabel className="mb-4">{label}</SectionLabel>}
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-slate-900 mb-4 max-w-3xl">{title}</h1>
        {subtitle && <p className="text-slate-600 text-base sm:text-lg max-w-2xl leading-relaxed">{subtitle}</p>}
        {children && <div className="mt-8 flex flex-col sm:flex-row gap-3">{children}</div>}
      </div>
    </section>
  );
}
