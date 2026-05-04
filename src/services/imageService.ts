import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";
import { generatePlaceholderImage } from "../utils/imageGenerator";
export { generatePlaceholderImage };
import { db, auth } from "../lib/firebase";
import { collection, query, where, getDocs, getDoc, setDoc, doc } from "firebase/firestore";
import { hashText } from "../lib/utils";
import { compressImage, uploadImage, generateImageHash } from "../utils/imageUtils";

// Initialize Gemini with GoogleGenAI as per modern SDK guidelines
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

const openai = new OpenAI({
  apiKey: (import.meta as any).env.VITE_OPENAI_API,
  dangerouslyAllowBrowser: true
});

/**
 * Base64 to Blob helper
 */
async function base64ToBlob(base64: string, mimeType: string): Promise<Blob> {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

async function processAndCacheImage(rawBlob: Blob, hash: string, prompt: string, type: string): Promise<string> {
  // 1. Process Image
  const compressedBlob = await compressImage(rawBlob, 0.6, 1024); // Lower quality slightly to ensure it fits in Firestore if storage fails
  
  // 2. Generate path based on content hash (deduplication)
  const imageContentHash = await generateImageHash(compressedBlob);
  const userId = auth.currentUser?.uid || 'anonymous';
  const storagePath = `generated/${imageContentHash}.jpg`;

  let imageUrl: string;
  try {
    // 3. Upload to Firebase Storage
    imageUrl = await uploadImage(compressedBlob, storagePath);
  } catch (error) {
    console.warn("Storage upload failed (possibly CORS). Using base64 fallback.", error);
    // FALLBACK: Use Data URL (base64)
    imageUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressedBlob);
    });
  }

  // 4. Cache the result in Firestore
  try {
    await setDoc(doc(db, "image_cache", hash), {
      hash,
      imageUrl,
      contentHash: imageContentHash,
      prompt,
      userId,
      type,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Failed to cache image:", e);
  }

  return imageUrl;
}

export async function getStoryImage(text: string, stylePrompt: string, context?: string): Promise<{ imageUrl: string, type: 'ai' | 'openai' | 'pollinations' | 'placeholder' }> {
  const hash = await hashText(`${text}_${stylePrompt}_${context || ''}`);
  
  // Tier 0: Check Cache
  try {
    const cachedDoc = await getDoc(doc(db, "image_cache", hash));
    if (cachedDoc.exists()) {
      const data = cachedDoc.data();
      // If it's a real image, return it.
      if (data.type !== 'placeholder') {
        console.log("Cached image found");
        return { imageUrl: data.imageUrl, type: data.type as any };
      }
    }
  } catch (error) {
    console.warn("Cache check failed:", error);
  }

  // Tier 1: Gemini AI (General Image Generation)
  try {
    console.log("Generating image for:", text);
    const systemPrompt = `You are a storybook illustrator. Create a beautiful illustration for: "${text}". Style: ${stylePrompt}. Context: ${context || ''}. NO TEXT in image. High quality, whimsical art.`;
    
    // Using exact SDK format from skill
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: systemPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });
    
    let rawBlob: Blob | null = null;
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          rawBlob = await base64ToBlob(part.inlineData.data, part.inlineData.mimeType || 'image/png');
          break;
        }
      }
    }

    if (rawBlob) {
      const imageUrl = await processAndCacheImage(rawBlob, hash, text, 'ai');
      return { imageUrl, type: 'ai' };
    }
  } catch (error: any) {
    console.warn("Gemini stage failed:", error.message || error);
  }

  // Tier 2: OpenAI (DALL-E 3)
  const openaiKey = (import.meta as any).env.VITE_OPENAI_API;
  if (openaiKey) {
    try {
      console.log("Attempting OpenAI fallback...");
      const fullPrompt = `Storybook illustration style: ${stylePrompt}. Scene: ${text}. Context: ${context || ''}. NO TEXT in image. High quality digital painting.`;
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      });
      const base64 = response.data[0].b64_json;
      if (base64) {
        const fallbackBlob = await base64ToBlob(base64, "image/png");
        const imageUrl = await processAndCacheImage(fallbackBlob, hash, text, 'openai');
        return { imageUrl, type: 'openai' };
      }
    } catch (oaError: any) {
      const errorMsg = oaError.message || String(oaError);
      const isQuotaOrBilling = errorMsg.toLowerCase().includes('billing') || 
                              errorMsg.toLowerCase().includes('quota') || 
                              errorMsg.toLowerCase().includes('hard limit') ||
                              errorMsg.includes('429');
      
      if (isQuotaOrBilling) {
        console.warn("OpenAI limit reached (billing/quota). Trying next fallback...");
      } else {
        console.error("OpenAI Fallback failed:", errorMsg);
      }
    }
  }

  // Tier 3: Pollinations AI (High Quality, Free, Stable fallback)
  try {
    console.log("Attempting Pollinations AI fallback...");
    const pollinationsPrompt = encodeURIComponent(`Storybook style: ${stylePrompt}. Scene: ${text}. Context: ${context || ''}. No text, high quality digital art.`);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${pollinationsPrompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}&model=flux`;
    
    // Add a simple timeout to fetch to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    const response = await fetch(pollinationsUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error("Pollinations API returned error");
    
    const blob = await response.blob();
    const imageUrl = await processAndCacheImage(blob, hash, text, 'pollinations');
    return { imageUrl, type: 'pollinations' };
  } catch (pError) {
    console.warn("Pollinations AI stage failed:", pError);
  }

  // Final Fallback: Placeholder
  console.log("Using placeholder as final fallback");
  const imageUrl = generatePlaceholderImage(text);
  
  try {
    await setDoc(doc(db, "image_cache", hash), {
      hash,
      imageUrl,
      prompt: text,
      type: 'placeholder',
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Failed to cache placeholder:", e);
  }

  return { imageUrl, type: 'placeholder' };
}
