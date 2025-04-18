
import { Client, Message, TextChannel } from 'discord.js';
import { getGeminiResponse } from './gemini_api';
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

        if (message.mentions.users.has(client.user.id)) {
            // Log the original message content
            console.log(`Original message content: ${message.content}`);

            // Remove the bot's mention from the message content using regex
            const botMentionRegex = new RegExp(`(<@!?${client.user?.id ?? ''}>\\s*)`, 'gi');
            let contentWithoutMention = message.content.replace(botMentionRegex, '').trim();

            // Log the message content after mention removal
            console.log(`Message content after mention removal: ${contentWithoutMention}`);

            try {
                const history = await fetchMessageHistory(message, client);
                const geminiResponse = await getGeminiResponse(contentWithoutMention, history);
                if (geminiResponse?.text) {
                    await sendMessageChunked(message, geminiResponse.text);
                } else {
                    const reply = await message.reply('Could not retrieve information from language model.');
                    if (!reply) {
                        console.error('Failed to send reply.');
                    }
                }
            } catch (error) {
                console.error('Failed to get response from Gemini:', error);
                const reply = await message.reply('Could not retrieve information from language model.');
                if (!reply) {
                    console.error('Failed to send reply.');
                }
            }
        } else {
            message.reply('You mentioned me, but didn\'t ask anything!');
        }

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
