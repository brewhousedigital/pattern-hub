// renderInstructions.ts
// Renders the Markdown instructions to a canvas via offscreen DOM + html2canvas.
// Constraints:
//   - Always 16px body font regardless of overall image scale
//   - Max width 700px
//   - White background (legible against any pattern bg choice)
//
// Returns { canvas, width, height } so the compositor can blit it directly.

import { marked } from 'marked';
import html2canvas from 'html2canvas';

const MAX_WIDTH = 700;

export async function renderInstructions(
  markdown: string,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const html = await marked.parse(markdown);

  // Hidden offscreen container — must be in the document (not detached) so
  // html2canvas can measure layout. Position offscreen to keep invisible.
  const host = document.createElement('div');
  host.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${MAX_WIDTH}px;
    max-width: ${MAX_WIDTH}px;
    padding: 16px;
    background: #ffffff;
    color: #1a1a1a;
    font-family: Roboto, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    box-sizing: border-box;
  `;
  // Scoped styles so headings/lists/code look reasonable in the export.
  host.innerHTML = `
    <style>
      .pf-md h1 { font-size: 22px; margin: 0 0 12px; color: #2e7d32; }
      .pf-md h2 { font-size: 19px; margin: 16px 0 8px; color: #2e7d32; }
      .pf-md h3 { font-size: 17px; margin: 14px 0 6px; }
      .pf-md p  { margin: 0 0 10px; }
      .pf-md ul, .pf-md ol { margin: 0 0 10px 22px; padding: 0; }
      .pf-md li { margin: 0 0 4px; }
      .pf-md code { font-family: ui-monospace, monospace; background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 14px; }
      .pf-md pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow: hidden; }
      .pf-md a { color: #2e7d32; }
      .pf-md strong { font-weight: 700; }
    </style>
    <div class="pf-md">${html}</div>
  `;
  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      scale: 2, // crisp at any composite scale (we draw it 1:1 in output px)
      useCORS: true,
      logging: false,
    });
    // Render at logical (1x) size — divide by scale used.
    return { canvas, width: canvas.width / 2, height: canvas.height / 2 };
  } finally {
    document.body.removeChild(host);
  }
}
