'use client';

import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getWhatsAppLink } from '@/lib/constants';

const inputClass =
  'w-full px-3 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-slate-400';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', phone: '', service: '', location: '', date: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const msg = `Bonjour NexClean,

Nom: ${form.name}
Téléphone: ${form.phone}
Service souhaité: ${form.service}
Localisation: ${form.location}
Date souhaitée: ${form.date || 'Non précisée'}
${form.message ? `\nMessage: ${form.message}` : ''}`;

    setTimeout(() => {
      window.open(getWhatsAppLink(msg), '_blank');
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        setForm({ name: '', phone: '', service: '', location: '', date: '', message: '' });
        setSuccess(false);
      }, 4000);
    }, 800);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="w-12 h-12 text-success mb-3" strokeWidth={1.5} />
        <p className="font-semibold text-slate-900 mb-1">Demande envoyée !</p>
        <p className="text-sm text-slate-500">Nous vous répondrons rapidement sur WhatsApp.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name + Phone */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-slate-600 mb-1.5">
            Nom complet <span className="text-accent">*</span>
          </label>
          <input
            id="name" name="name" type="text" required
            value={form.name} onChange={handleChange}
            placeholder="Votre nom"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-xs font-medium text-slate-600 mb-1.5">
            Téléphone <span className="text-accent">*</span>
          </label>
          <input
            id="phone" name="phone" type="tel" required
            value={form.phone} onChange={handleChange}
            placeholder="+237 6XX XXX XXX"
            className={inputClass}
          />
        </div>
      </div>

      {/* Service + Location */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="service" className="block text-xs font-medium text-slate-600 mb-1.5">
            Type de service <span className="text-accent">*</span>
          </label>
          <select
            id="service" name="service" required
            value={form.service} onChange={handleChange}
            className={inputClass}
          >
            <option value="">Sélectionnez…</option>
            <option value="Nettoyage Maison">Nettoyage Maison</option>
            <option value="Nettoyage Bureau">Nettoyage Bureau</option>
            <option value="Nettoyage Vitres">Nettoyage Vitres</option>
            <option value="Désinfection">Désinfection</option>
            <option value="Nettoyage Après Travaux">Nettoyage Après Travaux</option>
            <option value="Abonnement Mensuel">Abonnement Mensuel</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
        <div>
          <label htmlFor="location" className="block text-xs font-medium text-slate-600 mb-1.5">
            Quartier <span className="text-accent">*</span>
          </label>
          <input
            id="location" name="location" type="text" required
            value={form.location} onChange={handleChange}
            placeholder="Bonapriso, Akwa…"
            className={inputClass}
          />
        </div>
      </div>

      {/* Date */}
      <div>
        <label htmlFor="date" className="block text-xs font-medium text-slate-600 mb-1.5">
          Date souhaitée
        </label>
        <input
          id="date" name="date" type="date"
          value={form.date} onChange={handleChange}
          className={inputClass}
        />
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-xs font-medium text-slate-600 mb-1.5">
          Message (optionnel)
        </label>
        <textarea
          id="message" name="message"
          value={form.message} onChange={handleChange}
          rows={3}
          placeholder="Précisions, questions…"
          className={`${inputClass} resize-none`}
        />
      </div>

      <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Envoi en cours…
          </>
        ) : (
          'Envoyer ma demande'
        )}
      </Button>

      <p className="text-center text-xs text-slate-400">
        Vous serez redirigé vers WhatsApp pour finaliser votre demande.
      </p>
    </form>
  );
}
