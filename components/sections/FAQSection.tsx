'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SectionLabel from '@/components/ui/SectionLabel';
import { FAQ, getWhatsAppLink } from '@/lib/constants';

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <SectionLabel className="mb-4">FAQ</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3">
            Questions fréquentes
          </h2>
          <p className="text-slate-500">
            Retrouvez les réponses aux questions les plus courantes.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-1.5">
          {FAQ.map((item, index) => (
            <div
              key={index}
              className="border border-slate-100 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === index ? null : index)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors duration-150 group"
                aria-expanded={open === index}
              >
                <span className={`text-sm font-medium pr-6 transition-colors ${open === index ? 'text-primary' : 'text-slate-800'}`}>
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
                    open === index ? 'rotate-180 text-primary' : ''
                  }`}
                />
              </button>

              {open === index && (
                <div className="px-5 pb-4 bg-slate-50">
                  <p className="text-sm text-slate-600 leading-relaxed">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-slate-500 mt-10">
          Une autre question ?{' '}
          <a
            href={getWhatsAppLink('Bonjour, j\'ai une question')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline"
          >
            Contactez-nous sur WhatsApp →
          </a>
        </p>
      </div>
    </section>
  );
}
