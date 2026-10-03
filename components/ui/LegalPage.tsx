import PageHero from '@/components/ui/PageHero';

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <PageHero title={title} subtitle={`Dernière mise à jour : ${updated}`} breadcrumb={[{ name: title }]} />
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-slate prose-headings:font-semibold prose-h2:text-xl prose-a:text-primary">
          {children}
        </div>
      </section>
    </>
  );
}
