'use client';

import React, { useState } from 'react';
import { Send, CheckCircle, Loader } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getWhatsAppLink } from '@/lib/constants';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    service: '',
    location: '',
    date: '',
    message: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const message = `Bonjour NexClean,

Nom: ${formData.name}
Téléphone: ${formData.phone}
Service: ${formData.service}
Localisation: ${formData.location}
Date souhaitée: ${formData.date}

Message: ${formData.message}`;
    
    setTimeout(() => {
      window.open(getWhatsAppLink(encodeURIComponent(message)), '_blank');
      setIsSubmitting(false);
      setIsSuccess(true);
      
      setTimeout(() => {
        setFormData({
          name: '',
          phone: '',
          service: '',
          location: '',
          date: '',
          message: '',
        });
        setIsSuccess(false);
      }, 3000);
    }, 1000);
  };
  
  if (isSuccess) {
    return (
      <div className="bg-secondary/10 border-2 border-secondary rounded-2xl p-12 text-center">
        <CheckCircle className="w-20 h-20 text-secondary mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-dark mb-2">Message Envoyé !</h3>
        <p className="text-gray-600">
          Nous vous répondrons dans les plus brefs délais sur WhatsApp.
        </p>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className="block text-sm font-bold text-dark mb-2">
            Nom Complet *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none transition-colors"
            placeholder="Votre nom"
          />
        </div>
        
        <div>
          <label htmlFor="phone" className="block text-sm font-bold text-dark mb-2">
            Téléphone *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none transition-colors"
            placeholder="+237 6XX XXX XXX"
          />
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="service" className="block text-sm font-bold text-dark mb-2">
            Type de Service *
          </label>
          <select
            id="service"
            name="service"
            value={formData.service}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none transition-colors"
          >
            <option value="">Sélectionnez...</option>
            <option value="Nettoyage Maison">Nettoyage Maison</option>
            <option value="Nettoyage Bureau">Nettoyage Bureau</option>
            <option value="Nettoyage Vitres">Nettoyage Vitres</option>
            <option value="Désinfection">Désinfection</option>
            <option value="Nettoyage Après Travaux">Nettoyage Après Travaux</option>
            <option value="Abonnement">Abonnement Mensuel</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="location" className="block text-sm font-bold text-dark mb-2">
            Quartier / Localisation *
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none transition-colors"
            placeholder="Ex: Bonapriso, Akwa..."
          />
        </div>
      </div>
      
      <div>
        <label htmlFor="date" className="block text-sm font-bold text-dark mb-2">
          Date Souhaitée
        </label>
        <input
          type="date"
          id="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none transition-colors"
        />
      </div>
      
      <div>
        <label htmlFor="message" className="block text-sm font-bold text-dark mb-2">
          Message (Optionnel)
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none transition-colors resize-none"
          placeholder="Précisions supplémentaires..."
        ></textarea>
      </div>
      
      <Button 
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        icon={isSubmitting ? Loader : Send}
        disabled={isSubmitting}
        className={isSubmitting ? 'animate-pulse' : ''}
      >
        {isSubmitting ? 'Envoi en cours...' : 'Envoyer ma Demande'}
      </Button>
      
      <p className="text-sm text-gray-500 text-center">
        En soumettant ce formulaire, vous serez redirigé vers WhatsApp
      </p>
    </form>
  );
}