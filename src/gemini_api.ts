import { GoogleGenerativeAI } from "@google/generative-ai";
import { geminiApiKey } from './config';
import { Message } from 'discord.js';
import { MessageHistory } from './interfaces/messageHistory';
import * as fs from 'fs'
import * as path from 'path';

const systemPromptPath = path.join(__dirname, '../system_prompt.txt');
const systemPrompt = fs.readFileSync(systemPromptPath, 'utf-8')


interface GeminiResponse {
    text: string;
}

async function getGeminiResponse(message: string, history: MessageHistory[] = []): Promise<GeminiResponse> {
    console.log("getGeminiResponse called");

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


   if (history && Array.isArray(history)) {
       history.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
   } else {
       console.error("History is not a valid array:", history);
   }


    try {
        console.log(`Sending message to Gemini: ${message}`);
	const chat = model.startChat({history});
        let result;
        try {
            result = await chat.sendMessage(message);
        } catch (sendMessageError: any) {
            console.error("Failed to sendMessage to Gemini:", sendMessageError);
            console.error("sendMessageError details:", sendMessageError.message, sendMessageError.stack);
            return { text: "Failed to get information from Gemini due to sendMessage error." };
        }
        console.log(`Result from sendMessage: ${JSON.stringify(result)}`);
        const response = await result.response;
        const responseText = response.text();
        console.log(`Gemini response: ${responseText}`);

        if (responseText === "Failed to get information from Gemini.") {
            return { text: "Gemini was unable to provide a response." };
        }
        return { text: responseText };
    } catch (error: any) {
        console.error("Failed to get response from Gemini:", error);
        console.error("Error details:", error.message, error.stack); // Log the error message and stack trace
        return { text: "Failed to get information from Gemini." };
    }
}

export { getGeminiResponse };
