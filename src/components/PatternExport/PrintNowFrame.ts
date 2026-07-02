// PrintNowFrame.ts
// "Print Now" mechanics for the Quick Export wizard's Printing flow: loads a
// PDF Blob into a hidden iframe and triggers the browser's native print
// dialog, so the user never has to manually download-then-open-then-print.
//
// Known limits (surfaced in the wizard's UI, not fixable via any web API):
//   - We cannot force the print dialog's Scale setting to "Actual Size" /
//     100% - that's a browser/OS-level control with no JS hook. The PDF
//     itself IS built at true 1:1 physical size (single-page mode only;
//     see ExportWizard.tsx), so the user just needs to confirm Scale is set
//     to 100%/Actual Size rather than "Fit to page" in the dialog.
//   - Mobile browsers have inconsistent iframe-print support.

export async function printPdfBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  return new Promise<void>((resolve) => {
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      // Delay removal slightly - some browsers tear down the print job if the
      // iframe is removed synchronously inside/right after print().
      setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 1000);
      resolve();
    };

    iframe.onload = () => {
      try {
        // Some browsers only target print() correctly at the focused window.
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn('[PrintNow] print() failed:', e);
      }
      cleanup();
    };

    document.body.appendChild(iframe);
    iframe.src = url;

    // Fallback: if onload never fires (blocked viewer, slow render, etc.)
    // clean up anyway so we don't leak the iframe/object URL forever.
    setTimeout(() => {
      if (!settled) cleanup();
    }, 8000);
  });
}
