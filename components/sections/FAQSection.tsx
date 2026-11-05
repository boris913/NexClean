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
    <Section id="faq" labelledBy={`${id}-titre`} className="scroll-mt-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <SectionHeader id={`${id}-titre`} eyebrow={eyebrow} title={title} intro={intro} className="!mb-0" />
      </div>
      <div>
      <div className="divide-y divide-ink-200 border-y border-ink-200">
        {items.map((item, index) => {
          const ouvert = open === index;
          const idReponse = `${id}-reponse-${index}`;
          return (
            <div key={item.question}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(ouvert ? null : index)}
                  aria-expanded={ouvert}
                  aria-controls={idReponse}
                  className="flex min-h-14 w-full items-center justify-between gap-4 py-4 text-left font-sans transition-colors hover:text-primary"
                >
                  <span className={cx('text-body font-medium', ouvert ? 'text-primary' : 'text-ink-900')}>{item.question}</span>
                  <ChevronDown
                    className={cx('h-4 w-4 flex-shrink-0 transition-transform duration-200', ouvert ? 'rotate-180 text-primary' : 'text-ink-400')}
                    aria-hidden="true"
                  />
                </button>
              </h3>
              <div id={idReponse} hidden={!ouvert} className="pb-5 pr-8">
                <p className="text-body text-ink-600">{item.answer}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-small text-ink-600">
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
      </div>
      </div>
    </Section>
  );
}
