import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";
import { generatePlaceholderImage } from "../utils/imageGenerator";
export { generatePlaceholderImage };
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, query, where, getDocs, getDoc, setDoc, doc } from "firebase/firestore";
import { hashText } from "../lib/utils";
import { compressImage, uploadImage } from "../utils/imageUtils";

// Initialize Gemini with GoogleGenAI as per modern SDK guidelines
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  if (!process.env.GEMINI_API_KEY) {
    console.warn("Gemini API Key not found, skipping translation");
    return text;
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: `Translate this scene description to English for a high-quality image generation prompt. Maintain all specific characters, animals, and objects (e.g., "magpie", "four-leaf clover"). Output ONLY the translated text: "${text}"` }] }],
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
  // Use lower resolution for base64 to ensure it fits in Firestore (1MB limit)
  const isFallback = type === 'placeholder' || type === 'pollinations';
  const quality = isFallback ? 0.5 : 0.6;
  const maxWidth = 800;
  
  const compressedBlob = await compressImage(rawBlob, quality, maxWidth);
  
  // 2. Convert to Base64 (formerly uploadImage)
  const imageUrl = await uploadImage(compressedBlob, "unused_path");

  // 3. Cache the result in Firestore
  try {
    const userId = auth.currentUser?.uid || 'anonymous';
    await setDoc(doc(db, "image_cache", hash), {
      hash,
      imageUrl,
      prompt,
      userId,
      type,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn("Failed to cache image in Firestore (likely too large or permissions):", error);
    handleFirestoreError(error, OperationType.WRITE, `image_cache/${hash}`);
  }

  return imageUrl;
}

import { checkAndIncrementUsage } from './userService';

export async function getStoryImage(text: string, stylePrompt: string, context?: string): Promise<{ imageUrl: string, type: 'ai' | 'openai' | 'pollinations' | 'placeholder' }> {
  console.log(`[ImageService] Starting generation for: "${text.substring(0, 30)}..."`);
  
  const hash = await hashText(`${text}_${stylePrompt}_${context || ''}`);
  
  // Tier 0: Check Cache (Check this BEFORE usage limit to save quota for repeated requests)
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
    handleFirestoreError(error, OperationType.GET, `image_cache/${hash}`);
  }

  // 1. Add a small random stagger to prevent simultaneous requests from hitting the same rate limit
  const stagger = Math.random() * 2000;
  await new Promise(r => setTimeout(r, stagger));

  // Translate to English to improve all AI models performance
  const englishText = await translateToEnglish(text);
  const englishContext = context ? await translateToEnglish(context) : '';

  // Tier 1: Gemini AI (General Image Generation)
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log("[ImageService] Tier 1: Gemini Image Generation...");
      const fullPrompt = `Storybook illustration of: ${englishText}. Style: ${stylePrompt}. Ensure all main subjects are clearly depicted. Context: ${englishContext}. NO TEXT in image. High quality, whimsical art.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts: [{ text: fullPrompt }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      let rawBlob: Blob | null = null;
      const candidates = (response as any).candidates;
      if (candidates?.[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            rawBlob = await base64ToBlob(part.inlineData.data, part.inlineData.mimeType || 'image/png');
            break;
          }
        }
      }

      if (rawBlob) {
        const imageUrl = await processAndCacheImage(rawBlob, hash, text, 'ai');
        return { imageUrl, type: 'ai' };
      } else {
        console.warn("[ImageService] Gemini returned no image data");
      }
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.warn("[ImageService] Gemini failed:", errorMsg);
      
      // Explicitly log quota issues
      if (errorMsg.includes("quota") || errorMsg.includes("429")) {
         console.log("[ImageService] Gemini Quota Exceeded. Priority fallback to Pollinations enabled.");
      }
    }
  }

  // Tier 2: Pollinations AI (Stable, Free/Keyed)
  // Implement a retry loop for Pollinations to handle temporary queue congestion (429)
  let pollinationsRetries = 0;
  const maxPollinationsRetries = 2;
  
  while (pollinationsRetries <= maxPollinationsRetries) {
    try {
      console.log(`[ImageService] Tier 2: Pollinations Fallback (Attempt ${pollinationsRetries + 1})...`);
      const pollinationsKey = "sk_abMRdPPA33IpcQ6uKt4PokI1lWVwPBAl"; 
      const pollinationsPrompt = encodeURIComponent(`Storybook style: ${stylePrompt}. Scene: ${englishText}. Context: ${englishContext}. No text, high quality digital art.`);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${pollinationsPrompt}?width=800&height=800&nologo=true&seed=${Math.floor(Math.random() * 1000000)}&model=flux`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); 
      
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
      } else if (fetchResponse.status === 429) {
        console.warn(`[ImageService] Pollinations busy (429). Retrying in 3 seconds...`);
        pollinationsRetries++;
        await new Promise(r => setTimeout(r, 3000));
        continue;
      } else {
        console.warn(`[ImageService] Pollinations returned ${fetchResponse.status}. Skipping.`);
        break;
      }
    } catch (pError: any) {
      console.warn("[ImageService] Pollinations Fallback failed:", pError.message || pError);
      break;
    }
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
  } catch (error) {
    console.warn("[ImageService] Failed to cache placeholder:", error);
    handleFirestoreError(error, OperationType.WRITE, `image_cache/${hash}`);
  }

  return { imageUrl, type: 'placeholder' };
}
