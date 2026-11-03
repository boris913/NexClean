// Formulaires de devis « enregistrer d'abord, puis WhatsApp » (MVP1-04, ADR 0022).
// Module pur partagé navigateur / serveur : configuration des champs, type de dossier,
// validation et construction du message WhatsApp (identique à l'existant, enrichi).
import { normaliserTelephone } from '@/lib/telephone';
import type { DossierType } from '@/lib/domain/referentiels';

export interface FormField {
  name: string;
  label: string;
  /** « lieu » : Ville + Quartier issus du référentiel, avec « Autre » (RG-02). */
  type?: 'text' | 'tel' | 'email' | 'date' | 'select' | 'textarea' | 'lieu';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** Occupe toute la largeur sur desktop. */
  full?: boolean;
  /** Champ « lieu » : une seule ligne « Ville / quartier : Akwa, Douala » dans le message (sinon « Ville » et « Quartier »). */
  messageCombine?: boolean;
}

export interface ConfigDevis {
  formId: string;
  subject: string;
  /** Rappel affiché sous le bouton (ex. envoi des photos). */
  note?: string;
  fields: FormField[];
}

export interface ValeurLieu {
  villeId: number | null;
  villeAutre: string;
  quartierId: number | null;
  quartierAutre: string;
}

export const lieuVide = (): ValeurLieu => ({ villeId: null, villeAutre: '', quartierId: null, quartierAutre: '' });

/** Noms affichés, résolus à partir du référentiel (ou de la saisie « Autre »). */
export interface NomsLieu {
  ville: string | null;
  quartier: string | null;
}

// ─── Type de dossier (RG-04) ──────────────────────────────────

export const SERVICE_EV = 'Entretien Espaces Verts';
export const SERVICE_ABO = 'Entretien Régulier (Abonnement)';

export function typeDossierPour(formId: string, valeurs: Record<string, string>): DossierType {
  if (formId === 'devis-espaces-verts') return 'EV';
  if (formId === 'devis') {
    if (valeurs.service === SERVICE_EV) return 'EV';
    if (valeurs.service === SERVICE_ABO) return 'ABO';
  }
  return 'NET';
}

// ─── Validation ───────────────────────────────────────────────

const MAX_TEXTE = 200;
const MAX_ZONE = 3000;

export interface DemandeDevisValide {
  valeurs: Record<string, string>;
  lieu: { villeId: number | null; villeAutre: string | null; quartierId: number | null; quartierAutre: string | null };
  whatsapp: string;
}

export function validerDevis(
  config: ConfigDevis,
  entree: { valeurs?: unknown; lieu?: unknown; consentement?: unknown },
): { ok: true; donnees: DemandeDevisValide } | { ok: false; erreurs: Record<string, string> } {
  const erreurs: Record<string, string> = {};
  const brut = (entree.valeurs && typeof entree.valeurs === 'object' ? entree.valeurs : {}) as Record<string, unknown>;
  const valeurs: Record<string, string> = {};
  let whatsapp: string | null = null;
  let lieu: DemandeDevisValide['lieu'] = { villeId: null, villeAutre: null, quartierId: null, quartierAutre: null };

  for (const f of config.fields) {
    if (f.type === 'lieu') {
      const l = (entree.lieu && typeof entree.lieu === 'object' ? entree.lieu : {}) as Partial<ValeurLieu>;
      const id = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
      const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null);
      lieu = { villeId: id(l.villeId), villeAutre: id(l.villeId) ? null : txt(l.villeAutre), quartierId: id(l.quartierId), quartierAutre: id(l.quartierId) ? null : txt(l.quartierAutre) };
      if (f.required && !lieu.villeId && !lieu.villeAutre) erreurs[`${f.name}.ville`] = 'Ville obligatoire';
      if (f.required && !lieu.quartierId && !lieu.quartierAutre) erreurs[`${f.name}.quartier`] = 'Quartier obligatoire';
      continue;
    }
    const v = typeof brut[f.name] === 'string' ? (brut[f.name] as string).trim() : '';
    if (!v) {
      if (f.required) erreurs[f.name] = `${f.label} : champ obligatoire`;
      continue;
    }
    const max = f.type === 'textarea' ? MAX_ZONE : MAX_TEXTE;
    if (v.length > max) erreurs[f.name] = `${f.label} : ${max} caractères maximum`;
    else if (f.type === 'select' && f.options && !f.options.includes(v)) erreurs[f.name] = `${f.label} : choix invalide`;
    else if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) erreurs[f.name] = `${f.label} : date invalide`;
    else if (f.type === 'tel') {
      const n = normaliserTelephone(v);
      if (!n) erreurs[f.name] = 'Numéro invalide (ex. 6 90 00 00 00)';
      else whatsapp ??= n;
    }
    valeurs[f.name] = v;
  }
  if (entree.consentement !== true) erreurs.consentement = 'Votre accord est nécessaire pour envoyer la demande';
  if (!whatsapp && !Object.keys(erreurs).some((k) => config.fields.find((f) => f.name === k)?.type === 'tel')) erreurs._ = 'Numéro de téléphone manquant';
  if (Object.keys(erreurs).length) return { ok: false, erreurs };
  return { ok: true, donnees: { valeurs, lieu, whatsapp: whatsapp! } };
}

// ─── Message WhatsApp (RG-01, non-régression) ─────────────────

/**
 * Message structuré identique à l'existant (« Libellé : valeur » pour chaque champ rempli),
 * avec en tête « Demande n° … » et en pied le lien de suivi lorsque la demande est enregistrée.
 */
export function construireMessage(
  config: ConfigDevis,
  valeurs: Record<string, string>,
  noms: NomsLieu,
  enregistrement?: { numero: string; lienSuivi: string } | null,
): string {
  const lignes: string[] = [];
  for (const f of config.fields) {
    if (f.type === 'lieu') {
      const ville = noms.ville?.trim();
      const quartier = noms.quartier?.trim();
      if (f.messageCombine) {
        const t = [quartier, ville].filter(Boolean).join(', ');
        if (t) lignes.push(`${f.label} : ${t}`);
      } else {
        if (ville) lignes.push(`Ville : ${ville}`);
        if (quartier) lignes.push(`Quartier : ${quartier}`);
      }
      continue;
    }
    const v = valeurs[f.name]?.trim();
    if (v) lignes.push(`${f.label} : ${v}`);
  }
  const tete = enregistrement ? `Demande n° ${enregistrement.numero}\n\n` : '';
  const pied = enregistrement ? `\n\nSuivi de ma demande : ${enregistrement.lienSuivi}` : '';
  return `${tete}Bonjour NexClean,\n\n*${config.subject}*\n\n${lignes.join('\n')}${pied}`;
}
