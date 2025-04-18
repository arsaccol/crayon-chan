
import { Client, Message, TextChannel } from 'discord.js';
import { getGeminiResponse } from './gemini_api';
import { handleChannelsCommand, handleSendCommand } from './commands';

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

            // Only call Gemini if there's more than just the mention
            if (contentWithoutMention && contentWithoutMention.length > 0) {
                try {
                    const geminiResponse = await getGeminiResponse(message, client);
                    const reply = await message.reply(geminiResponse?.text || 'Could not retrieve information from language model.');
                    if (!reply) {
                        console.error('Failed to send reply.');
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
