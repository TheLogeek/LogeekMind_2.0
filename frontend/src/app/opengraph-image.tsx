import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'LogeekMind - AI Learning Assistant';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      // HTML/CSS that becomes generates preview
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <div style={{ color: 'black', fontWeight: 'bold' }}>LogeekMind</div>
        <div style={{ color: '#666', fontSize: 40, marginTop: 20 }}>
          Your AI-powered learning assistant
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
