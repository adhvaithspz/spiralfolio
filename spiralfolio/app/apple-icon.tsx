import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #6366f1 0%, #7c5cf3 55%, #7c3aed 100%)',
          borderRadius: '40px',
          position: 'relative',
        }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '40px',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '40px',
            background:
              'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.10), rgba(255,255,255,0) 60%)',
          }}
        />
        <svg width="180" height="180" viewBox="0 0 64 64" style={{ display: 'flex' }}>
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
    ),
    size,
  );
}
