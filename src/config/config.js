import { config as dotenvConfig } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from src/config/ regardless of where the process is started from
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: join(__dirname, '.env'), override: true });

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

export const config = {
        token: process.env.TOKEN || '',
        clientId: process.env.CLIENT_ID || '',
        prefix: '.',
        ownerIds: process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',') : [],

        colors: {
                bot: [214, 211, 203],
                error: [230, 190, 175],
                success: [140, 200, 170],
                warn: [255, 190, 120],
        },
        links: {
                supportServer: 'https://discord.gg/Ez4gCJQDxB',
                invite: 'https://discord.com/oauth2/authorize?client_id=1277525844319014955&permissions=4820258979704064&integration_type=0&scope=bot+applications.commands',
        },
        watermark: 'coded by bre4d',
        version: '2.0.0',

        database: {
                // SQLite — path is resolved automatically relative to the project root.
                // Override with DATABASE_PATH env var if needed.
                path: process.env.DATABASE_PATH || '',
        },

        cache: {
                type: 'memory',
                maxSize: isProduction ? 100000 : 50000,
                flushOnStart: false,
                flushOnShutdown: false,
        },

        tnc: {
                // Role ID that members must have to apply (or null to disable).
                // This is an alternative to the per-guild `/tnc setrole` command.
                requiredRoleId: process.env.TNC_REQUIRED_ROLE_ID || null,
        },

        lavalink: {
                nodes: [
                        {
                                identifier: 'lyrixa',
                                host: 'ultra.visionhost.cloud',
                                port: 2037,
                                password: 'Devine',
                                secure: false,
                        },
                ],
        },

        debug: !isProduction,
        environment,
};
