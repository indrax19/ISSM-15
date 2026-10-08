import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Challan } from "@/integrations/firebase/challanAPI";
import { Invoice } from "@/integrations/firebase/invoiceAPI";
import { companyProfileAPI, subCategoriesAPI } from "@/integrations/firebase/firestore";
import type { SslSubProject } from "@/integrations/firebase/sslSubProjectsAPI";
import { addLogoToPDF } from "@/lib/pdfLogoHelper";
import { downloadHighQualityPDF } from "@/lib/pdfCompression";

const formatCertificateDate = (dateString: string): string => {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const equipmentPDFOrder = [
  "Compute Unit",
  "GPU Graphic Card",
  "NVR",
  "Surveillance Hard Drive (HDD)",
  "POE Switch",
  "IP Camera",
  "LED TV Screen",
  "UPS - Inverters",
  "Lithium-Ion Battery",
  "RACK",
];

const orderEquipmentForPDF = (equipment: Challan["equipment"]): Challan["equipment"] => {
  const orderMap = new Map(equipmentPDFOrder.map((name, index) => [name.toLowerCase(), index]));

  return equipment
    .map((item, index) => ({
      item,
      index,
      order: orderMap.get(item.name.trim().toLowerCase()) ?? equipmentPDFOrder.length,
    }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ item }) => item);
};

export async function generateChallanPDF(challan: Challan, profileId?: string): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true, // Enable compression for reduced file size
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let yPosition = margin;

  // Fetch company profile
  let companyProfile = null;
  let signatureUrl: string | undefined = undefined;
  try {
    if (profileId) {
      companyProfile = await companyProfileAPI.getById(profileId);
    } else {
      companyProfile = await companyProfileAPI.get();
    }
    // Get signature from company profile
    if (companyProfile?.signature_url) {
      signatureUrl = companyProfile.signature_url;
    }
  } catch (error) {
    console.log("Could not fetch company profile");
  }

  // Header - DELIVERY CHALLAN (top)

  // Company logo (left side) and info (right side) section
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

  // Second DELIVERY CHALLAN header (centered)
  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text("DELIVERY CHALLAN", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 8;

  // Challan number and date
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(`Challan No: ${challan.challanNo}`, margin, yPosition);
  doc.text(
    `Date: ${formatCertificateDate(challan.date)}`,
    pageWidth - margin,
    yPosition,
    { align: "right" }
  );
  yPosition += 8;

  // Challan details section
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Challan Details", margin, yPosition);
  yPosition += 6;

  doc.setFont(undefined, "normal");
  doc.setFontSize(9);

  const details = [
    ["PO Number:", challan.poNumber || "N/A"],
    ["Delivery Date:", formatCertificateDate(challan.deliveryDate)],
    ["Customer/Site Name:", challan.customerName],
    ["Site Location:", challan.siteLocation || "N/A"],
    ["Unit No:", challan.unitNo || "N/A"],
    ["POC Name:", challan.pocName || "N/A"],
    ["POC Number:", challan.pocNumber || "N/A"],
  ];

  const detailsWidth = (pageWidth - 2 * margin) / 2;
  const labelWidth = 40;
  const maxValueWidth = detailsWidth - labelWidth - 3;
  const lineHeight = 5;

  for (let i = 0; i < details.length; i += 2) {
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;
    }

    const [label1, value1] = details[i];
    const [label2, value2] = details[i + 1] || ["", ""];

    doc.setFont(undefined, "bold");
    doc.text(label1, margin, yPosition);
    doc.setFont(undefined, "normal");
    const wrappedValue1 = doc.splitTextToSize(value1, maxValueWidth);
    doc.text(wrappedValue1, margin + labelWidth, yPosition, { align: "left" });

    let wrappedValue2: string[] = [];
    if (label2) {
      doc.setFont(undefined, "bold");
      doc.text(label2, margin + detailsWidth, yPosition);
      doc.setFont(undefined, "normal");
      wrappedValue2 = doc.splitTextToSize(value2, maxValueWidth);
      doc.text(wrappedValue2, margin + detailsWidth + labelWidth, yPosition, { align: "left" });
    }

    const maxLines = Math.max(wrappedValue1.length, wrappedValue2.length);
    yPosition += Math.max(7, maxLines * lineHeight + 1);
  }

  yPosition += 5;

 // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;
  
  // Equipment section
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Equipment List", margin, yPosition);
  yPosition += 8;

  // Equipment table with SR #
  const orderedEquipment = orderEquipmentForPDF(challan.equipment);
  const equipmentData = await Promise.all(
    orderedEquipment.map(async (eq, index) => {
      // Fetch sub-category details if available
      let description = "N/A";
      if (eq.subcategory_id) {
        try {
          const subCat = await subCategoriesAPI.getById(eq.subcategory_id);
          // Format: Sub-category name - Model number
          if (subCat?.name && subCat?.model_no) {
            description = `${subCat.name} - ${subCat.model_no}`;
          } else if (subCat?.model_no) {
            description = subCat.model_no;
          } else if (subCat?.name) {
            description = subCat.name;
          }
        } catch (error) {
          description = "N/A";
        }
      }

      // Format serial numbers
      const serialDisplay = eq.serialNumbers && eq.serialNumbers.length > 0
        ? eq.serialNumbers.join(", ")
        : "N/A";

      return [
        (index + 1).toString(), // SR #
        eq.name, // Equipment Name
        description, // Description (SubCategory Name - Model Number)
        eq.quantity.toString(), // Quantity
        serialDisplay, // Serial Numbers
      ];
    })
  );

  const tableResult = autoTable(doc, {
    startY: yPosition,
    head: [["SR #", "Equipment Name", "Description", "Qty", "Serial Numbers"]],
    body: equipmentData,
    margin: { top: margin, right: margin, bottom: 48, left: margin },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
    },
    bodyStyles: {
      fontSize: 8,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.3 }, // SR #
      1: { cellWidth: 35, lineColor: [0, 0, 0], lineWidth: 0.3 }, // Equipment Name
      2: { cellWidth: Math.max(30, (pageWidth - 2 * margin - 108)), lineColor: [0, 0, 0], lineWidth: 0.3 }, // Description
      3: { cellWidth: 12, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.3 }, // Qty
      4: { cellWidth: 45, lineColor: [0, 0, 0], lineWidth: 0.3 }, // Serial Numbers
    },
  });

  // Add footer to all pages and signatures to the final page
  const totalPages = doc.getNumberOfPages();
  const footerLineY = pageHeight - 18;
  const footerY = pageHeight - 12;
  const signatureLeftX = margin + 8;
  const signatureRightX = pageWidth / 2 + 8;

  doc.setPage(totalPages);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("On Behalf of ISSM", pageWidth / 4, pageHeight - 42, { align: "center" });
  doc.text("On Behalf of Mill", (pageWidth * 3) / 4, pageHeight - 42, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Delivered by  ____________________", signatureLeftX, pageHeight - 35);
  doc.text("Signature  ________________________", signatureLeftX, pageHeight - 27);
  doc.text("Received by  ____________________", signatureRightX, pageHeight - 35);
  doc.text("Signature  ________________________", signatureRightX, pageHeight - 27);

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin, footerLineY, pageWidth - margin, footerLineY);

    if (companyProfile) {
      let footerTextY = footerY;
      doc.text(`${companyProfile.company_name || "Company"}`, margin, footerTextY);
      if (companyProfile.phone) {
        footerTextY += 3;
        doc.text(`Phone: ${companyProfile.phone}`, margin, footerTextY);
      }
    }

    doc.text(
      "This is a system-generated document and does not require a signature.",
      pageWidth / 2,
      footerY,
      { align: "center" }
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
  };

  // Convert to blob
  return doc.output("blob");
}

export async function generateSiteDataPDF(challan: Challan, profileId?: string): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true, // Enable compression for reduced file size
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

  // Header - Company logo (left side) and info (right side)
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

  // Add company info at top right
  topRightY = yPosition;
  if (companyProfile) {
    const rightMargin = pageWidth - margin - 2;

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
  }

  yPosition = Math.max(topLeftY, topRightY) + 3;

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // Title - SITE ENTRY DATA
  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text("SITE ENTRY DATA", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 8;

  // Challan number and date
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(`Challan No: ${challan.challanNo}`, margin, yPosition);
  doc.text(
    `Date: ${formatCertificateDate(challan.date)}`,
    pageWidth - margin,
    yPosition,
    { align: "right" }
  );
  yPosition += 8;

  // Site Information Section
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Site Information", margin, yPosition);
  yPosition += 6;

  doc.setFont(undefined, "normal");
  doc.setFontSize(9);

  const siteInfo = [
    ["Customer/Site Name:", challan.customerName],
    ["Site Location:", challan.siteLocation || "N/A"],
    ["Unit No:", challan.unitNo || "N/A"],
    ["PO Number:", challan.poNumber || "N/A"],
    ["Delivery Date:", formatCertificateDate(challan.deliveryDate)],
  ];

  const valueMaxWidth = pageWidth - 2 * margin - 55;
  const detailLineHeight = 4;

  siteInfo.forEach(([label, value]) => {
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFont(undefined, "bold");
    doc.text(label, margin, yPosition);
    doc.setFont(undefined, "normal");
    const wrappedValue = doc.splitTextToSize(String(value), valueMaxWidth);
    doc.text(wrappedValue, margin + 50, yPosition);
    yPosition += Math.max(6, wrappedValue.length * detailLineHeight + 2);
  });

  yPosition += 5;

  // Point of Contact Section
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Point of Contact", margin, yPosition);
  yPosition += 6;

  doc.setFont(undefined, "normal");
  doc.setFontSize(9);

  const pocInfo = [
    ["POC Name:", challan.pocName || "N/A"],
    ["POC Number:", challan.pocNumber || "N/A"],
    ["Delivered From:", challan.deliveredFrom || "N/A"],
  ];

  pocInfo.forEach(([label, value]) => {
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFont(undefined, "bold");
    doc.text(label, margin, yPosition);
    doc.setFont(undefined, "normal");
    const wrappedValue = doc.splitTextToSize(String(value), valueMaxWidth);
    doc.text(wrappedValue, margin + 50, yPosition);
    yPosition += Math.max(6, wrappedValue.length * detailLineHeight + 2);
  });

  yPosition += 5;

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // Equipment Summary Section
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Equipment Delivered", margin, yPosition);
  yPosition += 8;

  // Equipment table
  const orderedEquipment = orderEquipmentForPDF(challan.equipment);
  const equipmentData = orderedEquipment.map((eq, index) => [
    (index + 1).toString(),
    eq.name,
    eq.quantity.toString(),
    eq.serialNumbers && eq.serialNumbers.length > 0
      ? eq.serialNumbers.join(", ")
      : "N/A",
  ]);

  const tableResult = autoTable(doc, {
    startY: yPosition,
    head: [["SR #", "Equipment Name", "Qty", "Serial Numbers"]],
    body: equipmentData,
    margin: margin,
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
    },
    bodyStyles: {
      fontSize: 8,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // Add footer
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    const footerY = pageHeight - 20;

    doc.setFontSize(8);
    doc.setFont(undefined, "normal");

    // Footer line
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

    // Left side
    if (companyProfile) {
      doc.text(`${companyProfile.company_name || "Company"}`, margin, footerY);
    }

    // Center text
    doc.text(
      "Site Entry Data - System Generated Document",
      pageWidth / 2,
      footerY,
      { align: "center" }
    );

    // Right side
    doc.text(
      `Page ${pageNum} of ${totalPages}`,
      pageWidth - margin,
      footerY,
      { align: "right" }
    );
  }

  return doc.output("blob");
}

export async function downloadSiteDataPDF(challan: Challan, profileId?: string) {
  try {
    const blob = await generateSiteDataPDF(challan, profileId);
    const customerName = challan.customerName?.replace(/\s+/g, "_") || "Customer";
    const filename = `SiteData_${customerName}_${challan.challanNo}.pdf`;
    await downloadHighQualityPDF(blob, filename);
  } catch (error) {
    console.error("Error downloading site data PDF:", error);
    throw new Error("Failed to download site data PDF");
  }
}

export async function downloadChallanPDF(challan: Challan, profileId?: string) {
  try {
    const blob = await generateChallanPDF(challan, profileId);
    // Create filename from customer name and site name
    const customerName = challan.customerName?.replace(/\s+/g, "_") || "Customer";
    const siteName = challan.siteLocation?.replace(/\s+/g, "_") || "Site";
    const filename = `${customerName}.pdf`;
    await downloadHighQualityPDF(blob, filename);
  } catch (error) {
    console.error("Error downloading PDF:", error);
    throw new Error("Failed to download PDF");
  }
}

export async function generateInvoicePDF(invoice: Invoice, profileId?: string): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true, // Enable compression for reduced file size
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


export async function generateDeploymentCertificatePDF(
  companyName: string,
  siteAddress: string,
  millName: string,
  clientName: string,
  clientDesignation: string,
  clientDate: string,
  deploymentDate: string,
  issmName: string,
  issmDesignation: string,
  issmDate: string,
  profileId?: string,
  companyStampUrl?: string,
  companyLogoUrl?: string,
  certificateType: "digital-eye" | "uqaab" | "issm" = "digital-eye"
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true, // Enable compression for reduced file size
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const detailLineHeight = 9;
  const paragraphLineHeight = 7.5;
  let yPosition = margin;

  // ============================
  // Fetch Company Profile
  // =============================
  let companyProfile: any = null;

  try {
    if (profileId) {
      companyProfile = await companyProfileAPI.getById(profileId);
    } else {
      companyProfile = await companyProfileAPI.get();
    }
  } catch (error) {
    console.log("Profile fetch error");
  }

  const formattedClientDate = formatCertificateDate(clientDate);
  const formattedDeploymentDate = formatCertificateDate(deploymentDate || clientDate);
  const formattedIssmDate = formatCertificateDate(issmDate);

  // ============================
  // Header: Logo (Left) + Company Info (Right)
  // ============================
  let leftY = yPosition;
  let rightY = yPosition;

  // Add logo on left side
  if (companyProfile?.logo_url) {
    const logoHeight = await addLogoToPDF(
      doc,
      companyProfile.logo_url,
      margin,
      leftY,
      { maxWidth: 50, maxHeight: 30, maintainAspectRatio: true }
    );
    leftY += logoHeight + 2;
  }

  // Add company info at top right
  rightY = yPosition;
  if (companyProfile) {
    const rightX = pageWidth - margin - 2;

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(companyProfile.company_name || "Company Name", rightX, rightY, { align: "right" });
    rightY += 6;

    doc.setFontSize(8);
    doc.setFont(undefined, "normal");

    if (companyProfile.phone) {
      doc.text(`Phone: ${companyProfile.phone}`, rightX, rightY, { align: "right" });
      rightY += 4;
    }
    if (companyProfile.email) {
      doc.text(`Email: ${companyProfile.email}`, rightX, rightY, { align: "right" });
      rightY += 4;
    }
    if (companyProfile.website) {
      doc.text(`Website: ${companyProfile.website}`, rightX, rightY, { align: "right" });
      rightY += 4;
    }
  }

  // Update yPosition to be below both left and right sections
  yPosition = Math.max(leftY, rightY) + 3;

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // ============================
  // Title: DEPLOYMENT CERTIFICATE (centered)
  // ============================
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  const certTitle = certificateType === "uqaab"
    ? "UQAAB – DEPLOYMENT CERTIFICATE"
    : certificateType === "issm"
    ? "ISSM – DEPLOYMENT CERTIFICATE"
    : certificateType === "obsidian"
    ? "UQAAB – DEPLOYMENT CERTIFICATE"
    : "DIGITAL EYE – DEPLOYMENT CERTIFICATE";
  doc.text(certTitle, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 8;

  // ============================
  // Certificate Details Section
  // ============================
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);

  // Certificate number and date
  doc.text(`Certificate Date: ${formattedClientDate}`, margin, yPosition);
  yPosition += detailLineHeight;

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // Textile Mill Details
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Deployment Details", margin, yPosition);
  yPosition += detailLineHeight;

  doc.setFont(undefined, "normal");
  doc.setFontSize(9);

  const details = [
    ["Mill Name:", millName],
    ["Mill Location:", siteAddress],
    ["Name:", clientName],
    ["Designation:", clientDesignation],
    ["Deployment Date:", formattedDeploymentDate],
  ];

  const detailsWidth = (pageWidth - 2 * margin) / 2;
  const labelWidth = 50;
  const maxValueWidth = detailsWidth - labelWidth - 3;

  for (let i = 0; i < details.length; i += 2) {
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;
    }

    const [label1, value1] = details[i];
    const [label2, value2] = details[i + 1] || ["", ""];

    doc.setFont(undefined, "bold");
    doc.text(label1, margin, yPosition);
    doc.setFont(undefined, "normal");
    const wrappedValue1 = doc.splitTextToSize(value1, maxValueWidth);
    doc.text(wrappedValue1, margin + labelWidth, yPosition, { align: "left" });

    let wrappedValue2: string[] = [];
    if (label2) {
      doc.setFont(undefined, "bold");
      doc.text(label2, margin + detailsWidth, yPosition);
      doc.setFont(undefined, "normal");
      wrappedValue2 = doc.splitTextToSize(value2, maxValueWidth);
      doc.text(wrappedValue2, margin + detailsWidth + labelWidth, yPosition, { align: "left" });
    }

    const maxLines = Math.max(wrappedValue1.length, wrappedValue2.length);
    yPosition += Math.max(detailLineHeight, maxLines * 5 + 2);
  }

  yPosition += paragraphLineHeight;

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // Certification Statement
doc.setFont("helvetica", "normal");
doc.setFontSize(12);

const systemName = certificateType === "uqaab" ? "Uqaab" : certificateType === "obsidian" ? "Uqaab" : "Digital Eye";
const systemFullName = certificateType === "uqaab" ? "Uqaab AI-Based Video Analytics System" : certificateType === "obsidian" ? "Uqaab AI-Based Video Analytics System" : "Digital Eye AI-Based Video Analytics System";

const certText =
  `This is to certify that the ${systemFullName} has been deployed at the undermentioned mill in accordance with the approved deployment scope of the relevant Sales Tax General Order and applicable regulatory requirements. The mentioned system, Electronic Monitoring of Production through Video Analytics, is operational.`;

const boldText = systemFullName;

// Split the full text into lines
const certLines = doc.splitTextToSize(certText, pageWidth - 2 * margin);

certLines.forEach((line: string) => {
  if (yPosition > pageHeight - 40) {
    doc.addPage();
    yPosition = margin;
  }

  if (line.includes(boldText)) {
    const parts = line.split(boldText);

    // Normal text before bold
    doc.setFont("helvetica", "normal");
    doc.text(parts[0], margin, yPosition, { maxWidth: pageWidth - 2 * margin, align: "justify" });

    // Bold text
    const xOffset = margin + doc.getTextWidth(parts[0]);
    doc.setFont("helvetica", "bold");
    doc.text(boldText, xOffset, yPosition);

    // Normal text after bold
    const afterOffset = xOffset + doc.getTextWidth(boldText);
    doc.setFont("helvetica", "normal");
    doc.text(parts[1], afterOffset, yPosition);
  } else {
    doc.setFont("helvetica", "normal");
    doc.text(line, margin, yPosition, { maxWidth: pageWidth - 2 * margin, align: "justify" });
  }

  yPosition += paragraphLineHeight;
});

yPosition += detailLineHeight;

  // ============================
  // Signatures Section (Two Columns)
  // ============================
  if (yPosition > pageHeight - 50) {
    doc.addPage();
    yPosition = margin;
  }

  const colWidth = (pageWidth - 3 * margin) / 2;
  const col1X = margin;
  const col2X = margin + colWidth + margin;

  // Column 1: Client Acknowledgment
  doc.setFont(undefined, "bold");
  doc.setFontSize(12);
  doc.text("Mill - Acknowledgment", col1X, yPosition);
  yPosition += detailLineHeight;

  const col1StartY = yPosition;

  doc.setFont(undefined, "normal");
  doc.setFontSize(12);

  doc.text("Name:", col1X, yPosition);
  doc.text(clientName, col1X + 25, yPosition);
  yPosition += detailLineHeight;

  doc.text("Designation:", col1X, yPosition);
  doc.text(clientDesignation, col1X + 25, yPosition);
  yPosition += detailLineHeight;

  doc.text("Signature: " + "_________________", col1X, yPosition);
  yPosition += detailLineHeight;

  doc.text("Date:", col1X, yPosition);
  doc.text(formattedClientDate, col1X + 25, yPosition);

  // Column 2: Company Stamp Box
  const boxHeight = 40;
  const boxStartY = col1StartY - 3;
  doc.setLineWidth(0.3);
  doc.rect(col2X, boxStartY, colWidth - 5, boxHeight);

  doc.setFontSize(8);
  doc.setFont(undefined, "bold");
  doc.text("[Mill – Company Stamp]", col2X + (colWidth - 5) / 2, boxStartY + 5, { align: "center" });

  yPosition = Math.max(yPosition, boxStartY + boxHeight) + 10;

  // ============================
  // ISSM Labelling Solutions Section
  // ============================
  if (yPosition > pageHeight - 40) {
    doc.addPage();
    yPosition = margin;
  }

  doc.setFont(undefined, "bold");
  doc.setFontSize(12);
  const sectionTitle = certificateType === "uqaab"
    ? "Uqaab"
    : certificateType === "obsidian"
    ? "Obsidian"
    : "ISSM Labelling Solutions";
  doc.text(sectionTitle, margin, yPosition);
  yPosition += detailLineHeight;

  doc.setFont(undefined, "normal");
  doc.setFontSize(12);

  doc.text("Name:", margin, yPosition);
  doc.text(issmName, margin + 25, yPosition);
  yPosition += detailLineHeight;

  doc.text("Designation:", margin, yPosition);
  doc.text(issmDesignation, margin + 25, yPosition);
  yPosition += detailLineHeight;

  doc.text("Signature: " + "_________________", col1X, yPosition);
  yPosition += detailLineHeight;

  doc.text("Date:", margin, yPosition);
  doc.text(formattedIssmDate, margin + 25, yPosition);

  // ============================
  // Footer
  // ============================
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    const footerY = pageHeight - 10;

    doc.setFontSize(8);
    doc.setFont(undefined, "normal");

    // Footer line
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Left side - Company info
    if (companyProfile) {
      doc.text(`${companyProfile.company_name || "Company"}`, margin, footerY);
    }

    // Center text
    doc.text(
      "STGO - Video Analytics System",
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

export async function generateSlaVisitCertificatePDF(
  projectName: string,
  site: SslSubProject,
  profileId?: string
): Promise<Blob> {
  const report = site.maintenanceReport;
  if (!report) throw new Error("SLA visit report is required to generate a certificate");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let yPosition = margin;

  const companyProfile = profileId
    ? await companyProfileAPI.getById(profileId)
    : await companyProfileAPI.get();

  if (companyProfile?.logo_url) {
    const logoHeight = await addLogoToPDF(doc, companyProfile.logo_url, margin, yPosition, {
      maxWidth: 42,
      maxHeight: 24,
      maintainAspectRatio: true,
    });
    yPosition += logoHeight + 3;
  }

  if (companyProfile) {
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text(companyProfile.company_name || "Company", pageWidth - margin, margin + 3, { align: "right" });
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    if (companyProfile.phone) doc.text(`Phone: ${companyProfile.phone}`, pageWidth - margin, margin + 8, { align: "right" });
    if (companyProfile.email) doc.text(`Email: ${companyProfile.email}`, pageWidth - margin, margin + 12, { align: "right" });
  }

  yPosition = Math.max(yPosition, margin + 18) + 4;
  doc.setDrawColor(18, 76, 120);
  doc.setLineWidth(0.7);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 11;

  doc.setFont(undefined, "bold");
  doc.setFontSize(17);
  doc.setTextColor(18, 76, 120);
  doc.text("SLA MAINTENANCE VISIT CERTIFICATE", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 10;

  const visitType = report.visitType === "Other" ? report.otherVisitType || "Other" : report.visitType || "—";
  const visitDate = report.visitDate || report.documentDate;
  const siteLocation = [site.address, site.city, site.district, site.state].filter(Boolean).join(", ") || "—";
  const details = [
    ["SLA Project", projectName || report.projectName || "—"],
    ["Mill / Unit", [site.millName, site.unitNo ? `Unit ${site.unitNo}` : ""].filter(Boolean).join(" · ") || "—"],
    ["Site Location", siteLocation],
    ["SLA Form No.", report.formNumber || "—"],
    ["SLA Year / Visit No.", [report.slaYear, report.visitNumber].filter(Boolean).join(" / ") || "—"],
    ["Visit Type / Date", `${visitType} · ${formatCertificateDate(visitDate) || "—"}`],
    ["FBR Site ID", report.fbrSiteId || "—"],
    ["Visit Outcome", report.overallStatus || "Not recorded"],
  ];

  autoTable(doc, {
    startY: yPosition,
    body: details,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3, lineColor: [219, 228, 237] },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold", textColor: [51, 65, 85], fillColor: [241, 245, 249] },
      1: { textColor: [15, 23, 42] },
    },
    margin: { left: margin, right: margin },
  });
  yPosition = (doc as any).lastAutoTable.finalY + 10;

  const statement = `This certificate confirms that an SLA ${visitType} maintenance visit was recorded for ${site.millName || projectName || "the listed site"} on ${formatCertificateDate(visitDate) || "the date recorded in the SLA report"}. The outcome and visit details shown above are based on the submitted SLA maintenance report.`;
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const statementLines = doc.splitTextToSize(statement, pageWidth - margin * 2);
  statementLines.forEach((line: string) => {
    if (yPosition > pageHeight - 42) {
      doc.addPage();
      yPosition = margin;
    }
    doc.text(line, margin, yPosition);
    yPosition += 5;
  });

  const remarks = [report.engineerRemarks, report.productionObservations].filter((value) => value?.trim());
  if (remarks.length) {
    yPosition += 4;
    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.text("Visit Notes", margin, yPosition);
    yPosition += 6;
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    for (const remark of remarks) {
      const lines = doc.splitTextToSize(remark, pageWidth - margin * 2);
      for (const line of lines) {
        if (yPosition > pageHeight - 42) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += 4.5;
      }
    }
  }

  if (yPosition > pageHeight - 43) {
    doc.addPage();
    yPosition = margin + 4;
  }
  yPosition += 8;
  const signatureWidth = (pageWidth - margin * 2 - 16) / 2;
  const customerName = report.customerSignoff?.name || report.customerPocName || site.pocName || "Customer Representative";
  const engineerName = report.engineerSignoffs?.map((signoff) => signoff.name).filter(Boolean).join(", ") ||
    report.engineerNames?.filter(Boolean).join(", ") || site.supervisorName || "Service Engineer";

  doc.setDrawColor(148, 163, 184);
  doc.line(margin, yPosition + 12, margin + signatureWidth, yPosition + 12);
  doc.line(margin + signatureWidth + 16, yPosition + 12, pageWidth - margin, yPosition + 12);
  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(customerName, margin, yPosition + 17, { maxWidth: signatureWidth });
  doc.text(engineerName, margin + signatureWidth + 16, yPosition + 17, { maxWidth: signatureWidth });
  doc.setFont(undefined, "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Customer Representative", margin, yPosition + 22);
  doc.text("SLA Service Engineer", margin + signatureWidth + 16, yPosition + 22);

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("SLA Maintenance Visit Certificate", margin, pageHeight - 9);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: "right" });
  }

  return doc.output("blob");
}

export async function downloadSlaVisitCertificatePDF(
  projectName: string,
  site: SslSubProject,
  profileId?: string
) {
  try {
    const blob = await generateSlaVisitCertificatePDF(projectName, site, profileId);
    const reportNumber = site.maintenanceReport?.formNumber || site.maintenanceReport?.visitNumber || site.id || "Visit";
    const filenamePart = reportNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    await downloadHighQualityPDF(blob, `SLA_Certificate_${filenamePart}.pdf`);
  } catch (error) {
    console.error("Error downloading SLA visit certificate:", error);
    throw new Error("Failed to download SLA visit certificate");
  }
}

export async function downloadDeploymentCertificatePDF(
  companyName: string,
  siteAddress: string,
  millName: string,
  clientName: string,
  clientDesignation: string,
  clientDate: string,
  deploymentDate: string,
  issmName: string,
  issmDesignation: string,
  issmDate: string,
  companyStampUrl?: string,
  companyLogoUrl?: string,
  profileId?: string,
  certificateType: "digital-eye" | "uqaab" | "issm" = "digital-eye"
) {
  try {
    const blob = await generateDeploymentCertificatePDF(
      companyName,
      siteAddress,
      millName,
      clientName,
      clientDesignation,
      clientDate,
      deploymentDate,
      issmName,
      issmDesignation,
      issmDate,
      profileId,
      companyStampUrl,
      companyLogoUrl,
      certificateType
    );
    const filename = `DeploymentCertificate_${companyName.replace(/\s+/g, "_")}.pdf`;
    await downloadHighQualityPDF(blob, filename);
  } catch (error) {
    console.error("Error downloading deployment certificate PDF:", error);
    throw new Error("Failed to download deployment certificate PDF");
  }
}

export async function printDeploymentCertificate(
  companyName: string,
  siteAddress: string,
  millName: string,
  clientName: string,
  clientDesignation: string,
  clientDate: string,
  deploymentDate: string,
  issmName: string,
  issmDesignation: string,
  issmDate: string,
  companyStampUrl?: string,
  companyLogoUrl?: string,
  profileId?: string,
  certificateType: "digital-eye" | "uqaab" | "issm" = "digital-eye"
) {
  try {
    const blob = await generateDeploymentCertificatePDF(
      companyName,
      siteAddress,
      millName,
      clientName,
      clientDesignation,
      clientDate,
      deploymentDate,
      issmName,
      issmDesignation,
      issmDate,
      profileId,
      companyStampUrl,
      companyLogoUrl,
      certificateType
    );
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url);
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  } catch (error) {
    console.error("Error printing deployment certificate:", error);
    throw new Error("Failed to print deployment certificate");
  }
}

// Project Tracking Site PDF Export
export async function generateProjectSitePDF(site: any, profileId?: string): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true, // Enable compression for reduced file size
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const accentColor = [41, 128, 185]; // Professional blue
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

  // ===== PROFESSIONAL HEADER =====
  let topLeftY: number = margin;
  let topRightY: number = margin;

  // Add logo on left side
  if (companyProfile?.logo_url) {
    const logoHeight = await addLogoToPDF(doc, companyProfile.logo_url, margin, topLeftY, {
      maxWidth: 50,
      maxHeight: 30,
      maintainAspectRatio: true,
    });
    topLeftY += logoHeight;
  }

  // Add company info at top right - black text, no background
  topRightY = margin;
  if (companyProfile) {
    const rightMargin = pageWidth - margin - 2;
    const maxCompanyWidth = 70;

    doc.setTextColor(0, 0, 0); // Black text
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    const companyNameLines = doc.splitTextToSize(companyProfile.company_name || "Company", maxCompanyWidth);
    doc.text(companyNameLines, rightMargin, topRightY, { align: "right" });
    topRightY += companyNameLines.length * 4 + 2;

    doc.setTextColor(0, 0, 0); // Black text
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    if (companyProfile.phone) {
      const phoneLines = doc.splitTextToSize(`Phone: ${companyProfile.phone}`, maxCompanyWidth);
      doc.text(phoneLines, rightMargin, topRightY, { align: "right" });
      topRightY += phoneLines.length * 3 + 1;
    }
    if (companyProfile.email) {
      const emailLines = doc.splitTextToSize(`Email: ${companyProfile.email}`, maxCompanyWidth);
      doc.text(emailLines, rightMargin, topRightY, { align: "right" });
      topRightY += emailLines.length * 3 + 1;
    }
  }

  yPosition = Math.max(topLeftY, topRightY) + 10;

  // ===== DOCUMENT TITLE =====
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.setTextColor(...accentColor);
  doc.text("SITE INFORMATION REPORT", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 10;

  // Reset color
  doc.setTextColor(0, 0, 0);

  // Divider line
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(1);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // ===== SITE IDENTIFICATION BOX =====
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPosition - 2, pageWidth - 2 * margin, 16, "F");

  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...accentColor);
  const millNameLines = doc.splitTextToSize(`Mill Name: ${site.millName || "—"}`, pageWidth - 2 * margin - 10);
  doc.text(millNameLines, margin + 5, yPosition + 4);

  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  doc.setTextColor(100, 100, 100);
  if (site.updated_at) {
    doc.text(
      `Last Updated: ${format(new Date(site.updated_at), "MMM d, yyyy · HH:mm")}`,
      margin + 5,
      yPosition + 10
    );
  }
  doc.setTextColor(0, 0, 0);

  yPosition += 20;

  // ===== SECTION HELPER FUNCTION =====
  const addSection = (title: string, items: [string, string][]) => {
    if (yPosition > pageHeight - 35) {
      doc.addPage();
      yPosition = margin;
    }

    // Section header with background
    doc.setFillColor(230, 240, 250);
    doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, 7, "F");

    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...accentColor);
    doc.text(title, margin + 3, yPosition + 1);
    yPosition += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);

    const labelWidth = 40;
    const valueStartX = margin + labelWidth + 3;
    const maxValueWidth = pageWidth - 2 * margin - labelWidth - 3;
    const lineHeight = 4;

    items.forEach(([label, value], index) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = margin;
      }

      // Split text first to calculate proper row height
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(String(value), maxValueWidth);

      // Calculate row height based on wrapped content
      const rowHeight = Math.max(6, lines.length * lineHeight + 2);

      // Alternating background (expands with wrapped text)
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, rowHeight, "F");
      }

      doc.setFont(undefined, "bold");
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text(label, margin + 3, yPosition + 1);

      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(lines, valueStartX, yPosition + 1);

      yPosition += rowHeight;
    });

    yPosition += 4;
  };

  // ===== LOCATION INFORMATION SECTION =====
  const locationInfo = [
    ["City:", site.city || "—"],
    ["District:", site.district || "—"],
    ["State:", site.state || "—"],
    ["Unit No:", site.unitNo || "—"],
    ["Address:", site.address || "—"],
  ];
  addSection("Location Information", locationInfo);

  // ===== PROJECT DETAILS SECTION =====
  const projectDetails = [
    ["Project Status:", site.projectStatus || "—"],
    ["PO Status:", site.poStatus || "—"],
    ["Team Status:", site.teamStatus || "—"],
    ["Logistics Status:", site.logisticsStatus || "—"],
  ];
  addSection("Project Details", projectDetails);

  // ===== POINT OF CONTACT SECTION =====
  const pocInfo = [
    ["POC Project Name:", site.pocProjectName || site.pocName || "—"],
    ["POC Project Phone:", site.pocProjectPhone || site.pocPhone || "—"],
    ["POC Project Email:", site.pocProjectEmail || "—"],
    ["POC Site Name:", site.pocSiteName || "—"],
    ["POC Site Phone:", site.pocSitePhone || "—"],
    ["POC Site Email:", site.pocSiteEmail || "—"],
    ["POC Technical Name:", site.pocTechnicalName || "—"],
    ["POC Technical Phone:", site.pocTechnicalPhone || "—"],
    ["POC Technical Email:", site.pocTechnicalEmail || "—"],
  ];
  addSection("Point of Contact", pocInfo);

  // ===== TIMELINE SECTION =====
  if (site.startDate || site.endDate || site.poDate || site.projectDurationDays) {
    const timelineInfo = [];
    if (site.startDate) timelineInfo.push(["Start Date:", format(new Date(site.startDate), "MMM d, yyyy")]);
    if (site.endDate) timelineInfo.push(["End Date:", format(new Date(site.endDate), "MMM d, yyyy")]);
    if (site.poDate) timelineInfo.push(["PO Date:", format(new Date(site.poDate), "MMM d, yyyy")]);
    if (site.projectDurationDays) timelineInfo.push(["Duration:", `${site.projectDurationDays} days`]);
    addSection("Timeline & Delivery", timelineInfo);
  }

  // ===== TEAM INFORMATION SECTION =====
  if (site.supervisorName || site.technicianNames?.length) {
    const teamInfo = [];
    if (site.supervisorName) teamInfo.push(["Supervisor:", site.supervisorName]);
    if (site.technicianNames?.length) teamInfo.push(["Technicians:", site.technicianNames.join(", ")]);
    addSection("Team Information", teamInfo);
  }

  // ===== REMARKS SECTION =====
  const remarksHistory = site.remarksHistory?.length
    ? site.remarksHistory
    : site.remarks
      ? [{ text: site.remarks, authorName: "Previous entry", createdAt: site.updated_at }]
      : [];
  if (remarksHistory.length) {
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFillColor(230, 240, 250);
    doc.rect(margin, yPosition - 3, pageWidth - 2 * margin, 7, "F");

    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...accentColor);
    doc.text("Remarks History", margin + 3, yPosition + 1);
    yPosition += 10;

    remarksHistory.forEach((remark: any) => {
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      const remarkLines = doc.splitTextToSize(String(remark.text || "—"), pageWidth - 2 * margin - 6);
      doc.text(remarkLines, margin + 3, yPosition);
      yPosition += remarkLines.length * 4;
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      const metadata = `Added by ${remark.authorName || "Unknown user"}${remark.createdAt ? ` • ${format(new Date(remark.createdAt), "MMM d, yyyy HH:mm")}` : ""}`;
      doc.text(metadata, margin + 3, yPosition);
      yPosition += 6;
    });
  }

  // ===== PROFESSIONAL FOOTER =====
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    // Footer background
    doc.setFillColor(245, 245, 245);
    doc.rect(0, pageHeight - 12, pageWidth, 12, "F");

    // Footer line
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFontSize(7);
    doc.setFont(undefined, "normal");
    doc.setTextColor(100, 100, 100);

    // Left side
    if (companyProfile) {
      doc.text(`© ${new Date().getFullYear()} ${companyProfile.company_name || "Company"}`, margin, pageHeight - 4);
    }

    // Center
    doc.text("CONFIDENTIAL - Site Information Report", pageWidth / 2, pageHeight - 4, { align: "center" });

    // Right side
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 4, { align: "right" });
  }

  return doc.output("blob");
}

export async function downloadProjectSitePDF(site: any, profileId?: string) {
  try {
    const blob = await generateProjectSitePDF(site, profileId);
    const millName = site.millName?.replace(/\s+/g, "_") || "Site";
    const filename = `SiteReport_${millName}_${new Date().toISOString().split('T')[0]}.pdf`;
    await downloadHighQualityPDF(blob, filename);
  } catch (error) {
    console.error("Error downloading site PDF:", error);
    throw new Error("Failed to download site PDF");
  }
}
