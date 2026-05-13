import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/brand';

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#0b0b0e',
          backgroundImage:
            'radial-gradient(circle at 18% 22%, rgba(99,102,241,0.32), transparent 55%), radial-gradient(circle at 82% 80%, rgba(124,58,237,0.28), transparent 55%)',
          color: '#f4f4f5',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          position: 'relative',
        }}>
        {/* faint dot grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.18,
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            display: 'flex',
          }}
        />

        {/* header: mark + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                'linear-gradient(135deg, #6366f1 0%, #7c5cf3 55%, #7c3aed 100%)',
              boxShadow:
                '0 0 0 1px rgba(255,255,255,0.06), 0 22px 60px -20px rgba(99,102,241,0.6)',
              position: 'relative',
            }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 22,
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 55%)',
              }}
            />
            <svg width="92" height="92" viewBox="0 0 64 64" style={{ display: 'flex' }}>
              <path
                d="M 49 32 C 49 19 15 19 15 32 C 15 42 39 42 39 32 C 39 26 27 26 27 32"
                fill="none"
                stroke="#ffffff"
                strokeWidth="4.6"
                strokeLinecap="round"
              />
              <circle cx="27" cy="32" r="2.4" fill="#ffffff" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#f4f4f5',
              }}>
              {BRAND.name}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#a1a1aa',
                marginTop: 4,
              }}>
              {BRAND.tagline}
            </div>
          </div>
        </div>

        {/* hero copy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: 78,
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: '-0.025em',
              color: '#f4f4f5',
              maxWidth: 980,
            }}>
            One brain per client.
            <br />
            Every signal, in one place.
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: '#a1a1aa',
              maxWidth: 900,
            }}>
            Calls, concerns, decisions, and momentum — synthesized into an
            always-current client intelligence layer.
          </div>
        </div>

        {/* footer chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 16,
            color: '#71717a',
          }}>
          <span
            style={{
              display: 'flex',
              width: 8,
              height: 8,
              borderRadius: 999,
              background: '#22c55e',
            }}
          />
          Live client intelligence
        </div>
      </div>
    ),
    size,
  );
}
