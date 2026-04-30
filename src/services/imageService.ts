import { GoogleGenAI } from "@google/genai";
import { generatePlaceholderImage } from "../utils/imageGenerator";
export { generatePlaceholderImage };
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { hashText } from "../lib/utils";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function compressBase64(base64Str: string, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str); // Fallback to original if error
  });
}

export async function getStoryImage(text: string, stylePrompt: string, context?: string): Promise<string> {
  const hash = await hashText(`${text}_${stylePrompt}_${context || ''}`);
  
  // Tier 0: Check Cache
  try {
    const cacheRef = collection(db, "image_cache");
    const q = query(cacheRef, where("hash", "==", hash));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      console.log("Cached image found");
      return querySnapshot.docs[0].data().imageUrl;
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

    let rawImageUrl = '';
    // The response may contain both image and text parts
    if (response.candidates && response.candidates[0]?.content?.parts) {
      const parts = response.candidates[0].content.parts;
      console.log("Parts types:", parts.map(p => Object.keys(p)));
      
      for (const part of parts) {
        if (part.inlineData) {
          rawImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!rawImageUrl) {
      const finishReason = response.candidates?.[0]?.finishReason;
      const textResponse = response.text;
      console.warn("No image in Gemini response. Finish reason:", finishReason);
      if (textResponse) console.warn("Model response text:", textResponse);
      throw new Error(textResponse || "No image part in Gemini response");
    }

    // Compress before storing to avoid 1MB limit
    const imageUrl = await compressBase64(rawImageUrl);

    // Cache the result
    try {
      await setDoc(doc(db, "image_cache", hash), {
        hash,
        imageUrl,
        prompt: text,
        type: 'ai'
      });
    } catch (e) {
      console.warn("Failed to cache image:", e);
    }

    return imageUrl;

  } catch (error) {
    console.error("AI Generation failed, using placeholder:", error);
    const imageUrl = generatePlaceholderImage(text);
    
    // Optional: Cache the placeholder for consistency
    try {
      await setDoc(doc(db, "image_cache", hash), {
        hash,
        imageUrl,
        prompt: text,
        type: 'placeholder'
      });
    } catch (e) {
      console.warn("Failed to cache placeholder:", e);
    }

    return imageUrl;
  }
}
