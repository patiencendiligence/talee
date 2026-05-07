export const compressImage = (file: File | Blob, quality = 0.6, maxWidth = 800): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // For Blob (like what we get from Gemini), we need to create an object URL or use FileReader
    let url: string;
    if (file instanceof File || file instanceof Blob) {
      url = URL.createObjectURL(file);
    } else {
      return reject("Invalid file type");
    }

    img.src = url;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject("Canvas context not found");
      }

      let width = img.width;
      let height = img.height;

      // Resize
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) return reject("Blob 생성 실패");
          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject("Image loading error");
    };
  });
};

export const uploadImage = async (blob: Blob, _path: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Safety check: Firestore document limit is 1MB. Base64 is ~33% larger than binary.
      // 1,000,000 / 1.33 = ~750,000 bytes raw. 800-900KB is a safe threshold for the string length.
      if (result.length > 950000) {
        console.warn("Base64 string is very large (>950KB) and may fail to save to Firestore.");
      }
      resolve(result);
    };
    reader.onerror = () => reject("Base64 변환 실패");
    reader.readAsDataURL(blob);
  });
};

export const generateImageHash = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};
