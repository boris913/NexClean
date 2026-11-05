import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';
import { BRAND } from '@/lib/constants';

export const OG_ALT = BRAND.ogAlt;
export const OG_SIZE = { width: 1200, height: 630 };

/** Image de partage (Facebook, WhatsApp, LinkedIn, X) aux couleurs de la marque. */
export async function renderOgImage(villes: string) {
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
          background: 'linear-gradient(135deg, #0A1626 0%, #12355B 60%, #1A4FB0 100%)',
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
            background: 'radial-gradient(circle, rgba(46,124,246,0.40) 0%, rgba(46,124,246,0) 70%)',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={545} height={115} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 64, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.08, letterSpacing: -1 }}>
            Propreté, recrutement & espaces verts
          </div>
          <div style={{ fontSize: 30, color: '#DBE7FC', marginTop: 16 }}>{`${BRAND.signature} · ${villes}, Cameroun`}</div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {['Propreté & hygiène', 'Recrutement', 'Espaces verts', 'Suivi en ligne'].map((b, i) => (
            <div
              key={b}
              style={{
                display: 'flex',
                background: i === 0 ? '#84CC45' : 'rgba(255,255,255,0.12)',
                color: i === 0 ? '#0A1626' : '#FFFFFF',
                borderRadius: 8,
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
