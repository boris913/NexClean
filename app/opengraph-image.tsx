import { ImageResponse } from 'next/og';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'edge';
export const alt = 'NexClean — Service de Nettoyage Professionnel à Douala';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Charge l'image du logo depuis le dossier public.
 * En environnement Edge, on utilise fetch sur l'URL publique.
 * Pour le développement local, on peut aussi lire le fichier.
 */
async function getLogoData(): Promise<string> {
  // En production (Edge), l'image est accessible via l'URL du site
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/images/logo.png`);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:image/png;base64,${base64}`;
}

export default async function OGImage() {
  const logoDataUrl = await getLogoData();

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #0F172A 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '60px 80px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Motif de fond subtil */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* En-tête avec logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '40px',
          }}
        >
          {/* Logo redimensionné (hauteur 70px, largeur auto) */}
          <img
            src={logoDataUrl}
            alt="NexClean Logo"
            style={{
              height: '70px',
              width: 'auto',
              objectFit: 'contain',
            }}
          />
          {/* Séparateur visuel */}
          <div
            style={{
              width: '2px',
              height: '50px',
              background: 'rgba(255,255,255,0.2)',
            }}
          />
          {/* Badge de localisation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '50px',
              padding: '8px 20px',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#22C55E',
              }}
            />
            <span style={{ color: '#93C5FD', fontSize: '18px', fontWeight: 600 }}>
              Douala, Cameroun
            </span>
          </div>
        </div>

        {/* Titre principal */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: 800,
            color: '#FFFFFF',
            lineHeight: 1.05,
            marginBottom: '20px',
            letterSpacing: '-2px',
            maxWidth: '800px',
          }}
        >
          Nettoyage professionnel
          <br />
          à Douala
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            color: '#94A3B8',
            marginBottom: '48px',
            maxWidth: '700px',
            lineHeight: 1.4,
          }}
        >
          NexClean — La propreté nouvelle génération.
          <br />
          Maisons, bureaux, désinfection, après travaux.
        </div>

        {/* Badges de confiance */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {[
            '✓ Intervention sous 24h',
            '✓ Satisfaction garantie',
            '✓ Devis gratuit',
          ].map((badge) => (
            <div
              key={badge}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                padding: '12px 20px',
                color: '#E2E8F0',
                fontSize: '18px',
                fontWeight: 500,
              }}
            >
              {badge}
            </div>
          ))}
        </div>

        {/* Contact en bas à droite */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            right: '80px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '4px',
          }}
        >
          <span style={{ color: '#64748B', fontSize: '16px' }}>nexclean.xyz</span>
          <span style={{ color: '#60A5FA', fontSize: '18px', fontWeight: 600 }}>
            +237 6 96 37 04 79
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
