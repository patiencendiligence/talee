import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";
import { generatePlaceholderImage } from "../utils/imageGenerator";
export { generatePlaceholderImage };
import { db, auth } from "../lib/firebase";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { hashText } from "../lib/utils";
import { compressImage, uploadImage, generateImageHash } from "../utils/imageUtils";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
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

  // Tier 1: Gemini AI Image Generation
  try {
    console.log("Generating image for:", text, "with style:", stylePrompt);
    
    // Explicit prompt to avoid text and maintain consistency
    const systemPrompt = `You are a world-class storybook illustrator. Create a whimsical, consistent, and beautiful illustration.

STYLE GUIDELINES:
${stylePrompt}

CONSISTENCY: The characters and setting must match the previous story context provided. 

NO TEXT: ABSOLUTELY NO LETTERS, WORDS, OR TITLES IN THE IMAGE. 
- Only purely visual storytelling. 
- No Korean or English text. 
- Even if there is dialogue in the prompt, DO NOT show it visually. 
- The only exception is very minimal onomatopoeia if essential, but prefer NO text at all.

STORY CONTEXT: ${context || 'Beginning of a new story'}

CURRENT SCENE: ${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    console.log("Gemini response received. Candidates:", response.candidates?.length);

    let rawBlob: Blob | null = null;
    let mimeType = 'image/png';
    // The response may contain both image and text parts
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
      const finishReason = response.candidates?.[0]?.finishReason;
      const textResponse = response.text;
      console.warn("No image in Gemini response. Finish reason:", finishReason);
      if (textResponse) console.warn("Model response text:", textResponse);
      throw new Error(textResponse || "No image part in Gemini response");
    }

    return await processAndCacheImage(rawBlob, hash, text, 'ai');

  } catch (error: any) {
    console.error("Gemini Generation failed:", error);
    
    // Check if it's a quota error
    const isGeminiQuota = error?.message?.includes('429') || error?.message?.includes('quota');
    const openaiKey = (import.meta as any).env.VITE_OPENAI_API;

    if (openaiKey) {
      console.log("Attempting OpenAI fallback...");
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
          return await processAndCacheImage(fallbackBlob, hash, text, 'openai');
        }
      } catch (oaError: any) {
        console.error("OpenAI Fallback failed:", oaError);
        const isOpenAIQuota = oaError?.message?.includes('429') || oaError?.message?.includes('quota') || oaError?.message?.includes('insufficient_quota');
        
        if (isGeminiQuota || isOpenAIQuota) {
           throw new Error("QUOTA_EXCEEDED");
        }
      }
    } else if (isGeminiQuota) {
      throw new Error("QUOTA_EXCEEDED");
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
