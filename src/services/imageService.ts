import { GoogleGenerativeAI } from "@google/generative-ai";
import { OpenAI } from "openai";
import { generatePlaceholderImage } from "../utils/imageGenerator";
export { generatePlaceholderImage };
import { db, auth } from "../lib/firebase";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { hashText } from "../lib/utils";
import { compressImage, uploadImage, generateImageHash } from "../utils/imageUtils";

// Initialize Gemini with safety for process.env
const geminiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenerativeAI(geminiKey!);

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
  const compressedBlob = await compressImage(rawBlob, 0.7, 1024);
  
  // 2. Generate path based on content hash (deduplication)
  const imageContentHash = await generateImageHash(compressedBlob);
  const userId = auth.currentUser?.uid || 'anonymous';
  const storagePath = `generated/${imageContentHash}.jpg`;

  // 3. Upload to Firebase Storage
  const imageUrl = await uploadImage(compressedBlob, storagePath);

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

export async function getStoryImage(text: string, stylePrompt: string, context?: string): Promise<string> {
  const hash = await hashText(`${text}_${stylePrompt}_${context || ''}`);
  
  // Tier 0: Check Cache
  try {
    const cacheRef = collection(db, "image_cache");
    const q = query(cacheRef, where("hash", "==", hash));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data();
      // If it's a real image, return it. If it's a placeholder, we might want to retry if it was a quota issue.
      if (data.type !== 'placeholder') {
        console.log("Cached image found");
        return data.imageUrl;
      }
    }
  } catch (error) {
    console.warn("Cache check failed:", error);
  }

  // Tier 1: Gemini AI Image Generation (Fallback attempt, though standard Gemini usually returns text)
  try {
    console.log("Generating image for:", text, "with style:", stylePrompt);
    
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const systemPrompt = `You are a storybook illustrator. Create an image for: "${text}". Style: ${stylePrompt}. Context: ${context || ''}. NO TEXT in image.`;
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
    });
    
    const response = await result.response;
    console.log("Gemini response received.");

    let rawBlob: Blob | null = null;
    let mimeType = 'image/png';
    
    if (response.candidates && response.candidates[0]?.content?.parts) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData) {
          mimeType = part.inlineData.mimeType || 'image/png';
          rawBlob = await base64ToBlob(part.inlineData.data, mimeType);
          break;
        }
      }
    }

    if (!rawBlob) {
      throw new Error("Gemini did not return an image part (standard behavior for text-only models). Falling back to OpenAI...");
    }

    return await processAndCacheImage(rawBlob, hash, text, 'ai');

  } catch (error: any) {
    console.warn("Gemini stage ended:", error.message || error);
    
    // Check if it's a quota error
    const isGeminiQuota = error?.message?.includes('429') || error?.message?.includes('quota');
    
    // Use the OpenAI key from Vite env
    const openaiKey = (import.meta as any).env.VITE_OPENAI_API;

    if (openaiKey) {
      console.log("Attempting OpenAI fallback (DALL-E 3)...");
      try {
        const fullPrompt = `Storybook illustration style: ${stylePrompt}. Scene: ${text}. Context: ${context || ''}. NO TEXT in image. High quality, beautiful art.`;
        
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
          console.log("OpenAI image generated successfully.");
          return await processAndCacheImage(fallbackBlob, hash, text, 'openai');
        }
      } catch (oaError: any) {
        console.error("OpenAI Fallback failed:", oaError.message || oaError);
        const isOpenAIQuota = oaError?.message?.includes('429') || oaError?.message?.includes('quota') || oaError?.message?.includes('insufficient_quota');
        
        if (isGeminiQuota || isOpenAIQuota) {
           throw new Error("QUOTA_EXCEEDED");
        }
      }
    } else {
      console.warn("No OpenAI API key found (VITE_OPENAI_API)");
      if (isGeminiQuota) throw new Error("QUOTA_EXCEEDED");
    }

    console.log("Using placeholder as final fallback");
    const imageUrl = generatePlaceholderImage(text);
    
    // Optional: Cache the placeholder for consistency
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

    return imageUrl;
  }
}
