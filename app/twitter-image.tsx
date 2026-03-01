import { ImageResponse } from 'next/og';

// Next.js exige que runtime soit déclaré directement dans le fichier,
// pas re-exporté depuis un autre module (limitation du compilateur)
export const runtime = 'edge';
export const alt = 'NexClean — Service de Nettoyage Professionnel à Douala';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #0F172A 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Badge localisation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: '50px',
            padding: '8px 20px',
            marginBottom: '32px',
          }}
        >
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22C55E' }} />
          <span style={{ color: '#93C5FD', fontSize: '18px', fontWeight: 600 }}>
            Douala, Cameroun
          </span>
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
          }}
        >
          NexClean
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            color: '#94A3B8',
            marginBottom: '48px',
            lineHeight: 1.4,
          }}
        >
          Service de nettoyage professionnel à Douala.
        </div>

        {/* Badges de confiance */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {['✓ Intervention sous 24h', '✓ Satisfaction garantie', '✓ Devis gratuit'].map(
            (badge) => (
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
            )
          )}
        </div>

        {/* Contact bas droite */}
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
          <span style={{ color: '#64748B', fontSize: '16px' }}>nexclean.cm</span>
          <span style={{ color: '#60A5FA', fontSize: '18px', fontWeight: 600 }}>
            +237 6 81 71 15 40
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
