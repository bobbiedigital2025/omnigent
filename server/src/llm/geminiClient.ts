import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || 'MOCK_API_KEY';
const ai = new GoogleGenAI({ apiKey });

/**
 * Executes a prompt using Gemini 2.5 Pro (ideal for complex screenplay breakdowns, shot lists, and budget estimation)
 */
export async function runGeminiPro(prompt: string, systemInstruction?: string): Promise<string> {
  try {
    if (apiKey === 'MOCK_API_KEY') {
      console.log('[Gemini Client] Using fallback response mode (Set GEMINI_API_KEY in server/.env for live cloud model calls)');
      return `[Gemini 2.5 Pro Analysis]\nParsed screenplay prompt: "${prompt.slice(0, 80)}..."\nExtracted 4 scenes, 12 shot list items, and estimated pre-production budget.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    return response.text || 'No response text returned from Gemini 2.5 Pro.';
  } catch (err: any) {
    console.error('[Gemini Pro Error]:', err.message);
    throw new Error(`Gemini 2.5 Pro execution failed: ${err.message}`);
  }
}

/**
 * Executes a prompt using Gemini 2.5 Flash (ultra-fast for tool calling, telemetry parsing, and status updates)
 */
export async function runGeminiFlash(prompt: string, systemInstruction?: string): Promise<string> {
  try {
    if (apiKey === 'MOCK_API_KEY') {
      console.log('[Gemini Client] Using fallback response mode for Flash model');
      return `[Gemini 2.5 Flash Response]\nProcessed telemetry query: "${prompt.slice(0, 80)}..."\nStatus: Healthy. Zero bottleneck alerts.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    return response.text || 'No response text returned from Gemini 2.5 Flash.';
  } catch (err: any) {
    console.error('[Gemini Flash Error]:', err.message);
    throw new Error(`Gemini 2.5 Flash execution failed: ${err.message}`);
  }
}
