'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { cx } from '@/components/ui/cx';
import { FAQ, getWhatsAppLink } from '@/lib/constants';

interface FAQSectionProps {
  items?: { question: string; answer: string }[];
  eyebrow?: string;
  title?: string;
  intro?: string;
}

export default function FAQSection({
  items = FAQ,
  eyebrow = 'FAQ',
  title = 'Questions fréquentes',
  intro = 'Retrouvez les réponses aux questions les plus courantes.',
}: FAQSectionProps) {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();

  return (
    <Section id="faq" container="narrow" labelledBy={`${id}-titre`} className="scroll-mt-20">
      <SectionHeader id={`${id}-titre`} align="center" eyebrow={eyebrow} title={title} intro={intro} />

      <div className="space-y-2">
        {items.map((item, index) => {
          const ouvert = open === index;
          const idReponse = `${id}-reponse-${index}`;
          return (
            <div key={item.question} className="overflow-hidden rounded-2xl border border-ink-100">
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(ouvert ? null : index)}
                  aria-expanded={ouvert}
                  aria-controls={idReponse}
                  className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-3 text-left font-sans transition-colors hover:bg-ink-50"
                >
                  <span className={cx('text-sm font-medium', ouvert ? 'text-primary' : 'text-ink-900')}>{item.question}</span>
                  <ChevronDown
                    className={cx('h-4 w-4 flex-shrink-0 transition-transform duration-200', ouvert ? 'rotate-180 text-primary' : 'text-ink-400')}
                    aria-hidden="true"
                  />
                </button>
              </h3>
              <div id={idReponse} hidden={!ouvert} className="bg-ink-50 px-5 pb-4 pt-1">
                <p className="text-small text-ink-600">{item.answer}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-small text-ink-600">
        Une autre question ?{' '}
        <a
          href={getWhatsAppLink("Bonjour, j'ai une question")}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          Contactez-nous sur WhatsApp →
        </a>
      </p>
    </Section>
  );
}
