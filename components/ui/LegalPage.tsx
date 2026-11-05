import PageHero from '@/components/ui/PageHero';
import Section from '@/components/ui/Section';

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <PageHero title={title} subtitle={`Dernière mise à jour : ${updated}`} breadcrumb={[{ name: title }]} />
      <Section spacing="sm" container="narrow">
        <div className="prose max-w-none prose-headings:font-semibold prose-headings:text-ink-900 prose-h2:text-xl prose-p:text-ink-600 prose-a:text-primary prose-strong:text-ink-900 prose-li:text-ink-600">
          {children}
        </div>
      </Section>
    </>
  );
}
