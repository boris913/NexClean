'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { FAQ } from '@/lib/constants';

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  
  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };
  
  return (
    <section className="py-20 bg-light">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <HelpCircle className="w-5 h-5" />
            <span className="font-semibold">Questions Fréquentes</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-dark mb-4">
            Vous Avez Des Questions ?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Retrouvez les réponses aux questions les plus courantes
          </p>
        </div>
        
        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto space-y-4">
          {FAQ.map((faq, index) => (
            <div 
              key={index}
              className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 transition-all duration-300 hover:shadow-xl"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-bold text-lg text-dark pr-8">{faq.question}</span>
                <div className="flex-shrink-0 bg-primary/10 p-2 rounded-full">
                  {openIndex === index ? (
                    <ChevronUp className="w-5 h-5 text-primary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-primary" />
                  )}
                </div>
              </button>
              
              <div 
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-6 pb-5 text-gray-700 leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Additional Help */}
        <div className="text-center mt-12">
          <p className="text-lg text-gray-600 mb-2">
            Vous ne trouvez pas la réponse à votre question ?
          </p>
          <a 
            href={`https://wa.me/237682434962`}
            className="text-primary font-bold hover:underline text-lg"
          >
            Contactez-nous directement sur WhatsApp →
          </a>
        </div>
      </div>
    </section>
  );
}
