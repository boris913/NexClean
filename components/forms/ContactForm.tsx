'use client';

import WhatsAppForm from '@/components/forms/WhatsAppForm';
import { generalQuoteForm } from '@/components/forms/quote-forms';

export default function ContactForm() {
  return <WhatsAppForm {...generalQuoteForm} />;
}
