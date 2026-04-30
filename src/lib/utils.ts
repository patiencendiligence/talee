import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Global moderation filter
const BANNED_WORDS = ["욕설1", "욕설2", "badword"]; // Add more as needed

export function moderateText(text: string): string {
  let moderatedText = text;
  
  // Basic regex for common patterns if needed
  // ...

  BANNED_WORDS.forEach(word => {
    const regex = new RegExp(word, "gi");
    if (regex.test(moderatedText)) {
      moderatedText = moderatedText.replace(regex, "냥냥");
    }
  });

  return moderatedText;
}

// Simple hash for text caching
export async function hashText(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
