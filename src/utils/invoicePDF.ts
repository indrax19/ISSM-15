import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Invoice } from "@/integrations/firebase/invoiceAPI";
import { format } from "date-fns";
import { companyProfileAPI } from "@/integrations/firebase/firestore";
import { addLogoToPDF } from "@/lib/pdfLogoHelper";
import { downloadHighQualityPDF } from "@/lib/pdfCompression";

const formatCertificateDate = (dateString: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return format(date, "MMM dd, yyyy");
  } catch {
    return dateString;
  }
};
export async function generateInvoicePDF(invoice: Invoice, profileId?: string): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: false, // Disable compression for better quality (80-90%)
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let yPosition = margin;

  // Fetch company profile
  let companyProfile = null;
  try {
    if (profileId) {
      companyProfile = await companyProfileAPI.getById(profileId);
    } else {
      companyProfile = await companyProfileAPI.get();
    }
  } catch (error) {
    console.log("Could not fetch company profile");
  }

  // Header - Company logo (left side) and info (right side) section
  let topLeftY = yPosition;
  let topRightY = yPosition;

  // Add logo on left side
  if (companyProfile?.logo_url) {
    const logoHeight = await addLogoToPDF(doc, companyProfile.logo_url, margin, topLeftY, {
      maxWidth: 50,
      maxHeight: 30,
      maintainAspectRatio: true,
    });
    topLeftY += logoHeight + 2;
  }

  // Add company info at top right - starting from top
  topRightY = yPosition;
  if (companyProfile) {
    const rightMargin = pageWidth - margin - 2; // Add padding for right alignment

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(companyProfile.company_name || "Company Name", rightMargin, topRightY, { align: "right" });
    topRightY += 6;

    doc.setFontSize(8);
    doc.setFont(undefined, "normal");

    if (companyProfile.phone) {
      doc.text(`Phone: ${companyProfile.phone}`, rightMargin, topRightY, { align: "right" });
      topRightY += 4;
    }
    if (companyProfile.email) {
      doc.text(`Email: ${companyProfile.email}`, rightMargin, topRightY, { align: "right" });
      topRightY += 4;
    }
    if (companyProfile.website) {
      doc.text(`Website: ${companyProfile.website}`, rightMargin, topRightY, { align: "right" });
      topRightY += 4;
    }
  }

  // Update yPosition to be below both left and right sections
  yPosition = Math.max(topLeftY, topRightY) + 3;

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // Invoice title (centered)
  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text("INVOICE", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 8;

  // Invoice number and date
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(`Invoice No: ${invoice.invoiceNo}`, margin, yPosition);
  doc.text(
    `Date: ${formatCertificateDate(invoice.date)}`,
    pageWidth - margin,
    yPosition,
    { align: "right" }
  );
  yPosition += 8;

  // Invoice details section
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Invoice Details", margin, yPosition);
  yPosition += 6;

  doc.setFont(undefined, "normal");
  doc.setFontSize(9);

  const details = [
    ["PO Number:", invoice.poNumber || "N/A"],
    ["Invoice To:", invoice.invoiceTo || "N/A"],
    ["PO Status:", invoice.poStatus || "N/A"],
    ["Invoice Type:", invoice.invoiceCategory || "N/A"],
    ["Mill Name:", invoice.millName || "N/A"],
    ["Location:", invoice.location || "N/A"],
    ["Unit:", invoice.unit || "N/A"],
  ];

  const detailsWidth = (pageWidth - 2 * margin) / 2;
  const detailLabelWidth = 34;
  const detailValueWidth = detailsWidth - detailLabelWidth - 6;

  for (let i = 0; i < details.length; i += 2) {
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;
    }

    const [label1, value1] = details[i];
    const [label2, value2] = details[i + 1] || ["", ""];
    const value1Lines = doc.splitTextToSize(String(value1), detailValueWidth);
    const value2Lines = label2 ? doc.splitTextToSize(String(value2), detailValueWidth) : [];
    const rowHeight = Math.max(value1Lines.length, value2Lines.length || 1) * 4 + 2;

    doc.setFont(undefined, "bold");
    doc.text(label1, margin, yPosition);
    doc.setFont(undefined, "normal");
    doc.text(value1Lines, margin + detailLabelWidth, yPosition);

    if (label2) {
      doc.setFont(undefined, "bold");
      doc.text(label2, margin + detailsWidth, yPosition);
      doc.setFont(undefined, "normal");
      doc.text(value2Lines, margin + detailsWidth + detailLabelWidth, yPosition);
    }

    yPosition += rowHeight;
  }

  yPosition += 5;

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // Items section
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Item Details", margin, yPosition);
  yPosition += 8;

  // Items table with SR #
  const itemsData = invoice.equipment.map((item, index) => {
    const itemName = item.name || "N/A";
    const itemDetail = item.details || "";
    const description = itemDetail ? `${itemName} - ${itemDetail}` : itemName;
    const quantity = item.quantity.toString();
    const unitPrice = `${item.unitPrice.toLocaleString()}`;
    const total = `${(item.quantity * item.unitPrice).toLocaleString()}`;

    return [
      (index + 1).toString(),
      description,
      quantity,
      unitPrice,
      total,
    ];
  });

  autoTable(doc, {
    startY: yPosition,
    head: [["SR #", "Description", "Qty", "Unit Price", "Total"]],
    body: itemsData,
    margin: margin,
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 11, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.3 }, // SR #
      1: { cellWidth: (pageWidth - 2 * margin - 75), halign: "left", lineColor: [0, 0, 0], lineWidth: 0.3 }, // Description
      2: { cellWidth: 12, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.3 }, // Qty
      3: { cellWidth: 27, halign: "right", lineColor: [0, 0, 0], lineWidth: 0.3 }, // Unit Price
      4: { cellWidth: 25, halign: "right", lineColor: [0, 0, 0], lineWidth: 0.3 }, // Total
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 5;

  // Summary section
  if (yPosition > pageHeight - 40) {
    doc.addPage();
    yPosition = margin;
  }

  // Draw a line above summary
  doc.setLineWidth(0.5);
  doc.line(pageWidth - margin - 70, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // Calculate totals
  const totalAmount = invoice.equipment.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  const paidAmount = invoice.balancePaid || 0;
  const balance = totalAmount - paidAmount;

  doc.setFont(undefined, "bold");
  doc.setFontSize(10);

  const labelX = pageWidth - margin - 70;
  const valueX = pageWidth - margin - 5;

  doc.text("Total Amount:", labelX, yPosition, { align: "left" });
  doc.text(totalAmount.toLocaleString(), valueX, yPosition, { align: "right" });
  yPosition += 8;

  doc.text("Paid Amount:", labelX, yPosition, { align: "left" });
  doc.text(paidAmount.toLocaleString(), valueX, yPosition, { align: "right" });
  yPosition += 8;

  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Balance:", labelX, yPosition, { align: "left" });
  doc.text(balance.toLocaleString(), valueX, yPosition, { align: "right" });

  // Add footer and page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    const footerY = pageHeight - 20;

    doc.setFontSize(8);
    doc.setFont(undefined, "normal");

    // Footer line
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

    // Left side - Company info
    if (companyProfile) {
      doc.text(`${companyProfile.company_name || "Company"}`, margin, footerY);
    }

    // Center text
    doc.text(
      "This is a system-generated document.",
      pageWidth / 2,
      footerY,
      { align: "center" }
    );

    // Right side - Page number
    doc.text(
      `Page ${pageNum} of ${totalPages}`,
      pageWidth - margin,
      footerY,
      { align: "right" }
    );
  }

  return doc.output("blob");
}

export async function downloadInvoicePDF(invoice: Invoice, profileId?: string) {
  try {
    const blob = await generateInvoicePDF(invoice, profileId);
    const millName = invoice.millName?.replace(/\s+/g, "_") || "Mill";
    const filename = `Invoice_${invoice.invoiceNo}_${millName}.pdf`;
    await downloadHighQualityPDF(blob, filename);
  } catch (error) {
    console.error("Error downloading invoice PDF:", error);
    throw new Error("Failed to download invoice PDF");
  }
}
