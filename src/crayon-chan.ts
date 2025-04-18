
import { Client, Message, TextChannel } from 'discord.js';
import { getGeminiResponse, decideWhetherBotWasTalkedTo, FunctionMapping } from './gemini_api';
import { MessageHistory } from './interfaces/messageHistory';
import { handleChannelsCommand, handleSendCommand } from './commands';

async function fetchMessageHistory(message: Message, client: Client): Promise<MessageHistory[]> {
    const channel = client.channels.cache.get(message.channelId);
    if (channel && channel.isTextBased()) {

        try {
            let messages = await channel.messages.fetch({ limit: 10 }); // Fetch last 10 messages
            messages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp); // Sort messages by timestamp
            let history = Array.from(messages.values()).map(m => ({
                role: m.author.id === client.user?.id ? "model" : "user",
                parts: [{ text: m.content.toString() }]
            }));

            // Filter out model messages at the beginning of the history
            while (history.length > 0 && history[0].role === 'model') {
                history.shift();
    }
            return history;
        } catch (error) {
            console.error("Failed to fetch message history:", error);
            return [];
        }

    }
    return [];
}

async function sendMessageChunked(message: Message, content: string): Promise<void> {
    const chunkSize = 2000;
    for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.substring(i, i + chunkSize);
        try {
            await message.channel.send(chunk);
        } catch (error) {
            console.error('Failed to send message chunk:', error);
        }
    }
}

function buildToolsConfig(): any[] { // Consider using a more specific type if available from the SDK
    return [ // The outer array holds tool configurations (often just one for function calling)
        {
            // The key should be 'functionDeclarations' holding an array of functions
            functionDeclarations: [
                { // This is the actual function declaration object
                    name: "get_weather",
                    description: "Get the current weather in a city",
                    parameters: {
                        type: "OBJECT", // Correct: Type of the parameters structure itself
                        properties: {
                            city: {
                                type: "STRING",
                                description: "The city to get the weather for. If there are ambiguities between cities with the same name in different countries, you should give preference to cities from Brazil",
                            },
                        },
                        required: ["city"]
                    }
                }
                // Add more function declarations here if needed
                // , { name: "another_function", ... }
            ]
        }
    ];
}

export async function startCrayonChan(client: Client) {
    client.on('ready', () => {
        console.log(`Logged in as ${client.user?.tag}!`);
    });

    client.on('messageCreate', async (message: Message) => {
        if (message.author.bot) return; // Ignore messages from other bots

        if (message.channel instanceof TextChannel && message.channel.name === 'bot-dev') {
            console.log(`Received message: ${message.content} from ${message.author.tag}`);
        }

        if (!client.user?.id) {
            console.warn("Client user or client user ID is not available.");
            return;
        }

        try {
            const history = await fetchMessageHistory(message, client);
            const shouldRespond = await decideWhetherBotWasTalkedTo(history);

            if (shouldRespond) {
                // Remove the bot's mention from the message content using regex
                const botMentionRegex = new RegExp(`(<@!?${client.user?.id ?? ''}>\\s*)`, 'gi');
                let contentWithoutMention = message.content.replace(botMentionRegex, '').trim();

                // Build the tools configuration
                const tools = buildToolsConfig();

                const geminiResponse = await getGeminiResponse(contentWithoutMention, history, tools);
                console.log('====================================');
                console.log({geminiResponse});
                console.log('====================================');
                if (geminiResponse?.text) {
                    await sendMessageChunked(message, geminiResponse.text);

                } else {
                    const reply = await message.reply('Could not retrieve information from language model.');
                    if (!reply) {
                        console.error('Failed to send reply.');
                    }
                }
            } else {
                console.log("Bot decided not to respond.");
            }
        } catch (error) {
            console.error('Failed to get response from Gemini or determine if bot was talked to:', error);
            const reply = await message.reply('Could not retrieve information from language model.');
            if (!reply) {
                console.error('Failed to send reply.');
            }
        }

        if (message.mentions.users.has(client.user.id)) return;

        if (message.content === '!channels') {
            await handleChannelsCommand(message);
            return;
        }

        if (message.content.startsWith('!send ')) {
            await handleSendCommand(message, client);
            return;
        }
    });
}

