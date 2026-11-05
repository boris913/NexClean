/**
 * Illustrations au trait (audit design A4) : remplacent les photos manquantes dans les en-têtes de page.
 * Règles : trait `currentColor` (bleu nuit par défaut), aplats bleu très clair, UN point lime (accent unique).
 * Purement décoratives (aria-hidden) ; dimension fixée par le parent (`className`).
 */
import { cx } from '@/components/ui/cx';

export type NomIllustration = 'maison' | 'immeuble' | 'equipe' | 'candidat' | 'jardin' | 'proprete';

const TRAIT = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const APLAT = 'fill-brand-50';
const SOL = <path {...TRAIT} d="M16 156h208" className="text-ink-300" />;
const ACCENT = (cx_: number, cy: number) => <circle cx={cx_} cy={cy} r="7" className="fill-cta" />;

function Maison() {
  return (
    <>
      {SOL}
      <path className={APLAT} d="M64 156V84l56-44 56 44v72z" />
      <path {...TRAIT} d="M48 96l72-58 72 58M64 84v72h112V84" />
      <path {...TRAIT} d="M106 156v-38h28v38" />
      <rect {...TRAIT} x="76" y="98" width="20" height="18" rx="2" />
      <rect {...TRAIT} x="144" y="98" width="20" height="18" rx="2" />
      <path {...TRAIT} d="M150 52V36h14v28" />
      {ACCENT(196, 40)}
    </>
  );
}

function Immeuble() {
  return (
    <>
      {SOL}
      <rect className={APLAT} x="60" y="34" width="72" height="122" />
      <rect {...TRAIT} x="60" y="34" width="72" height="122" rx="2" />
      <rect {...TRAIT} x="132" y="78" width="52" height="78" rx="2" />
      {[50, 72, 94, 116].map((y) => (
        <g key={y}>
          <path {...TRAIT} d={`M74 ${y}h14M104 ${y}h14`} />
        </g>
      ))}
      <path {...TRAIT} d="M146 96h24M146 114h24M146 132h24" />
      <path {...TRAIT} d="M88 156v-22h16v22" />
      {ACCENT(184, 52)}
    </>
  );
}

function Equipe() {
  return (
    <>
      {SOL}
      <circle className={APLAT} cx="92" cy="70" r="20" />
      <circle {...TRAIT} cx="92" cy="70" r="20" />
      <path {...TRAIT} d="M56 156v-22a24 24 0 0 1 24-24h24a24 24 0 0 1 24 24v22" />
      <circle {...TRAIT} cx="152" cy="80" r="16" />
      <path {...TRAIT} d="M128 156v-16a20 20 0 0 1 20-20h8a20 20 0 0 1 20 20v16" />
      <circle {...TRAIT} cx="176" cy="44" r="16" className="text-primary" />
      <path {...TRAIT} d="M169 44l5 5 10-10" className="text-primary" />
      {ACCENT(48, 48)}
    </>
  );
}

function Candidat() {
  return (
    <>
      {SOL}
      <rect className={APLAT} x="56" y="40" width="128" height="96" rx="8" />
      <rect {...TRAIT} x="56" y="40" width="128" height="96" rx="8" />
      <circle {...TRAIT} cx="92" cy="80" r="14" />
      <path {...TRAIT} d="M72 116a20 20 0 0 1 40 0" />
      <path {...TRAIT} d="M124 72h44M124 88h32M124 104h40" />
      <path {...TRAIT} d="M104 40v-8h32v8" />
      {ACCENT(184, 40)}
    </>
  );
}

function Jardin() {
  return (
    <>
      {SOL}
      <circle className={APLAT} cx="86" cy="76" r="36" />
      <path {...TRAIT} d="M86 156v-52M86 120l-14-12M86 110l14-12" />
      <path {...TRAIT} d="M58 98a36 36 0 1 1 56 0" />
      <path {...TRAIT} d="M140 156v-30M140 140c-10-2-16-10-16-20M140 132c10-2 16-10 16-20" />
      <path {...TRAIT} d="M170 156l6-16 6 16M186 156l6-12 6 12" />
      {ACCENT(186, 52)}
    </>
  );
}

function Proprete() {
  return (
    <>
      {SOL}
      <path className={APLAT} d="M70 92h60l-8 64H78z" />
      <path {...TRAIT} d="M64 92h72l-8 64H72z" />
      <path {...TRAIT} d="M76 92a24 24 0 0 1 48 0" />
      <path {...TRAIT} d="M156 156V96h18l8-14h-26" />
      <path {...TRAIT} d="M186 70l8-4M186 82h9M186 94l8 4" />
      <path {...TRAIT} d="M100 40v12M94 46h12M140 52v8M136 56h8" className="text-primary" />
      {ACCENT(60, 52)}
    </>
  );
}

const DESSINS: Record<NomIllustration, () => JSX.Element> = {
  maison: Maison,
  immeuble: Immeuble,
  equipe: Equipe,
  candidat: Candidat,
  jardin: Jardin,
  proprete: Proprete,
};

export default function Illustration({ nom, className }: { nom: NomIllustration; className?: string }) {
  const Dessin = DESSINS[nom];
  return (
    <svg viewBox="0 0 240 180" aria-hidden="true" focusable="false" className={cx('text-navy', className)}>
      <Dessin />
    </svg>
  );
}
