'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { FaWhatsapp } from "react-icons/fa";
import { getWhatsAppLink } from '@/lib/constants';

export default function WhatsAppButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  
  useEffect(() => {
    // Show button after a short delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);
    
    // Hide tooltip after 5 seconds
    const tooltipTimer = setTimeout(() => {
      setShowTooltip(false);
    }, 5000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(tooltipTimer);
    };
  }, []);
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right">
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-4 bg-white rounded-lg shadow-xl p-4 w-64 animate-fade-in">
          <button
            onClick={() => setShowTooltip(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="font-bold text-dark mb-1">Besoin d'aide ?</p>
          <p className="text-sm text-gray-600">
            Discutez avec nous sur WhatsApp pour un devis gratuit !
          </p>
        </div>
      )}
      
      {/* WhatsApp Button */}
      <a
        href={getWhatsAppLink()}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-16 h-16 bg-[#25D366] text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 animate-pulse-slow"
        aria-label="Contact WhatsApp"
      >
        <FaWhatsapp className="w-8 h-8" />
      </a>
      
      {/* Ping Animation */}
      <div className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20"></div>
    </div>
  );
}
