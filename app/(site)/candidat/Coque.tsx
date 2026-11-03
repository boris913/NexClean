// Mise en page commune des pages de l'espace candidat (MVP2-01).
export default function Coque({ surtitre = 'Espace candidat', titre, intro, children, large }: { surtitre?: string; titre: string; intro?: React.ReactNode; children: React.ReactNode; large?: boolean }) {
  return (
    <section className="bg-slate-50 min-h-[70vh] pt-24 sm:pt-28 pb-16">
      <div className={`${large ? 'max-w-2xl' : 'max-w-md'} mx-auto px-4`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">{surtitre}</p>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink-900 mb-2">{titre}</h1>
        {intro && <div className="text-slate-600 mb-6">{intro}</div>}
        {children}
      </div>
    </section>
  );
}
