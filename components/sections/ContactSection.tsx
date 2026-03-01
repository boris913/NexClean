import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import SectionLabel from '@/components/ui/SectionLabel';
import ContactForm from '@/components/forms/ContactForm';
import Button from '@/components/ui/Button';
import { CONTACT, BUSINESS_HOURS, getWhatsAppLink } from '@/lib/constants';

export default function ContactSection() {
  return (
    <section id="contact" className="py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <SectionLabel className="mb-4">Contact</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3">
            Parlons de votre projet
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Contactez-nous pour un devis gratuit et sans engagement.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Left: Info */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Coordonnées</h3>

            {/* WhatsApp (highlighted) */}
            <a
              href={getWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 bg-white border border-[#25D366]/20 rounded-xl p-4 mb-3 hover:border-[#25D366]/40 hover:shadow-sm transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#25D366] flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 mb-0.5">WhatsApp (recommandé)</p>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-[#25D366] transition-colors">
                  {CONTACT.whatsapp}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Réponse sous 1 heure</p>
              </div>
              <span className="text-xs text-slate-400 self-center">→</span>
            </a>

            {/* Phone */}
            <div className="flex items-start gap-4 bg-white border border-slate-100 rounded-xl p-4 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">Téléphone</p>
                <a href={`tel:${CONTACT.phone}`} className="text-sm font-semibold text-slate-900 hover:text-primary transition-colors">
                  {CONTACT.phone}
                </a>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-4 bg-white border border-slate-100 rounded-xl p-4 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">Email</p>
                <a href={`mailto:${CONTACT.email}`} className="text-sm font-semibold text-slate-900 hover:text-primary transition-colors">
                  {CONTACT.email}
                </a>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-4 bg-white border border-slate-100 rounded-xl p-4 mb-6">
              <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">Localisation</p>
                <p className="text-sm font-semibold text-slate-900">{CONTACT.address}</p>
                <p className="text-xs text-slate-400 mt-0.5">Bonapriso · Akwa · Bonanjo · Bali · Makepe et plus</p>
              </div>
            </div>

            {/* Business hours */}
            <div className="bg-slate-900 rounded-xl p-5 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold">Horaires d'intervention</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>{BUSINESS_HOURS.weekdays}</li>
                <li>{BUSINESS_HOURS.saturday}</li>
                <li>{BUSINESS_HOURS.sunday}</li>
                <li className="pt-2 border-t border-slate-700 text-primary-light" style={{ color: '#93C5FD' }}>
                  ⚡ {BUSINESS_HOURS.response}
                </li>
              </ul>
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 lg:p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Demande de devis gratuit</h3>
            <ContactForm />
          </div>
        </div>

        {/* Map placeholder */}
        {/* <div className="mt-10 rounded-2xl overflow-hidden border border-slate-100 h-64 bg-slate-100 flex items-center justify-center">
          <div className="text-center p-6">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              Carte de Douala — zones d'intervention NexClean
            </p>
            <p className="text-xs text-slate-300 mt-1">
              Intégrez Google Maps avec votre clé API dans <code className="font-mono">ContactSection.tsx</code>
            </p>
          </div>
        </div> */}
      </div>
    </section>
  );
}
