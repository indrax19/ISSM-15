export async function downloadSlaVisitPDF(source: HTMLElement, filename: string) {
  const { default: html2pdf } = await import("html2pdf.js");

  await html2pdf().set({
    margin: [7, 7, 12, 7],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      onclone: (clonedDocument: Document) => {
        clonedDocument.querySelectorAll(".sla-no-print").forEach((element) => element.remove());
        const root = clonedDocument.querySelector<HTMLElement>(".sla-export-root");
        if (root) {
          root.style.width = "1122px";
          root.style.maxWidth = "none";
          root.style.margin = "0";
          root.style.padding = "0";
        }
        const printStyles = clonedDocument.createElement("style");
        printStyles.textContent = `
          .sla-print-root{font-family:Arial,sans-serif!important;color:#111827!important}
          .sla-print-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))!important}
          .sla-print-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))!important}
          .sla-section{break-inside:avoid;box-shadow:none!important;border-color:#94a3b8!important}
          .sla-section-title{background:#124c78!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .sla-table{min-width:0!important;font-size:6.5pt!important}
          .sla-table th,.sla-table td{padding:2px 3px!important}
          .sla-input{min-height:15px!important;height:auto!important;border:0!important;border-bottom:1px solid #94a3b8!important;border-radius:0!important;padding:1px 2px!important;font-size:7pt!important;box-shadow:none!important;background:transparent!important;color:#111827!important}
          input[type=checkbox]{width:10px!important;height:10px!important;accent-color:#124c78!important}
          .sla-photo-box{min-height:30mm!important}
          .sla-footer{border-top:2px solid #124c78!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        `;
        clonedDocument.head.appendChild(printStyles);
      },
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    pagebreak: { mode: ["css", "legacy"], avoid: [".sla-section", ".sla-footer"] },
  } as any).from(source).save(filename);
}
