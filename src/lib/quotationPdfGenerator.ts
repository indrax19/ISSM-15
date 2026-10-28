import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyPaymentDetails } from "@/integrations/firebase/invoiceAPI";
import type { Quotation } from "@/integrations/firebase/quotationAPI";
import { companyProfileAPI } from "@/integrations/firebase/firestore";
import { downloadHighQualityPDF } from "@/lib/pdfCompression";
import { addLogoToPDF } from "@/lib/pdfLogoHelper";
import { DEFAULT_QUOTATION_NOTE } from "@/lib/quotationDefaults";

const money = (amount: number) => amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const itemAmount = (item: Quotation["items"][number]) => Number.isFinite(item.quantity) && Number.isFinite(item.unitPrice) ? item.quantity * item.unitPrice : 0;
const itemTaxRate = (item: Quotation["items"][number]) => Number.isFinite(item.taxPercent) ? item.taxPercent || 0 : 0;
const sectionLabel = (itemType: "Hardware" | "Software") => itemType === "Software" ? "Services" : itemType;
const itemTaxValue = (amount: number, taxPercent: number) => Math.round((amount * taxPercent / 100 + Number.EPSILON) * 100) / 100;

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

type QuotationTermBlock = { text: string; type: "heading" | "paragraph" | "list" | "numbered" | "blank" };

function quotationTermsToBlocks(value: string): QuotationTermBlock[] {
  if (!/<[a-z][^>]*>/i.test(value)) {
    return value.replace(/\r\n/g, "\n").split("\n").map((line) => {
      const text = line.trim();
      if (!text) return { text: "", type: "blank" };
      if (text.endsWith(":") && !text.startsWith("- ")) return { text, type: "heading" };
      if (text.startsWith("- ")) return { text: text.slice(2), type: "list" };
      return { text, type: "paragraph" };
    });
  }

  const parsed = new DOMParser().parseFromString(value, "text/html");
  parsed.querySelectorAll("script, style").forEach((element) => element.remove());
  const blocks: QuotationTermBlock[] = [];
  const nodeText = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const element = node as Element;
    if (element.tagName === "BR") return "\n";
    return Array.from(element.childNodes).map(nodeText).join("");
  };
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) blocks.push({ text, type: "paragraph" });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName;
    if (/^H[1-6]$/.test(tag)) {
      blocks.push({ text: nodeText(element).trim(), type: "heading" });
      return;
    }
    if (tag === "UL" || tag === "OL") {
      Array.from(element.children).filter((child) => child.tagName === "LI").forEach((item, index) => {
        const text = nodeText(item).trim();
        if (text) blocks.push({ text: tag === "OL" ? `${index + 1}. ${text}` : text, type: tag === "OL" ? "numbered" : "list" });
      });
      return;
    }
    if (tag === "P") {
      nodeText(element).split("\n").forEach((line) => {
        const text = line.trim();
        blocks.push({ text, type: text ? "paragraph" : "blank" });
      });
      return;
    }
    if (tag === "BR") {
      blocks.push({ text: "", type: "blank" });
      return;
    }
    Array.from(element.childNodes).forEach(visit);
  };
  Array.from(parsed.body.childNodes).forEach(visit);
  return blocks;
}

export async function generateQuotationPDF(quotation: Quotation, documentType: "Quote" | "Invoice" = "Quote", paymentDetails?: CompanyPaymentDetails): Promise<Blob> {
  const pdf = new jsPDF({ format: "a4", unit: "mm", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 11;
  let y = 12;
  const pageBodyTop = 51;
  const company = quotation.companyProfileId
    ? await companyProfileAPI.getById(quotation.companyProfileId)
    : await companyProfileAPI.get();

  const drawCompanyHeader = async () => {
    pdf.setTextColor(0);
    let logoHeight = 0;
    if (company?.logo_url) {
      logoHeight = await addLogoToPDF(pdf, company.logo_url, margin, 12, { maxWidth: 44, maxHeight: 28, maintainAspectRatio: true });
    }
    let companyInfoY = margin + 3;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(company?.company_name || "", pageWidth - margin, companyInfoY, { align: "right" });
    companyInfoY += 5;
    pdf.setFontSize(8);
    const companyDetail = (label: string, value?: string) => {
      if (!value) return;
      pdf.setFont("helvetica", "bold");
      pdf.text(`${label}:`, pageWidth - margin - pdf.getTextWidth(`${label}: ${value}`), companyInfoY);
      pdf.setFont("helvetica", "normal");
      pdf.text(value, pageWidth - margin - pdf.getTextWidth(value), companyInfoY);
      companyInfoY += 4;
    };
    companyDetail("Phone", company?.phone);
    companyDetail("Email", company?.email);
    companyDetail("Website", company?.website);
    const lineY = Math.max(12 + logoHeight, companyInfoY) + 4;
    pdf.setLineWidth(0.45);
    pdf.line(margin, lineY, pageWidth - margin, lineY);
    return lineY + 7;
  };

  y = await drawCompanyHeader();
  const drawRightField = (label: string, value: string, right: number, baseline: number) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const valueWidth = pdf.getTextWidth(value);
    pdf.setFont("helvetica", "bold");
    const labelText = `${label}:`;
    const labelWidth = pdf.getTextWidth(labelText);
    const left = right - labelWidth - valueWidth - 1;
    pdf.text(labelText, left, baseline);
    pdf.setFont("helvetica", "normal");
    pdf.text(value, left + labelWidth + 1, baseline);
  };
  const drawLeftField = (label: string, value: string, left: number, baseline: number, maxWidth: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    const labelText = `${label}:`;
    pdf.text(labelText, left, baseline);
    const valueLeft = left + pdf.getTextWidth(`${labelText} `);
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(value, maxWidth - valueLeft + left);
    pdf.text(lines, valueLeft, baseline);
    return lines.length;
  };
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(documentType, pageWidth / 2, y, { align: "center" });
  y += 8;

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text(`${documentType.toUpperCase()} TO:`, margin, y);
  drawRightField("Issue date", formatDate(quotation.issueDate), pageWidth - margin, y);
  y += 6;
  pdf.setFont("helvetica", "bold");
  pdf.text(quotation.customerName || "Customer", margin, y);
  drawRightField("Valid till", formatDate(quotation.validTill), pageWidth - margin, y);
  y += 5;
  const addressLines = quotation.customerAddress
    ? drawLeftField("Address", quotation.customerAddress, margin, y, pageWidth - margin * 2 - 89)
    : 1;
  drawRightField(`${documentType} Ref`, quotation.quoteReference || quotation.quotationNo, pageWidth - margin, y);
  y += Math.max(5, addressLines * 4);
  if (quotation.customerPhone) drawLeftField("Phone", quotation.customerPhone, margin, y, pageWidth - margin * 2 - 89);
  drawRightField("FBR Ref", quotation.fbrReference || "—", pageWidth - margin, y);
  y += 6;

  const drawItemsTable = (items: Quotation["items"], startIndex = 0, showTax = true) => {
    const rows = items.map((item, index) => {
      const amount = itemAmount(item);
      const taxValue = itemTaxValue(amount, itemTaxRate(item));
      const cells = [
        String(startIndex + index + 1),
        item.description,
        String(item.quantity),
        money(Number.isFinite(item.unitPrice) ? item.unitPrice : 0),
        money(amount),
        money(taxValue),
        money(amount + taxValue),
      ];
      return showTax ? cells : [cells[0], cells[1], cells[2], cells[3], cells[6]];
    });
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin, top: pageBodyTop },
      head: [showTax ? ["#", "Description", "Qty", "Unit Price", "Amount", "Tax Amount", "Total (PKR)"] : ["#", "Description", "Qty", "Unit Price", "Total (PKR)"]],
      body: rows,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7, cellPadding: 2, textColor: [30, 30, 30], lineColor: [185, 185, 185], lineWidth: 0.15 },
      headStyles: { fillColor: [245, 245, 245], textColor: [25, 25, 25], fontStyle: "bold", halign: "center" },
      columnStyles: showTax ? {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 10, halign: "center" },
        3: { cellWidth: 22, halign: "right" },
        4: { cellWidth: 23, halign: "right" },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 25, halign: "right" },
      } : {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 10, halign: "center" },
        3: { cellWidth: 22, halign: "right" },
        4: { cellWidth: 25, halign: "right" },
      },
    });
    y = (pdf as any).lastAutoTable.finalY + 3;
  };

  const drawAmountInWords = (amount: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    const amountLabel = "Amount in Words:";
    pdf.text(amountLabel, margin, y);
    const amountLabelWidth = pdf.getTextWidth(`${amountLabel} `);
    pdf.setFont("helvetica", "normal");
    const amountWords = pdf.splitTextToSize(amountInWords(amount), pageWidth - margin * 2 - amountLabelWidth);
    pdf.text(amountWords, margin + amountLabelWidth, y);
    y += Math.max(7, amountWords.length * 4);
  };

  let rowOffset = 0;
  for (const itemType of ["Hardware", "Software"] as const) {
    const sectionItems = quotation.items.filter((item) => (item.itemType || "Hardware") === itemType);
    if (!sectionItems.length) continue;
    if (y + 12 > pageHeight - 14) {
      pdf.addPage();
      y = pageBodyTop;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(sectionLabel(itemType), pageWidth / 2, y + 2, { align: "center" });
    y += 4;
    drawItemsTable(sectionItems, rowOffset, sectionItems.some((item) => itemTaxRate(item) > 0));
    rowOffset += sectionItems.length;

    const sectionSubtotal = sectionItems.reduce((sum, item) => sum + itemAmount(item), 0);
    const sectionTaxByRate = new Map<number, number>();
    sectionItems.forEach((item) => {
      const taxPercent = itemTaxRate(item);
      if (taxPercent <= 0) return;
      sectionTaxByRate.set(taxPercent, (sectionTaxByRate.get(taxPercent) || 0) + itemTaxValue(itemAmount(item), taxPercent));
    });
    const sectionTaxes = Array.from(sectionTaxByRate, ([taxPercent, amount]) => ({ taxPercent, amount }))
      .sort((first, second) => first.taxPercent - second.taxPercent);
    const sectionTotal = sectionSubtotal + sectionTaxes.reduce((sum, tax) => sum + tax.amount, 0);
    const label = sectionLabel(itemType);
    const sectionRows = [
      ["Sub-Total (PKR)", money(sectionSubtotal)],
      ...sectionTaxes.map(({ taxPercent, amount }) => [`${label} GST ${taxPercent}% (PKR)`, money(amount)]),
      ["Total (PKR)", money(sectionTotal)],
    ];
    autoTable(pdf, {
      startY: y,
      margin: { left: pageWidth - margin - 80, right: margin, top: pageBodyTop },
      body: sectionRows,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7, cellPadding: 1.5, textColor: [30, 30, 30], lineColor: [185, 185, 185], lineWidth: 0.15 },
      columnStyles: { 0: { cellWidth: 46, halign: "right" }, 1: { cellWidth: 34, halign: "right", fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.row.index === sectionRows.length - 1) data.cell.styles.fontStyle = "bold";
      },
    });
    y = (pdf as any).lastAutoTable.finalY + 6;
    drawAmountInWords(sectionTotal);
    y += 2;
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 14) {
      pdf.addPage();
      y = pageBodyTop;
    }
  };
  const note = documentType === "Quote" ? quotation.note.trim() || DEFAULT_QUOTATION_NOTE : quotation.note.trim();
  if (note) {
    const noteLines = pdf.splitTextToSize(note, pageWidth - margin * 2 - 8);
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

  if (documentType === "Invoice" && paymentDetails) {
    const columnWidth = (pageWidth - margin * 2) / 2;
    const lineHeight = 3.8;
    const headerHeight = 6;
    const companyRows: [string, string][] = [["Company Name", paymentDetails.companyName], ["Address", paymentDetails.address], ["NTN #", paymentDetails.ntn], ["Website", paymentDetails.website]];
    const bankRows: [string, string][] = [["Bank", paymentDetails.bankName], ["Account Title", paymentDetails.accountTitle], ["Account No.", paymentDetails.accountNo], ["IBAN", paymentDetails.iban], ["Branch", paymentDetails.branch]];
    const drawDetailColumn = (rows: [string, string][], x: number, top: number, draw: boolean) => {
      let cursor = top;
      pdf.setFontSize(7);
      for (const [label, value] of rows) {
        if (!value.trim()) continue;
        const labelText = `${label}: `;
        pdf.setFont("helvetica", "bold");
        const labelWidth = pdf.getTextWidth(labelText);
        pdf.setFont("helvetica", "normal");
        const valueLines = pdf.splitTextToSize(value.trim(), columnWidth - 4 - labelWidth);
        if (draw) {
          pdf.setFont("helvetica", "bold");
          pdf.text(labelText, x, cursor);
          pdf.setFont("helvetica", "normal");
          valueLines.forEach((line, index) => pdf.text(line, x + labelWidth, cursor + index * lineHeight));
        }
        cursor += valueLines.length * lineHeight + 1;
      }
      return cursor;
    };
    const bodyHeight = Math.max(
      drawDetailColumn(companyRows, margin + 2, 0, false),
      drawDetailColumn(bankRows, margin + columnWidth + 2, 0, false),
    ) + 5;
    ensureSpace(headerHeight + bodyHeight + 6);
    pdf.setFillColor(245, 245, 245);
    pdf.setDrawColor(185, 185, 185);
    pdf.setLineWidth(0.15);
    pdf.rect(margin, y, pageWidth - margin * 2, headerHeight, "FD");
    pdf.rect(margin, y, pageWidth - margin * 2, headerHeight + bodyHeight, "S");
    pdf.line(margin + columnWidth, y, margin + columnWidth, y + headerHeight + bodyHeight);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(25);
    pdf.text("COMPANY DETAILS", margin + columnWidth / 2, y + 4, { align: "center" });
    pdf.text("BANK / PAYMENT DETAILS", margin + columnWidth * 1.5, y + 4, { align: "center" });
    pdf.setTextColor(30);
    const bodyTop = y + headerHeight + 3.5;
    drawDetailColumn(companyRows, margin + 2, bodyTop, true);
    drawDetailColumn(bankRows, margin + columnWidth + 2, bodyTop, true);
    y += headerHeight + bodyHeight + 6;
  }

  if (documentType === "Quote") {
    ensureSpace(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("General Terms & Conditions:", margin, y);
    y += 5;
    const lineHeight = 3.5;
    const termsBlocks = quotationTermsToBlocks(quotation.terms);
    for (const block of termsBlocks) {
      if (block.type === "blank") {
        ensureSpace(lineHeight);
        y += lineHeight;
        continue;
      }
      pdf.setFontSize(block.type === "heading" ? 7.5 : 7);
      pdf.setFont("helvetica", block.type === "heading" ? "bold" : "normal");
      const isList = block.type === "list" || block.type === "numbered";
      const textX = margin + (isList ? 8 : 2);
      const numberEnd = block.type === "numbered" ? block.text.indexOf(" ") : -1;
      const numberPrefix = numberEnd >= 0 ? block.text.slice(0, numberEnd) : "";
      const bodyText = numberPrefix ? block.text.slice(numberEnd + 1) : block.text;
      const wrappedLines = pdf.splitTextToSize(bodyText, pageWidth - margin - textX - margin);
      for (const [lineIndex, wrappedLine] of wrappedLines.entries()) {
        ensureSpace(lineHeight);
        if (isList && lineIndex === 0) {
          if (block.type === "list") pdf.circle(margin + 4, y - 0.8, 0.55, "F");
          else pdf.text(numberPrefix, margin + 2, y);
        }
        pdf.text(wrappedLine, textX, y);
        y += lineHeight;
      }
      if (block.type === "heading" || block.type === "paragraph") y += 1;
    }
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    if (page > 1) await drawCompanyHeader();
    pdf.setLineWidth(0.25);
    pdf.setDrawColor(120, 120, 120);
    pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    pdf.setFontSize(6);
    pdf.setTextColor(90);
    pdf.text(`${company?.company_name || ""}  |  Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }
  return pdf.output("blob");
}

export async function downloadQuotationPDF(quotation: Quotation, documentType: "Quote" | "Invoice" = "Quote", paymentDetails?: CompanyPaymentDetails): Promise<void> {
  const blob = await generateQuotationPDF(quotation, documentType, paymentDetails);
  const prefix = documentType === "Invoice" ? "Invoice-" : "";
  await downloadHighQualityPDF(blob, `${prefix}${quotation.quotationNo || documentType}.pdf`);
}
