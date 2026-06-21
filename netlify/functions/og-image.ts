import satori from 'satori';
import sharp from 'sharp';

const PRIMARY = '#C8A96E';
const BG = '#141215';
const W = 1200;
const H = 630;

// Cached per Lambda container lifetime
let fontBold: ArrayBuffer | null = null;
let fontRegular: ArrayBuffer | null = null;

async function loadFonts(): Promise<{ bold: ArrayBuffer; regular: ArrayBuffer }> {
  if (!fontBold || !fontRegular) {
    const [boldRes, regularRes] = await Promise.all([
      fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-700-normal.woff'),
      fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-normal.woff'),
    ]);
    if (!boldRes.ok || !regularRes.ok) throw new Error('Failed to load fonts');
    [fontBold, fontRegular] = await Promise.all([boldRes.arrayBuffer(), regularRes.arrayBuffer()]);
  }
  return { bold: fontBold!, regular: fontRegular! };
}

function titleFontSize(len: number): number {
  if (len <= 20) return 80;
  if (len <= 40) return 68;
  if (len <= 60) return 56;
  return 44;
}

function buildElement(
  title: string,
  subtitle: string,
  cta: string,
  fontSize: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const row = (children: unknown[], style: Record<string, unknown> = {}) => ({
    type: 'div',
    props: { style: { display: 'flex', alignItems: 'center', ...style }, children },
  });

  const text = (content: string, style: Record<string, unknown> = {}) => ({
    type: 'div',
    props: { style, children: content },
  });

  return {
    type: 'div',
    props: {
      style: { display: 'flex', width: W, height: H, backgroundColor: BG, fontFamily: 'Inter' },
      children: [
        // Left gold stripe
        {
          type: 'div',
          props: { style: { width: 8, height: H, backgroundColor: PRIMARY, flexShrink: 0 } },
        },
        // Content
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              padding: '56px 72px',
            },
            children: [
              // Brand
              row([
                text('PATTERN ARCHIVE', {
                  fontSize: 20,
                  fontWeight: 700,
                  color: PRIMARY,
                  letterSpacing: '0.1em',
                }),
              ]),
              // Title (centered vertically in remaining space)
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexGrow: 1,
                    alignItems: 'center',
                  },
                  children: [
                    text(title, {
                      fontSize,
                      fontWeight: 700,
                      color: '#ffffff',
                      lineHeight: 1.2,
                      maxWidth: 1000,
                    }),
                  ],
                },
              },
              // Footer
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column' },
                  children: [
                    // Separator line
                    {
                      type: 'div',
                      props: {
                        style: {
                          height: 1,
                          backgroundColor: 'rgba(200,169,110,0.25)',
                          marginBottom: 20,
                        },
                      },
                    },
                    // Subtitle + CTA
                    row(
                      [
                        text(subtitle, { fontSize: 20, fontWeight: 400, color: '#888888' }),
                        text(cta, { fontSize: 22, fontWeight: 700, color: PRIMARY }),
                      ],
                      { justifyContent: 'space-between' },
                    ),
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

export default async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'wiki';
  const title = (searchParams.get('title') ?? 'Pattern Archive').slice(0, 100);
  const category = (searchParams.get('category') ?? '').slice(0, 60);

  const subtitle = type === 'set' ? 'Sets' : category ? `Wiki · ${category}` : 'Wiki';
  const cta = type === 'set' ? 'View more →' : 'Read more →';
  const fontSize = titleFontSize(title.length);

  try {
    const fonts = await loadFonts();
    const svg = await satori(buildElement(title, subtitle, cta, fontSize), {
      width: W,
      height: H,
      fonts: [
        { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: fonts.bold, weight: 700, style: 'normal' },
      ],
    });
    const png = (await sharp(Buffer.from(svg)).png().toBuffer()) as BodyInit;
    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  } catch (err) {
    console.error('[og-image] Generation failed:', err);
    return new Response('Image generation failed', { status: 500 });
  }
};

export const config = { path: '/api/og-image' };
