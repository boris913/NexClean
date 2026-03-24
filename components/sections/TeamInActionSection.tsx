'use client';

import Image from 'next/image';
import SectionLabel from '@/components/ui/SectionLabel';
import { Star, ShieldCheck, Sparkles, Users } from 'lucide-react';

interface TeamImage {
  src: string;
  alt: string;
  caption?: string;
}

interface TeamInActionSectionProps {
  teamImage?: TeamImage;
  actionImages?: TeamImage[];
}

const defaultTeamImage: TeamImage = {
  src: '/images/team/equipe-nexclean.jfif',
  alt: 'Équipe NexClean au complet',
  caption: 'Toute notre équipe à votre service',
};

const defaultActionImages: TeamImage[] = [
  {
    src: '/images/team/equipe-nexclean1.jpeg',
    alt: 'Nettoyage en profondeur des sols',
    caption: 'Nettoyage minutieux',
  },
  {
    src: '/images/team/equipe-nexclean2.jpeg',
    alt: 'Nettoyage des vitres sans traces',
    caption: 'Vitres impeccables',
  },
  {
    src: '/images/team/equipe-nexclean3.jpeg',
    alt: 'Désinfection des surfaces',
    caption: 'Désinfection certifiée',
  },
  {
    src: '/images/team/equipe-nexclean4.jpeg',
    alt: 'Utilisation de matériel professionnel',
    caption: 'Matériel dernier cri',
  },
  {
    src: '/images/team/equipe-nexclean8.jpeg',
    alt: 'Nettoyage après travaux',
    caption: 'Après travaux parfait',
  },
  {
    src: '/images/team/equipe-nexclean6.jpeg',
    alt: 'Équipe en intervention',
    caption: 'Professionnalisme',
  },
];

export default function TeamInActionSection({
  teamImage = defaultTeamImage,
  actionImages = defaultActionImages,
}: TeamInActionSectionProps) {
  const displayActions = [...actionImages];
  while (displayActions.length < 6) {
    displayActions.push({
      src: '/images/placeholder.jpg',
      alt: 'Action NexClean',
      caption: 'Intervention professionnelle',
    });
  }

  return (
    <section id="team" className="py-24 bg-gradient-to-b from-white to-slate-50 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête avec statistiques intégrées */}
        <div className="text-center mb-16">
          <SectionLabel className="mb-4">Notre équipe en action</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-slate-900 mb-4">
            Des experts à votre service
          </h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Une équipe formée, équipée et passionnée, qui intervient avec rigueur et discrétion.
          </p>

          <div className="flex flex-wrap justify-center gap-6 mt-8">
            <div className="flex items-center gap-2 text-slate-600">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">+15 agents</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Star className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">4.9/5 (100+ avis)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Assurés & certifiés</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Matériel pro</span>
            </div>
          </div>
        </div>

        {/* Grille principale : 2 colonnes de même hauteur */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Colonne gauche : grande image de l'équipe */}
          <div className="relative group h-full">
            <div className="relative overflow-hidden rounded-2xl shadow-xl h-full min-h-[350px]">
              <Image
                src={teamImage.src}
                alt={teamImage.alt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
            {teamImage.caption && (
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg transform transition-all duration-300 group-hover:translate-y-[-4px]">
                <p className="text-sm font-semibold text-slate-900 text-center">
                  {teamImage.caption}
                </p>
              </div>
            )}
            <div className="absolute top-4 left-4 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
              Équipe NexClean
            </div>
          </div>

          {/* Colonne droite : grille des actions */}
          <div className="h-full">
            <div className="grid grid-cols-2 gap-4 auto-rows-fr">
              {displayActions.slice(0, 6).map((img, idx) => (
                <div key={idx} className="relative group overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all duration-300">
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 1024px) 50vw, (max-width: 768px) 33vw, 16vw"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                    <p className="text-white text-xs font-medium text-center w-full bg-slate-900/50 backdrop-blur-sm rounded-lg py-1 px-2">
                      {img.caption || 'Intervention pro'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pied de section */}
        <div className="mt-20 text-center">
          <div className="inline-flex items-center gap-2 bg-primary-light/30 rounded-full px-5 py-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Résultat garanti
            </span>
          </div>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Chaque intervention est réalisée avec des produits certifiés, un matériel professionnel et une équipe formée aux normes d’hygiène les plus strictes. 
            <br />
            <span className="font-medium text-primary">Satisfaction 100% ou nous revenons gratuitement.</span>
          </p>
        </div>
      </div>
    </section>
  );
}