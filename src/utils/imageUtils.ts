import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";

export const compressImage = (file: File | Blob, quality = 0.7, maxWidth = 1024): Promise<Blob> => {
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

export const uploadImage = async (blob: Blob, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);

    // Upload
    await uploadBytes(storageRef, blob, {
      contentType: "image/jpeg",
    });

    // Get URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("업로드 실패:", error);
    throw error;
  }
};

export const generateImageHash = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};
