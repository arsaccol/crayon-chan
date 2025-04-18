import { GoogleGenerativeAI } from "@google/generative-ai";
import { geminiApiKey } from './config';
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


async function decideWhetherBotWasTalkedTo(history: MessageHistory[]): Promise<boolean> {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const responseSchema = {
        type: "object",
        properties: {
            should_respond: {
                type: "boolean",
                description: "True if the bot should respond, false otherwise."
            },
            reason: {
                type: "string",
                description: "The reason for the decision."
            }
        },
        required: ["should_respond", "reason"]
    };

    try {
        const chat = model.startChat({
            history,
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema
            }
        });

        const prompt = `Given the conversation history, determine if the bot was directly addressed, \
if the message is a follow-up question to something the bot said, or if the user explicitly asks the bot to respond. \
However, the bot should NOT respond if the user explicitly tells it not to, or if the message is clearly not intended for the bot. \
The bot should also not respond if the message is just a general statement or observation. \
The bot should respond if an indirect reference to them is made in a way that prompts their response.\
However, if there's no implied intention for the bot to respond, they should not respond.\
Respond with a JSON object that indicates whether the bot should respond and the reasoning behind the decision.`;

        const result = await chat.sendMessage(prompt); const response =
          result.response;
        const responseText = response.text();
        console.log(responseText);

        try {
            const jsonResponse = JSON.parse(responseText);
            if (typeof jsonResponse === 'object' && jsonResponse !== null && 'should_respond' in jsonResponse) {
                console.log(`Gemini JSON Response: should_respond=${jsonResponse.should_respond}, reason=${jsonResponse.reason}`);
                return jsonResponse.should_respond === true; // Ensure boolean comparison
            } else {
                console.warn("Gemini did not provide a valid JSON object with 'should_respond'. Gemini response was:", responseText);
                return false;
            }
        } catch (jsonError) {
            console.error("Failed to parse Gemini response as JSON:", jsonError, "Gemini response was:", responseText);
            return false;
        }

    } catch (error: any) {
        console.error("Error in decideWhetherBotWasTalkedTo:", error);
        return false;
    }
}

export { getGeminiResponse, decideWhetherBotWasTalkedTo };
