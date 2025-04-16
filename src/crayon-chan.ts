
import * as dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from 'fs';

const systemPrompt = fs.readFileSync('system_prompt.txt', 'utf8');

export async function startCrayonChan(client: Client) {
    client.on('ready', () => {
        console.log(`Logged in as ${client.user?.tag}!`);
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return; // Ignore messages from other bots

        if (message.channel.name === 'bot-dev') {
            console.log(`Received message: ${message.content} from ${message.author.tag}`);
        }

        if (message.mentions.users.has(client.user.id)) {
            // Log the original message content
            console.log(`Original message content: ${message.content}`);

            // Create a copy of the message content
            let msgContent = message.content;

            // Remove the bot's mention from the message content using regex
            const botMentionRegex = new RegExp(`(<@!?${client.user.id}>\\s*)`, 'gi');
            let contentWithoutMention = msgContent.replace(botMentionRegex, '').trim();

            // Log the message content after mention removal
            console.log(`Message content after mention removal: ${contentWithoutMention}`);

            // Only call Gemini if there's more than just the mention
            if (contentWithoutMention && contentWithoutMention.length > 0) {
                try {
                    const geminiResponse = await getGeminiResponse(message, client);
                    message.reply(geminiResponse);
                } catch (error) {
                    console.error('Failed to get response from Gemini:', error);
                    message.reply('Could not retrieve information from Gemini.');
                }
            } else {
                message.reply('You mentioned me, but didn\'t ask anything!');
            }
        }

        if (message.content === '!channels') {
            // List all channels in the guild
            const channels = message.guild?.channels.cache;
            if (channels) {
                let channelList = 'Channels in this server:\n';
                channels.forEach((channel) => {
                    channelList += `- ${channel.name} (${channel.id})\n`;
                });
                message.reply(channelList);
            } else {
                message.reply('Could not retrieve channels.');
            }
            return;
        }

        if (message.content.startsWith('!send ')) {
            // Send a message to a specific channel
            const args = message.content.split(' ');
            const channelId = args[1];
            const text = args.slice(2).join(' ');

            if (!channelId || !text) {
                message.reply('Usage: !send <channelId> <message>');
                return;
            }

            const channel = client.channels.cache.get(channelId);

            if (channel && channel.isTextBased()) {
                try {
                    await channel.send(text);
                    message.reply(`Sent message to channel ${channelId}`);
                } catch (error) {
                    console.error(`Could not send message to channel ${channelId}:`, error);
                    message.reply(`Could not send message to channel ${channelId}`);
                }
            } else {
                message.reply(`Channel ${channelId} not found or not a text channel.`);
            }
            return;
        }
    });
}

async function getLLMResponse(message: string): Promise<string> {
    // Replace this with your actual LLM API call
    console.log(`Sending message to LLM: ${message}`);
    return `LLM says: ${message}`; // Placeholder response
}


async function getGeminiResponse(message: any, client: any): Promise<string> {
    console.log("getGeminiResponse called");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Fetch conversation history
    const channel = client.channels.cache.get(message.channelId);
    console.log(`Channel: ${channel}`);
    let history = [];
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

    // Add system prompt
    history.unshift({ role: 'user', parts: [{ text: systemPrompt }] });

    const chat = model.startChat({
        history: history,
        generationConfig: {
            maxOutputTokens: 4000,
        },
    });

    const msg = message.content;
    try {
        console.log(`Sending message to Gemini: ${msg}`);
        const result = await chat.sendMessage(msg);
        const response = await result.response;
        const responseText = response.text();
        console.log(`Gemini response: ${responseText}`);

        if (responseText.length > 2000) {
            // Split the response into chunks of 2000 characters
            const chunkSize = 2000;
            let chunk = "";
            for (let i = 0; i < responseText.length; i += chunkSize) {
                chunk = responseText.substring(i, i + chunkSize);
                await message.reply(chunk);
            }
            return chunk;
        } else {
            return responseText;
        }
    } catch (error) {
        console.error("Failed to get response from Gemini:", error);
        return "Failed to get information from Gemini.";
    }
}
