import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import SectionLabel from '@/components/ui/SectionLabel';
import ContactForm from '@/components/forms/ContactForm';
import { CONTACT, BUSINESS_HOURS, TEL_LINK, getWhatsAppLink } from '@/lib/constants';
import { activeZones } from '@/content/zones-coverage';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';

export default function ContactSection() {
  return (
    <section id="contact" className="py-20 sm:py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <SectionLabel className="mb-4">Contact</SectionLabel>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-3">
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
                <WhatsAppIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 mb-0.5">WhatsApp (recommandé)</p>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-[#25D366] transition-colors">
                  {CONTACT.phoneDisplay}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Le plus rapide — joignez vos photos</p>
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
                <a href={TEL_LINK} className="text-sm font-semibold text-slate-900 hover:text-primary transition-colors">
                  {CONTACT.phoneDisplay}
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
                <p className="text-xs text-slate-400 mt-0.5">{activeZones.slice(0, 5).map((z) => z.name).join(' · ')} et plus</p>
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
              </ul>
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 lg:p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Demande de devis gratuit</h3>
            <p className="text-sm text-slate-500 -mt-4 mb-6">Moins d&apos;une minute à remplir.</p>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
