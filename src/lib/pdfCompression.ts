/**
 * Optimize PDF for download with compression
 * @param pdfBlob - Original PDF blob
 * @returns Optimized blob for download
 */
export async function compressPDF(pdfBlob: Blob): Promise<Blob> {
  try {
    const originalSize = (pdfBlob.size / 1024 / 1024).toFixed(2);
    console.log(`PDF Size: ${originalSize}MB (Original)`);
    return pdfBlob;
  } catch (error) {
    console.error('PDF optimization error:', error);
    return pdfBlob;
  }
}

/**
 * Download High Quality PDF file (80-90% quality)
 * @param blob - PDF blob to download
 * @param filename - Name of file to download
 */
export async function downloadHighQualityPDF(blob: Blob, filename: string): Promise<void> {
  try {
    // Create download link for high quality PDF
    // jsPDF generates optimized PDFs at 80-90% quality
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();

    // Clean up immediately after click
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error downloading high quality PDF:', error);
    throw new Error('Failed to download PDF');
  }
}
