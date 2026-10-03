'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Loader2, Upload, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { JOB_CATEGORIES, CV_MAX_SIZE_MB } from '@/content/jobs-data';
import { CONTACT, ACTIVE_CITIES, getWhatsAppLink } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'success'; reference: string } | { kind: 'error'; message: string } | { kind: 'fallback'; message: string };

const Field = ({ label, name, required, children }: { label: string; name: string; required?: boolean; children: React.ReactNode }) => (
  <div>
    <label htmlFor={`cand-${name}`} className={labelClass}>
      {label} {required && <span className="text-accent">*</span>}
    </label>
    {children}
  </div>
);

export default function ApplicationForm({ defaultPosition = '' }: { defaultPosition?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [fileName, setFileName] = useState('');

  const buildFallbackMessage = (fd: FormData) =>
    `Bonjour NexClean, je souhaite postuler.\n\nNom : ${fd.get('firstName')} ${fd.get('lastName')}\nPoste : ${fd.get('position')}\nVille / quartier : ${fd.get('city')} / ${fd.get('district')}\nTéléphone : ${fd.get('phone')}\nExpérience : ${fd.get('experience')}\nDisponibilité : ${fd.get('availability')}\n\nJe vous envoie mon CV dans cette conversation.`;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return setFileName('');
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['pdf', 'docx'].includes(ext || '')) {
      e.target.value = '';
      setFileName('');
      setStatus({ kind: 'error', message: 'Format non accepté : merci de joindre un fichier PDF ou DOCX.' });
      return;
    }
    if (file.size > CV_MAX_SIZE_MB * 1024 * 1024) {
      e.target.value = '';
      setFileName('');
      setStatus({ kind: 'error', message: `Le fichier dépasse ${CV_MAX_SIZE_MB} Mo.` });
      return;
    }
    setStatus({ kind: 'idle' });
    setFileName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus({ kind: 'sending' });

    try {
      const res = await fetch('/api/candidature', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        trackEvent('job_application_submit', { position: String(fd.get('position')), source: String(fd.get('source') || '') });
        setStatus({ kind: 'success', reference: json.reference });
        formRef.current?.reset();
        setFileName('');
        return;
      }
      if (res.status === 503 || res.status === 502) {
        setStatus({ kind: 'fallback', message: buildFallbackMessage(fd) });
        return;
      }
      setStatus({ kind: 'error', message: json.error || 'Une erreur est survenue. Merci de réessayer.' });
    } catch {
      setStatus({ kind: 'fallback', message: buildFallbackMessage(fd) });
    }
  };

  if (status.kind === 'success') {
    return (
      <div className="flex flex-col items-center text-center py-12" role="status">
        <CheckCircle className="w-12 h-12 text-success mb-3" strokeWidth={1.5} />
        <p className="font-semibold text-slate-900 mb-1">Candidature envoyée !</p>
        <p className="text-sm text-slate-500 max-w-sm">
          Merci. Votre référence : <strong>{status.reference}</strong>. Si vous avez indiqué un e-mail, un accusé de réception vous a été envoyé.
        </p>
      </div>
    );
  }

  if (status.kind === 'fallback') {
    return (
      <div className="text-center py-8" role="status">
        <AlertCircle className="w-10 h-10 text-accent mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-semibold text-slate-900 mb-2">Envoi en ligne momentanément indisponible</p>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          Finalisez votre candidature sur WhatsApp et joignez-y votre CV, ou envoyez-le à{' '}
          <a href={`mailto:${CONTACT.email}`} className="text-primary underline">{CONTACT.email}</a>.
        </p>
        <Button href={getWhatsAppLink(status.message)} variant="whatsapp" size="lg">
          <WhatsAppIcon className="w-5 h-5" />
          Continuer sur WhatsApp
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
      {/* Pot de miel anti-spam (invisible) */}
      <div className="hidden" aria-hidden="true">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Field label="Nom" name="lastName" required>
        <input id="cand-lastName" name="lastName" required maxLength={80} autoComplete="family-name" className={inputClass} />
      </Field>
      <Field label="Prénom" name="firstName" required>
        <input id="cand-firstName" name="firstName" required maxLength={80} autoComplete="given-name" className={inputClass} />
      </Field>
      <Field label="Ville" name="city" required>
        <input id="cand-city" name="city" required maxLength={80} list="cand-cities" defaultValue={ACTIVE_CITIES[0]} className={inputClass} />
        <datalist id="cand-cities">
          {ACTIVE_CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Quartier" name="district" required>
        <input id="cand-district" name="district" required maxLength={80} className={inputClass} />
      </Field>
      <Field label="Téléphone / WhatsApp" name="phone" required>
        <input id="cand-phone" name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="+237 6XX XXX XXX" className={inputClass} />
      </Field>
      <Field label="E-mail" name="email">
        <input id="cand-email" name="email" type="email" maxLength={120} autoComplete="email" placeholder="Pour recevoir l'accusé de réception" className={inputClass} />
      </Field>
      <Field label="Poste recherché" name="position" required>
        <select id="cand-position" name="position" required defaultValue={defaultPosition} className={inputClass}>
          <option value="">Sélectionnez…</option>
          {JOB_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Expérience" name="experience" required>
        <select id="cand-experience" name="experience" required defaultValue="" className={inputClass}>
          <option value="">Sélectionnez…</option>
          {['Aucune / débutant', 'Moins de 1 an', '1 à 3 ans', '3 à 5 ans', 'Plus de 5 ans'].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </Field>
      <Field label="Disponibilité" name="availability" required>
        <select id="cand-availability" name="availability" required defaultValue="" className={inputClass}>
          <option value="">Sélectionnez…</option>
          {['Immédiate', 'Sous 2 semaines', 'Sous 1 mois', 'Plus tard', 'Temps partiel / week-end'].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </Field>
      <Field label="Permis de conduire (si pertinent)" name="license">
        <select id="cand-license" name="license" defaultValue="" className={inputClass}>
          <option value="">Non précisé</option>
          {['Aucun', 'Permis A (moto)', 'Permis B', 'Permis C ou plus'].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Comment nous avez-vous connus ?" name="source">
          <select id="cand-source" name="source" defaultValue="" className={inputClass}>
            <option value="">Non précisé</option>
            {['Site web', 'Facebook', 'Instagram', 'TikTok', 'LinkedIn', 'WhatsApp', 'Bouche-à-oreille', 'Autre'].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Message de motivation" name="message">
          <textarea id="cand-message" name="message" rows={4} maxLength={3000} className={`${inputClass} resize-none`} />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <span className={labelClass}>
          CV (PDF ou DOCX, {CV_MAX_SIZE_MB} Mo max) <span className="text-accent">*</span>
        </span>
        <label
          htmlFor="cand-cv"
          className="flex items-center gap-3 cursor-pointer rounded-lg border-2 border-dashed border-slate-200 hover:border-primary bg-slate-50 px-4 py-4 transition-colors focus-within:ring-2 focus-within:ring-primary/30"
        >
          <Upload className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="text-sm text-slate-600 truncate">{fileName || 'Choisir un fichier…'}</span>
          <input
            id="cand-cv"
            name="cv"
            type="file"
            required
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFile}
            className="sr-only"
          />
        </label>
      </div>

      <label className="sm:col-span-2 flex items-start gap-3 text-sm text-slate-600">
        <input type="checkbox" name="consent" required className="mt-1 w-4 h-4 accent-primary" />
        <span>
          J&apos;accepte que NexClean conserve les données de ma candidature pour l&apos;étudier, conformément à la{' '}
          <Link href="/confidentialite#candidatures" className="text-primary underline">politique de confidentialité</Link>.{' '}
          <span className="text-accent">*</span>
        </span>
      </label>

      {status.kind === 'error' && (
        <p className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
          {status.message}
        </p>
      )}

      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={status.kind === 'sending'}>
          {status.kind === 'sending' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…
            </>
          ) : (
            'Envoyer ma candidature'
          )}
        </Button>
      </div>
    </form>
  );
}
