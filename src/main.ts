import * as dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import { startCrayonChan } from './crayon-chan';

const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: envFile });

console.log(`Loading environment variables from ${envFile}`);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Required to receive message content
    ],
});

const token = process.env.DISCORD_API_KEY;

if (!token) {
    console.error('Discord token is not set in environment variables.');
    process.exit(1);
}

client.login(token);

startCrayonChan(client);

console.log(`[${new Date().toLocaleString()}] End of execution`)
    //`https://discord.com/oauth2/authorize?client_id=<YOUR_CLIENT_ID>&scope=bot&permissions=<PERMISSIONS_INTEGER>`

