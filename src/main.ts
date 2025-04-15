import * as dotenv from 'dotenv';

const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: envFile });

console.log(`Loading environment variables from ${envFile}`);

// Your bot code will go here

console.log(`Discord API Key: ${process.env.DISCORD_API_KEY}`);

