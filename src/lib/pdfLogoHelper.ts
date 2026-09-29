import jsPDF from "jspdf";

export interface LogoConfig {
  maxWidth?: number; // Max width in mm (default: 50)
  maxHeight?: number; // Max height in mm (default: 30)
  maintainAspectRatio?: boolean; // default: true
}

/**
 * Adds a company logo to a jsPDF document with proper async handling and automatic sizing
 * @param doc - jsPDF document instance
 * @param logoUrl - URL of the logo image
 * @param xPosition - X position in mm
 * @param yPosition - Y position in mm
 * @param config - Logo configuration (max width, max height, aspect ratio)
 * @returns Promise with the actual height used, so caller can position next element
 */
export async function addLogoToPDF(
  doc: jsPDF,
  logoUrl: string,
  xPosition: number,
  yPosition: number,
  config: LogoConfig = {}
): Promise<number> {
  const { maxWidth = 50, maxHeight = 30, maintainAspectRatio = true } = config;

  try {
    // Fetch the image
    const response = await fetch(logoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch logo: ${response.status}`);
    }

    const blob = await response.blob();

    // Detect image format
    const imageFormat = blob.type.includes("png")
      ? "PNG"
      : blob.type.includes("gif")
        ? "GIF"
        : blob.type.includes("webp")
          ? "WEBP"
          : "JPEG";

    // Compress image before embedding to reduce PDF size
    const compressedBlob = await compressImage(blob, imageFormat);
    const base64Data = await blobToBase64(compressedBlob);

    // Get image dimensions using Image object
    const dimensions = await getImageDimensions(logoUrl);

    // Calculate final dimensions
    let finalWidth = maxWidth;
    let finalHeight = maxHeight;

    if (maintainAspectRatio && dimensions) {
      const aspectRatio = dimensions.width / dimensions.height;

      // Check if image is wider or taller
      if (aspectRatio > maxWidth / maxHeight) {
        // Image is relatively wider
        finalWidth = maxWidth;
        finalHeight = maxWidth / aspectRatio;
      } else {
        // Image is relatively taller
        finalHeight = maxHeight;
        finalWidth = maxHeight * aspectRatio;
      }
    }

    // Ensure dimensions are within bounds
    finalWidth = Math.min(finalWidth, maxWidth);
    finalHeight = Math.min(finalHeight, maxHeight);

    // Add image to PDF using base64
    doc.addImage(
      base64Data,
      imageFormat,
      xPosition,
      yPosition,
      finalWidth,
      finalHeight
    );

    // Return the actual height used so caller can continue positioning
    return finalHeight;
  } catch (error) {
    console.error("Error adding logo to PDF:", error);
    // Return 0 to indicate logo wasn't added, so positioning can continue normally
    return 0;
  }
}

/**
 * Compresses image for PDF embedding to reduce file size
 */
async function compressImage(blob: Blob, format: string): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(blob);
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Scale down to reasonable size for PDF (max 400px for logos)
      const maxDim = 400;
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxDim) {
        height = (height * maxDim) / width;
        width = maxDim;
      } else if (height > maxDim) {
        width = (width * maxDim) / height;
        height = maxDim;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed format
      const quality = format === "PNG" ? 0.85 : 0.75;
      canvas.toBlob(
        (compressedBlob) => {
          resolve(compressedBlob || blob);
        },
        format === "PNG" ? "image/png" : "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      resolve(blob);
    };

    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Converts a blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Gets the dimensions of an image from a URL
 */
function getImageDimensions(
  imageUrl: string
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = imageUrl;
  });
}
