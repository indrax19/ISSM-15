import type { Invoice } from "@/integrations/firebase/invoiceAPI";
import type { Quotation } from "@/integrations/firebase/quotationAPI";
import { downloadQuotationPDF, generateQuotationPDF } from "@/lib/quotationPdfGenerator";

function toQuotation(invoice: Invoice): Quotation {
  return {
    quotationNo: invoice.invoiceNo,
    issueDate: invoice.issueDate,
    validTill: invoice.validTill,
    customerName: invoice.customerName,
    customerAddress: invoice.customerAddress,
    customerPhone: invoice.customerPhone,
    quoteReference: invoice.invoiceReference,
    fbrReference: invoice.fbrReference,
    items: invoice.items,
    note: invoice.note,
    terms: invoice.terms,
    companyProfileId: invoice.companyProfileId,
    companyProfileName: invoice.companyProfileName,
    sectorProjectId: invoice.sectorProjectId,
    sectorProjectName: invoice.sectorProjectName,
  };
}

export async function generateInvoicePDF(invoice: Invoice): Promise<Blob> {
  return generateQuotationPDF(toQuotation(invoice), "Invoice");
}

export async function downloadInvoicePDF(invoice: Invoice): Promise<void> {
  await downloadQuotationPDF(toQuotation(invoice), "Invoice");
}
