
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Scenario, DialogueTurn, VocabularyItem, Level, Topic, Duration } from "../types";

const API_KEY = process.env.API_KEY || '';

export const generateScenario = async (level: Level, topic: Topic, duration: Duration, goal: string): Promise<Scenario> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const levelInstructions = {
    'Beginner': 'Use basic vocabulary and simple sentence structures. Avoid all complex metaphors.',
    'Intermediate': 'Use a mix of professional terminology and standard social idioms.',
    'Advanced': 'Use complex reasoning, professional leadership language, and nuanced cultural expressions.'
  };

  const topicInstructions = {
    'Job Interview': 'The scenario MUST be a formal job interview for a Frontend Lead or Junior role. Discuss technical skills, leadership, and career history.',
    'Work Daily': 'The scenario MUST be a workplace interaction like a sprint planning, technical bug discussion, or 1-on-1 manager meeting.',
    'Casual': 'The scenario MUST be COMPLETELY NON-WORK RELATED. It should be about hobbies, travel, food, weekend plans, or sports. DO NOT mention projects, deadlines, code, or office work.'
  };

  const lengthInstructions = {
    '1m': 'Generate approximately 6-8 dialogue turns (about 150 words total).',
    '3m': 'Generate a lengthy, detailed dialogue with at least 15-20 turns. Each turn should have 2-3 sentences. Aim for roughly 500 words.',
    '5m': 'Generate a very long and immersive dialogue with at least 30-35 turns. Provide depth and detail in the conversation. Aim for roughly 800+ words.'
  };

  const prompt = `
    Create an English learning dialogue for a ${level} level student.
    ${levelInstructions[level]}
    ${topicInstructions[topic]}
    ${lengthInstructions[duration]}
    
    The user's professional background: ${goal}. 
    
    CRITICAL: 
    1. For every English turn, provide a natural Persian (Farsi) translation.
    2. If the topic is 'Casual', strictly avoid workplace themes.
    3. Ensure the dialogue feels like a real conversation, not just a list of facts.
    
    Response format: JSON ONLY.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          context: { type: Type.STRING },
          participants: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                voice: { type: Type.STRING, enum: ['Kore', 'Puck'] }
              },
              required: ['name', 'role', 'voice']
            }
          },
          dialogue: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                speaker: { type: Type.STRING },
                text: { type: Type.STRING },
                persianText: { type: Type.STRING },
                role: { type: Type.STRING }
              },
              required: ['speaker', 'text', 'persianText', 'role']
            }
          },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                partOfSpeech: { type: Type.STRING },
                englishMeaning: { type: Type.STRING },
                persianMeaning: { type: Type.STRING }
              },
              required: ['word', 'partOfSpeech', 'englishMeaning', 'persianMeaning']
            }
          }
        },
        required: ['title', 'context', 'participants', 'dialogue', 'vocabulary']
      }
    }
  });

  const scenarioData = JSON.parse(response.text);
  return {
    ...scenarioData,
    id: Math.random().toString(36).substr(2, 9)
  };
};

export const getWordDefinition = async (word: string, context: string): Promise<VocabularyItem> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = `Define the word "${word}" used in this context: "${context}". 
  Provide the part of speech, a clear English meaning, and a natural Persian translation.
  Format as JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          englishMeaning: { type: Type.STRING },
          persianMeaning: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateAudio = async (scenario: Scenario, slowMode: boolean = false): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const pacingInstruction = slowMode 
    ? "Speak extremely slowly and clearly. Pause slightly between words. This is for a beginner student." 
    : "Speak at a natural, conversational pace.";

  const dialogueString = scenario.dialogue
    .map(turn => `${turn.speaker}: ${turn.text}`)
    .join('\n\n');

  const speakerVoiceConfigs = scenario.participants.map(p => ({
    speaker: p.name,
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: p.voice }
    }
  }));

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `${pacingInstruction}\n\nTTS the following conversation:\n\n${dialogueString}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: speakerVoiceConfigs
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio generation failed");
  
  return base64Audio;
};

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
