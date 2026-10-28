import { Invoice } from "@/integrations/firebase/invoiceAPI";
import { Quotation } from "@/integrations/firebase/quotationAPI";
import { downloadHighQualityPDF } from "@/lib/pdfCompression";
import { generateQuotationPDF } from "@/lib/quotationPdfGenerator";

function toQuotation(invoice: Invoice, profileId?: string): Quotation {
  return {
    quotationNo: invoice.invoiceNo,
    issueDate: invoice.date,
    validTill: invoice.validTill || invoice.date,
    customerName: invoice.customerName || invoice.invoiceTo || invoice.millName,
    customerAddress: invoice.customerAddress || invoice.location || "",
    customerPhone: invoice.customerPhone || "",
    quoteReference: invoice.quoteReference || invoice.poNumber || "",
    fbrReference: invoice.fbrReference || "",
    items: invoice.equipment.map((item) => ({
      description: [item.name, item.details].filter(Boolean).join(" — "),
      quantity: item.quantity,
      taxPercent: item.taxPercent ?? 0,
      unitPrice: item.unitPrice,
    })),
    note: invoice.note || "",
    terms: invoice.terms || "",
    companyProfileId: profileId || invoice.companyProfileId,
    companyProfileName: invoice.companyProfileName,
    sectorProjectId: invoice.sectorProjectId,
    sectorProjectName: invoice.sectorProjectName,
  };
}

export async function generateInvoicePDF(invoice: Invoice, profileId?: string): Promise<Blob> {
  return generateQuotationPDF(toQuotation(invoice, profileId), "Invoice");
}

export async function downloadInvoicePDF(invoice: Invoice, profileId?: string): Promise<void> {
  const blob = await generateInvoicePDF(invoice, profileId);
  const filename = (invoice.invoiceNo || "Invoice").replace(/[\\/:*?"<>|]/g, "_");
  await downloadHighQualityPDF(blob, `${filename}.pdf`);
}
