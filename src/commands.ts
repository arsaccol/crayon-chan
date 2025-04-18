import { Client, Message, TextChannel } from 'discord.js';

async function handleChannelsCommand(message: Message) {
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
}

async function handleSendCommand(message: Message, client: Client) {
    // Send a message to a specific channel
    const args = message.content.split(' ');
    const channelId = args[1];
    const text = args.slice(2).join(' ');

    if (!channelId || !text) {
        message.reply('Usage: !send <channelId> <message>');
        return;
    }

    const channel = client.channels.cache.get(channelId);

    if (channel && channel.isTextBased() && channel instanceof TextChannel) {
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
}

export { handleChannelsCommand, handleSendCommand };
