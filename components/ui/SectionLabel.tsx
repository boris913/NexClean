interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export default function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-primary bg-primary-light px-3 py-1.5 rounded-full ${className}`}
    >
      {children}
    </span>
  );
}
