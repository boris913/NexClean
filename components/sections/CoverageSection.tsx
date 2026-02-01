import React from 'react';
import { MapPin, Check, Clock, Calendar } from 'lucide-react';
import { zones, activeZones, upcomingZones } from '@/content/zones-coverage';

export default function CoverageSection() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full mb-4">
            <MapPin className="w-5 h-5" />
            <span className="font-semibold">Zone de Couverture</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-dark mb-4">
            Où Intervenons-Nous ?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Nous couvrons les principaux quartiers de Douala
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          {/* Active Zones */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-secondary text-white p-2 rounded-lg">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-dark">Zones Actives</h3>
              <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-sm font-semibold">
                Intervention immédiate
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {activeZones.map((zone, index) => (
                <div 
                  key={index}
                  className="bg-gradient-to-br from-secondary/5 to-secondary/10 border-2 border-secondary/20 rounded-xl p-4 text-center hover:border-secondary hover:shadow-lg transition-all duration-300"
                >
                  <MapPin className="w-6 h-6 text-secondary mx-auto mb-2" />
                  <p className="font-semibold text-dark">{zone.name}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Upcoming Zones */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-accent text-white p-2 rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-dark">Bientôt Disponibles</h3>
              <span className="bg-accent/10 text-accent px-3 py-1 rounded-full text-sm font-semibold">
                Prochainement
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {upcomingZones.map((zone, index) => (
                <div 
                  key={index}
                  className="bg-gradient-to-br from-accent/5 to-accent/10 border-2 border-accent/20 rounded-xl p-4 text-center hover:border-accent hover:shadow-lg transition-all duration-300"
                >
                  <Calendar className="w-6 h-6 text-accent mx-auto mb-2" />
                  <p className="font-semibold text-dark">{zone.name}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Info Box */}
          <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-8 text-white text-center">
            <h4 className="text-2xl font-bold mb-3">Votre Quartier N'est Pas Listé ?</h4>
            <p className="text-lg mb-4 text-white/90">
              Contactez-nous ! Nous étudions toutes les demandes pour étendre notre zone de couverture.
            </p>
            <p className="text-sm text-white/80">
              Des frais de déplacement peuvent s'appliquer pour les zones non listées
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
