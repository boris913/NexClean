import {
  Briefcase,
  Building2,
  ClipboardCheck,
  FileText,
  MonitorSmartphone,
  Send,
  ShoppingBag,
  SprayCan,
  Trees,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';

/** `content/home-data.ts` nomme ses icônes par des chaînes : table explicite, pour garder des imports nommés. */
const ICONES: Record<string, LucideIcon> = {
  Briefcase,
  Building2,
  ClipboardCheck,
  FileText,
  MonitorSmartphone,
  Send,
  ShoppingBag,
  SprayCan,
  Trees,
  UserCheck,
};

export function icone(nom: string): LucideIcon {
  const trouvee = ICONES[nom];
  if (!trouvee) throw new Error(`Icône absente de components/sections/icones.ts : ${nom}`);
  return trouvee;
}
