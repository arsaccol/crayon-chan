import { Client, GatewayIntentBits } from 'discord.js';
import { startCrayonChan } from './crayon-chan';
import { discordApiKey } from './config';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Required to receive message content
    ],
});

if (!discordApiKey) {
    console.error('Discord token is not set in environment variables.');
    process.exit(1);
}

client.login(discordApiKey);

startCrayonChan(client);

console.log(`[${new Date().toLocaleString()}] End of execution`)
    //`https://discord.com/oauth2/authorize?client_id=<YOUR_CLIENT_ID>&scope=bot&permissions=<PERMISSIONS_INTEGER>`

