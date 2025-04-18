import * as dotenv from 'dotenv';

const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: envFile });

console.log(`Loading environment variables from ${envFile}`);

const discordApiKey = process.env.DISCORD_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!discordApiKey) {
    console.error('Discord token is not set in environment variables.');
    process.exit(1);
}

if (!geminiApiKey) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
    process.exit(1);
}

export { discordApiKey, geminiApiKey }
