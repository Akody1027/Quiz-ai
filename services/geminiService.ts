
import { GoogleGenAI, Type } from "@google/genai";
import { FactCheck } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getVerifiedFact(query: string): Promise<FactCheck> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Fact check or provide a deep dive for this trivia query: ${query}. Be concise but thorough.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = groundingChunks
    .filter((chunk: any) => chunk.web)
    .map((chunk: any) => ({
      title: chunk.web.title,
      uri: chunk.web.uri,
    }));

  return {
    query,
    fact: response.text || "No detailed information found.",
    sources,
  };
}

export async function generateGameSummaryTTS(score: number, questions: number, personalityName: string): Promise<string> {
  const prompt = `Say in the style of ${personalityName}: 'Congratulations on finishing the game! You scored ${score} out of ${questions}. It was a pleasure being your host today. See you next time!'`;
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
}
