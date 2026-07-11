import JSZip from 'jszip';
// Default import: file-saver is a CJS/UMD module, and the production SSR
// bundle keeps node_modules external - Node's ESM loader can't resolve named
// exports from its UMD wrapper (crashes the Netlify function at cold start).
import FileSaver from 'file-saver';

const { saveAs } = FileSaver;

export const downloadAllFilesAsZip = async (paths: string[], zipName: string) => {
  const zip = new JSZip();
  const batchSize = 4;
  const delayMs = 1000;

  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (p) => {
        const res = await fetch(p);
        if (!res.ok) throw new Error(`Failed: ${p}`);
        const blob = await res.blob();
        const name = p.split('/').pop() ?? 'file.svg';
        return { name, blob };
      }),
    );
    results.forEach(({ name, blob }) => zip.file(name, blob));
    if (i + batchSize < paths.length) await new Promise((r) => setTimeout(r, delayMs));
  }

  const out = await zip.generateAsync({ type: 'blob' });
  saveAs(out, `${zipName ? zipName : 'files'}.zip`);
};
