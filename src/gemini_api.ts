import { GoogleGenerativeAI } from "@google/generative-ai";
import { geminiApiKey } from './config';
import { Message } from 'discord.js';
import * as fs from 'fs'
import * as path from 'path';

const systemPromptPath = path.join(__dirname, '../system_prompt.txt');
const systemPrompt = fs.readFileSync(systemPromptPath, 'utf-8')


interface GeminiResponse {
    text: string;
}

async function getGeminiResponse(message: Message, client: any): Promise<GeminiResponse> {
    console.log("getGeminiResponse called");

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Fetch conversation history
    const channel = client.channels.cache.get(message.channelId);
    console.log(`Channel: ${channel}`);
    let history: { role: string; parts: { text: string; }[]; }[] = [];
    if (channel && channel.isTextBased()) {
        let messages = await channel.messages.fetch({ limit: 10 }); // Fetch last 10 messages
        messages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp); // Sort messages by timestamp
        history = messages.map(m => ({
            role: m.author.id === client.user.id ? "model" : "user",
            parts: [{ text: m.content }],
        }));

        // Filter out model messages at the beginning of the history
        while (history.length > 0 && history[0].role === 'model') {
            history.shift();
        }
    }
    console.log(`History: ${JSON.stringify(history)}`);

    // Add system prompt if it's not already in the history
    const systemPromptExists = history.some(item =>
        item.role === 'user' && item.parts.some(part => part.text === systemPrompt)
    );

    if (!systemPromptExists) {
        history.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
    }

    const chat = model.startChat({
        history: history,
        generationConfig: {
            maxOutputTokens: 4000,
        },
    });

    const msg = message.content;
    try {
        console.log(`Sending message to Gemini: ${msg}`);
        let result;
        try {
            result = await chat.sendMessage(msg);
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
