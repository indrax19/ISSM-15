import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Quotation } from "@/integrations/firebase/quotationAPI";
import { companyProfileAPI } from "@/integrations/firebase/firestore";
import { downloadHighQualityPDF } from "@/lib/pdfCompression";
import { addLogoToPDF } from "@/lib/pdfLogoHelper";

const money = (amount: number) => amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function amountInWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const underThousand = (value: number): string => {
    const words: string[] = [];
    if (value >= 100) words.push(`${ones[Math.floor(value / 100)]} Hundred`);
    value %= 100;
    if (value >= 20) words.push(tens[Math.floor(value / 10)], ones[value % 10]);
    else if (value > 0) words.push(ones[value]);
    return words.filter(Boolean).join(" ");
  };
  const whole = Math.floor(Math.max(0, amount));
  const groups = [[1_000_000_000, "Billion"], [1_000_000, "Million"], [1_000, "Thousand"], [1, ""]] as const;
  let remainder = whole;
  const words: string[] = [];
  for (const [size, label] of groups) {
    const group = Math.floor(remainder / size);
    if (group) {
      words.push(underThousand(group));
      if (label) words.push(label);
      remainder %= size;
    }
  }
  const paisa = Math.round((Math.max(0, amount) - whole) * 100);
  return `Rupees ${words.join(" ") || "Zero"}${paisa ? ` and ${underThousand(paisa)} Paisa` : ""} Only`;
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}

export async function generateQuotationPDF(quotation: Quotation): Promise<Blob> {
  const pdf = new jsPDF({ format: "a4", unit: "mm", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 11;
  let y = 12;
  const company = quotation.companyProfileId
    ? await companyProfileAPI.getById(quotation.companyProfileId)
    : await companyProfileAPI.get();

  if (company?.logo_url) {
    const logoHeight = await addLogoToPDF(pdf, company.logo_url, margin, y, { maxWidth: 44, maxHeight: 22, maintainAspectRatio: true });
    y += logoHeight + 2;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Quote", pageWidth / 2, y + 1, { align: "center" });
  y += 7;
  pdf.setLineWidth(0.45);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 7;

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("QUOTE TO:", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Issue date   ${formatDate(quotation.issueDate)}`, pageWidth - 84, y);
  y += 6;
  pdf.setFont("helvetica", "bold");
  pdf.text(quotation.customerName || "Customer", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Valid till   ${formatDate(quotation.validTill)}`, pageWidth - 84, y);
  y += 5;
  if (quotation.customerAddress) {
    pdf.text(`Address: ${quotation.customerAddress}`, margin, y, { maxWidth: 106 });
  }
  pdf.text(`Quote Ref:   ${quotation.quoteReference || quotation.quotationNo}`, pageWidth - 84, y);
  y += 5;
  if (quotation.customerPhone) pdf.text(`Phone: ${quotation.customerPhone}`, margin, y);
  pdf.text(`FBR Ref:   ${quotation.fbrReference || "—"}`, pageWidth - 84, y);
  y += 6;

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Description", "Qty", "Unit Price", "Total (PKR)"]],
    body: quotation.items.map((item, index) => [
      String(index + 1),
      item.description,
      String(item.quantity),
      money(item.unitPrice),
      money(item.quantity * item.unitPrice),
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, textColor: [30, 30, 30], lineColor: [185, 185, 185], lineWidth: 0.15 },
    headStyles: { fillColor: [245, 245, 245], textColor: [25, 25, 25], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 9, halign: "center" }, 1: { cellWidth: "auto" }, 2: { cellWidth: 14, halign: "center" }, 3: { cellWidth: 30, halign: "right" }, 4: { cellWidth: 32, halign: "right" } },
  });
  y = (pdf as any).lastAutoTable.finalY + 5;
  const total = quotation.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(`Grand Total (PKR)     ${money(total)}`, pageWidth - margin, y, { align: "right" });
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.text(`Amount in Words: ${amountInWords(total)}`, margin, y, { maxWidth: pageWidth - margin * 2 });
  y += 7;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 14) {
      pdf.addPage();
      y = 14;
    }
  };
  if (quotation.note.trim()) {
    const noteLines = pdf.splitTextToSize(quotation.note, pageWidth - margin * 2 - 8);
    ensureSpace(10 + noteLines.length * 4);
    pdf.setFillColor(255, 249, 218);
    pdf.setDrawColor(170, 150, 90);
    pdf.roundedRect(margin, y, pageWidth - margin * 2, 8 + noteLines.length * 4, 1, 1, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.text("Note:", margin + 4, y + 5);
    pdf.setFont("helvetica", "normal");
    pdf.text(noteLines, margin + 4, y + 9);
    y += 12 + noteLines.length * 4;
  }

  if (quotation.terms.trim()) {
    ensureSpace(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("General Terms & Conditions:", margin, y);
    y += 5;
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    const paragraphs = quotation.terms.split("\n").filter((line) => line.trim());
    for (const paragraph of paragraphs) {
      const lines = pdf.splitTextToSize(paragraph, pageWidth - margin * 2 - 3);
      ensureSpace(lines.length * 3.5 + 2);
      pdf.text(lines, margin + 2, y);
      y += lines.length * 3.5 + 1.5;
    }
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setFontSize(6);
    pdf.setTextColor(90);
    pdf.text(`${company?.company_name || ""}  |  Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }
  return pdf.output("blob");
}

export async function downloadQuotationPDF(quotation: Quotation): Promise<void> {
  const blob = await generateQuotationPDF(quotation);
  await downloadHighQualityPDF(blob, `${quotation.quotationNo || "Quotation"}.pdf`);
}
