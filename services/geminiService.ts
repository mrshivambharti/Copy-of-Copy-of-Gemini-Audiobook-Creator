import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExtractedDocument } from "../types";
import { TTS_CHUNK_SIZE } from "../constants";
import { base64ToBytes, bytesToBase64, concatenateBytes } from "../utils/audioHelper";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to convert File to Base64
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * 1. Extract Text & Detect Language
 * Uses gemini-2.5-flash for efficient document understanding.
 */
export const extractTextAndLanguage = async (file: File): Promise<ExtractedDocument> => {
  try {
    const filePart = await fileToGenerativePart(file);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          filePart,
          {
            text: `Extract all readable text from this document for an audiobook.
                   
                   Strict Cleaning Instructions:
                   1. Remove page numbers, headers, footers, citations, and legal disclaimers.
                   2. Normalize excessive whitespace and newlines. 
                   3. Convert bullet points into natural reading flow (e.g., replace bullets with "First," "Next," or simply pauses like commas).
                   4. Remove unpronounceable special characters, URLs, or artifacts (e.g., underscores in forms).
                   5. Expand abbreviations where obvious (e.g., "Dr." to "Doctor", "&" to "and").
                   
                   Also, detect the primary language of the document.
                   Return the result in JSON format.`
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The full extracted and cleaned text" },
            detectedLanguage: { type: Type.STRING, description: "The detected language name (e.g. English, Hindi)" }
          },
          required: ["text", "detectedLanguage"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from Gemini");
    
    return JSON.parse(jsonText) as ExtractedDocument;
  } catch (error) {
    console.error("Extraction Error:", error);
    throw new Error("Failed to process document. Please try a different file.");
  }
};

/**
 * 2. Translate Text (if necessary)
 * Uses gemini-2.5-flash.
 */
export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  try {
    let prompt = `Translate the following text into ${targetLanguage}. Ensure the translation is natural and suitable for an audiobook.`;
    
    // Special handling for Hindi
    if (targetLanguage.toLowerCase().includes('hindi')) {
      prompt += ` \nIMPORTANT INSTRUCTION: Use conversational, local speakable Hindi (Hinglish where appropriate for common technical or modern terms). 
      - Do NOT use pure, formal, or Sanskritized Hindi (Shuddh Hindi).
      - It should sound like a natural conversation between friends.
      - Keep English words for terms like 'Computer', 'Internet', 'Office', etc., instead of translating them to complex Hindi equivalents.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [{
          text: `${prompt}\n\nText to translate:\n"${text}"`
        }]
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Translation Error:", error);
    throw new Error("Failed to translate text.");
  }
};

/**
 * Helper to split text into chunks
 */
function splitTextSafe(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    if (text.length - start <= maxLength) {
      chunks.push(text.slice(start));
      break;
    }

    // Find the nearest punctuation or space to break at within the limit
    let end = start + maxLength;
    const splitPoints = ['. ', '? ', '! ', '.\n', ' '];
    let foundSplit = false;

    for (const point of splitPoints) {
      const lastPointIndex = text.lastIndexOf(point, end);
      if (lastPointIndex > start && lastPointIndex < end) {
        end = lastPointIndex + point.length;
        foundSplit = true;
        break;
      }
    }

    // If no good split point found, hard split
    if (!foundSplit) {
      end = start + maxLength;
    }

    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

/**
 * 3. Generate Speech
 * Uses gemini-2.5-flash-preview-tts
 * Supports chunking for long texts.
 */
export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  try {
    const chunks = splitTextSafe(text, TTS_CHUNK_SIZE);
    const audioParts: Uint8Array[] = [];

    // Process chunks sequentially to respect potential rate limits and order
    for (const [index, chunk] of chunks.entries()) {
      if (!chunk.trim()) continue;

      // console.log(`Generating audio for chunk ${index + 1}/${chunks.length}`);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: chunk }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        audioParts.push(base64ToBytes(base64Audio));
      } else {
        console.warn(`No audio returned for chunk ${index}`);
      }
    }

    if (audioParts.length === 0) throw new Error("No audio generated from text.");

    // Merge all PCM chunks
    const mergedBytes = concatenateBytes(audioParts);
    
    return bytesToBase64(mergedBytes);
  } catch (error) {
    console.error("TTS Error:", error);
    throw new Error("Failed to generate speech audio.");
  }
};