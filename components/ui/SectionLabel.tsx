interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
  tone?: 'light' | 'dark';
}

export default function SectionLabel({ children, className = '', tone = 'light' }: SectionLabelProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-bold tracking-[0.14em] uppercase px-3.5 py-1.5 rounded-full ${
        tone === 'light' ? 'text-brand-800 bg-brand-100' : 'text-brand-200 bg-white/10'
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-3 h-3 text-brand-500 animate-sparkle" fill="currentColor" aria-hidden="true">
        <path d="M12 0l3.1 8.9L24 12l-8.9 3.1L12 24l-3.1-8.9L0 12l8.9-3.1z" />
      </svg>
      {children}
    </span>
  );
}
