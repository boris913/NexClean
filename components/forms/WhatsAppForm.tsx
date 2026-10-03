'use client';

import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { getWhatsAppLink } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';

export interface FormField {
  name: string;
  label: string;
  type?: 'text' | 'tel' | 'email' | 'date' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** Occupe toute la largeur sur desktop. */
  full?: boolean;
}

interface WhatsAppFormProps {
  /** Titre de la demande, en tête du message WhatsApp. */
  subject: string;
  fields: FormField[];
  submitLabel?: string;
  /** Rappel affiché sous le bouton (ex. envoi des photos). */
  note?: string;
  formId: string;
}

export const inputClass =
  'w-full px-3 py-3 text-base sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-slate-400';

export const labelClass = 'block text-xs font-medium text-slate-600 mb-1.5';

/**
 * Formulaire de demande envoyé sur WhatsApp sous forme de message structuré.
 * Les photos / vidéos se joignent ensuite directement dans la conversation.
 */
export default function WhatsAppForm({ subject, fields, submitLabel = 'Envoyer ma demande', note, formId }: WhatsAppFormProps) {
  const empty = Object.fromEntries(fields.map((f) => [f.name, '']));
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const lines = fields
      .filter((f) => form[f.name]?.trim())
      .map((f) => `${f.label} : ${form[f.name].trim()}`);
    const msg = `Bonjour NexClean,\n\n*${subject}*\n\n${lines.join('\n')}`;

    trackEvent('quote_form_submit', { form: formId });
    window.open(getWhatsAppLink(msg), '_blank');
    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
        <CheckCircle className="w-12 h-12 text-success mb-3" strokeWidth={1.5} />
        <p className="font-semibold text-slate-900 mb-1">Demande prête !</p>
        <p className="text-sm text-slate-500 max-w-xs mb-6">
          Envoyez le message dans WhatsApp. Vous pouvez y joindre vos photos ou vidéos pour un devis plus précis.
        </p>
        <button
          onClick={() => {
            setForm(empty);
            setSuccess(false);
          }}
          className="text-sm text-primary font-medium hover:underline"
        >
          Faire une nouvelle demande
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
      {fields.map((f) => {
        const id = `${formId}-${f.name}`;
        const common = {
          id,
          name: f.name,
          required: f.required,
          value: form[f.name],
          onChange: handleChange,
          placeholder: f.placeholder,
        };
        return (
          <div key={f.name} className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label htmlFor={id} className={labelClass}>
              {f.label} {f.required && <span className="text-accent">*</span>}
            </label>
            {f.type === 'select' ? (
              <select {...common} className={inputClass}>
                <option value="">Sélectionnez…</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea {...common} rows={3} className={`${inputClass} resize-none`} />
            ) : (
              <input {...common} type={f.type || 'text'} className={inputClass} />
            )}
          </div>
        );
      })}

      <div className="sm:col-span-2 space-y-3">
        <Button type="submit" variant="whatsapp" size="lg" fullWidth disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4" />}
          {submitLabel}
        </Button>
        <p className="text-center text-xs text-slate-400">
          {note || 'Vous serez redirigé vers WhatsApp pour envoyer votre demande.'}
        </p>
      </div>
    </form>
  );
}
