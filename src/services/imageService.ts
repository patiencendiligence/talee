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

async function translateToEnglish(text: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate this scene description to English for an image generation prompt. Output ONLY the translated text: "${text}"`,
      config: {
        temperature: 0.1,
      }
    });
    return response.text?.trim() || text;
  } catch (e) {
    console.warn("Translation failed, using original text:", e);
    return text;
  }
}

async function processAndCacheImage(rawBlob: Blob, hash: string, prompt: string, type: string): Promise<string> {
  // 1. Process Image
  // Use lower resolution for base64 fallback to ensure it fits in Firestore (1MB limit)
  const isFallback = type === 'placeholder' || type === 'pollinations';
  const quality = isFallback ? 0.5 : 0.6;
  const maxWidth = (type === 'openai' || type === 'ai') ? 1024 : 800;
  
  const compressedBlob = await compressImage(rawBlob, quality, maxWidth);
  
  // 2. Generate path based on content hash (deduplication)
  const imageContentHash = await generateImageHash(compressedBlob);
  const userId = auth.currentUser?.uid || 'anonymous';
  const storagePath = `generated/${imageContentHash}.jpg`;

  let imageUrl: string;
  try {
    // 3. Upload to Firebase Storage
    imageUrl = await uploadImage(compressedBlob, storagePath);
  } catch (error) {
    console.warn("Storage upload failed. Using base64 fallback.", error);
    // FALLBACK: Use Data URL (base64)
    imageUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Check if base64 is way too big (rare after compression but safe)
        if (result.length > 900000) {
           console.warn("Base64 still too large for Firestore, it might fail to cache.");
        }
        resolve(result);
      };
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
    console.warn("Failed to cache image in Firestore (likely too large or permissions):", e);
  }

  return imageUrl;
}

export async function getStoryImage(text: string, stylePrompt: string, context?: string): Promise<{ imageUrl: string, type: 'ai' | 'openai' | 'pollinations' | 'placeholder' }> {
  console.log(`[ImageService] Starting generation for: "${text.substring(0, 30)}..."`);
  const hash = await hashText(`${text}_${stylePrompt}_${context || ''}`);
  
  // Tier 0: Check Cache
  try {
    const cachedDoc = await getDoc(doc(db, "image_cache", hash));
    if (cachedDoc.exists()) {
      const data = cachedDoc.data();
      if (data.type !== 'placeholder') {
        console.log("[ImageService] Cache Hit");
        return { imageUrl: data.imageUrl, type: data.type as any };
      }
    }
  } catch (error) {
    console.warn("[ImageService] Cache check failed:", error);
  }

  // Translate to English to improve all AI models performance
  const englishText = await translateToEnglish(text);
  const englishContext = context ? await translateToEnglish(context) : '';

  // Tier 1: Gemini AI (General Image Generation)
  try {
    console.log("[ImageService] Tier 1: Gemini...");
    const systemPrompt = `You are a professional storybook illustrator. Create a beautiful illustration for this scene: "${englishText}". Style: ${stylePrompt}. Context: ${englishContext}. NO TEXT in image. High quality, whimsical art.`;
    
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
    const errorMsg = error.message || String(error);
    console.warn("[ImageService] Gemini failed:", errorMsg);
    
    // Explicitly log quota issues
    if (errorMsg.includes("quota") || errorMsg.includes("429")) {
       console.log("[ImageService] Gemini Quota Exceeded. Priority fallback to Pollinations enabled.");
    }
  }

  // Tier 2: Pollinations AI (Stable, Free/Keyed)
  try {
    console.log("[ImageService] Tier 2: Pollinations Fallback...");
    const pollinationsKey = "sk_abMRdPPA33IpcQ6uKt4PokI1lWVwPBAl"; // Key provided by user
    const pollinationsPrompt = encodeURIComponent(`Storybook style: ${stylePrompt}. Scene: ${englishText}. Context: ${englishContext}. No text, high quality digital art.`);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${pollinationsPrompt}?width=800&height=800&nologo=true&seed=${Math.floor(Math.random() * 1000000)}&model=flux`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s
    
    const fetchResponse = await fetch(pollinationsUrl, { 
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${pollinationsKey}`
      }
    });
    clearTimeout(timeoutId);
    
    if (fetchResponse.ok) {
      const blob = await fetchResponse.blob();
      const imageUrl = await processAndCacheImage(blob, hash, text, 'pollinations');
      return { imageUrl, type: 'pollinations' };
    } else {
      console.warn(`[ImageService] Pollinations returned ${fetchResponse.status}`);
    }
  } catch (pError) {
    console.warn("[ImageService] Pollinations Fallback failed:", pError);
  }

  // Tier 3: OpenAI (DALL-E 3) - Final AI Resort
  const openaiKey = (import.meta as any).env.VITE_OPENAI_API;
  if (openaiKey) {
    try {
      console.log("[ImageService] Tier 3: OpenAI Final Fallback...");
      const fullPrompt = `Storybook illustration style: ${stylePrompt}. Scene: ${englishText}. Context: ${englishContext}. NO TEXT in image. High quality digital painting.`;
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
      console.warn("[ImageService] OpenAI Final Fallback failed:", oaError.message || oaError);
    }
  }

  // Final Fallback: Placeholder
  console.log("[ImageService] Using placeholder final fallback");
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
    console.warn("[ImageService] Failed to cache placeholder:", e);
  }

  return { imageUrl, type: 'placeholder' };
}
