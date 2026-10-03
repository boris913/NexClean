import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';
import { CITIES_LABEL } from '@/lib/constants';

export const OG_ALT = `NEXCLEAN SARL — Nettoyage professionnel & entretien à ${CITIES_LABEL}`;
export const OG_SIZE = { width: 1200, height: 630 };

/** Image de partage (Facebook, WhatsApp, LinkedIn, X) aux couleurs de la marque. */
export async function renderOgImage() {
  const logo = await readFile(path.join(process.cwd(), 'public/images/brand/logo-horizontal-blanc.svg'));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          background: 'linear-gradient(135deg, #142A08 0%, #3D701C 55%, #66B32B 100%)',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -120,
            top: -120,
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(163,222,110,0.45) 0%, rgba(163,222,110,0) 70%)',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={449} height={128} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 64, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.05, letterSpacing: -2 }}>
            Nettoyage professionnel & entretien
          </div>
          <div style={{ fontSize: 30, color: '#E2F6CF', marginTop: 16 }}>{`${CITIES_LABEL}, Cameroun · Particuliers & entreprises`}</div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {['Devis gratuit sur WhatsApp', 'Espaces verts', 'Produits NexClean'].map((b) => (
            <div
              key={b}
              style={{
                display: 'flex',
                background: '#84CC45',
                color: '#131A12',
                borderRadius: 999,
                padding: '12px 24px',
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              {b}
            </div>
          ))}
        </div>
      </div>
    ),
    OG_SIZE
  );
}
