import { GoogleGenerativeAI } from "@google/generative-ai";
import { geminiApiKey } from './config';
import { MessageHistory } from './interfaces/messageHistory';
import * as fs from 'fs'
import * as path from 'path';
import { getWeather } from './services/weather_service';
import { colorize } from 'json-colorizer';

async function handleFunctionCall(functionName: string, functionArgs: any, history: MessageHistory[]): Promise<GeminiResponse> {
    // Map function names to their implementations
    const functionMapping: FunctionMapping = {
        get_weather: getWeather,
    };

    if (functionName in functionMapping) {
        try {
            const functionResult = await functionMapping[functionName](functionArgs);
            // Format the weather data into a string that Gemini can use
            if (functionResult) {
                try {
                    // The function call was successful
                    const weatherData = JSON.parse(functionResult as string);

                    // Check if weatherData is a string indicating an error
                    if (typeof weatherData === 'string') {
                        return { text: weatherData }; // Return the error message directly
                    }

                    // Ask Gemini to generate a weather report in prose
                    const geminiProseResponse = await getGeminiResponse(
                        `Here is the weather data: ${JSON.stringify(weatherData)}.  Please generate a short weather report in prose. Use emoji and keep a cheerful tone.`,
                        history // Pass the history to maintain context
                    );

                    if (geminiProseResponse?.text) {
                        return { text: geminiProseResponse.text };
                    } else {
                        return { text: "Failed to generate a weather report." };
                    }
                } catch (parseError) {
                    console.error("Failed to parse weather data:", parseError);
                    return { text: "The function call returned a result, but I was unable to parse it." };
                }
            } else {
                return { text: "The function call returned no result." };
            }
        } catch (functionError: any) {
            console.error(`Error executing function ${functionName}:`, functionError);
            return { text: `Error executing function ${functionName}: ${functionError.message}` };
        }
    } else {
        return { text: `Function ${functionName} not implemented.` };
    }
}


const systemPromptPath = path.join(__dirname, '../system_prompt.txt');
const systemPrompt = fs.readFileSync(systemPromptPath, 'utf-8')

export interface FunctionMapping {
    [name: string]: (args: any) => Promise<string>;
}


interface GeminiResponse {
    text?: string;
    function_call?: {
        name: string;
        arguments: any;
    };
}

async function getGeminiResponse(message: string, history: MessageHistory[] = [], tools?: any[]): Promise<GeminiResponse> {
    console.log("getGeminiResponse called");

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", tools: tools });


    if (history && Array.isArray(history)) {
        history.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
    } else {
        console.error("History is not a valid array:", history);
    }


    try {
        console.log(`Sending message to Gemini: ${message}`);
        const chat = model.startChat({ history });
        let result;
        try {
            result = await chat.sendMessage(message);
        } catch (sendMessageError: any) {
            console.error("Failed to sendMessage to Gemini:", sendMessageError);
            console.error("sendMessageError details:", sendMessageError.message, sendMessageError.stack);
            return { text: "Failed to get information from Gemini due to sendMessage error." };
        }
        console.log(`Result from sendMessage: ${colorize(result)}`);
        const response = await result.response;

        // Check for function call
        if (response.candidates && response.candidates.length > 0 && response.candidates[0].content.parts) {
            const firstPart = response.candidates[0].content.parts[0];
            if (firstPart.functionCall) {
                const functionName = firstPart.functionCall.name;
                const functionArgs = firstPart.functionCall.args;

                console.log(`Function call detected: ${functionName} with args ${JSON.stringify(functionArgs)}`);
                // Refactor: call extracted function to handle the function call
                return await handleFunctionCall(functionName, functionArgs, history);
            } else if (response.candidates && response.candidates.length > 0 && response.candidates[0].content.parts) {
                const responseText = response.candidates[0].content.parts[0].text;
                 if (tools && tools.length > 0 && !responseText) {
                    console.warn("Model was expected to call a function but did not.");

                    return { text: "I was expecting to use a tool, but something went wrong." };
                }

                return { text: responseText };
            } else {
               console.warn("Unexpected response structure from Gemini.  No candidates or content parts.");
               return { text: "Unexpected response structure from Gemini." };
            }
        } else {
            console.warn("Unexpected response structure from Gemini. No response candidates");
            return { text: "Unexpected response structure from Gemini." };
        }
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

export { getGeminiResponse, decideWhetherBotWasTalkedTo, FunctionMapping, functionDeclarations, setFunctionDeclarations };
