import dotenv from 'dotenv';
dotenv.config();

const config = {
    mongodb: {
        uri: process.env.MONGODB_URI!,
        dbName: process.env.MONGODB_DB_NAME!,
    },
    port: parseInt(process.env.PORT || '9001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    geminiApiKey: process.env.GEMINI_API_KEY!,
    imap: {
        user: process.env.IMAP_USER!,
        password: process.env.IMAP_PASSWORD!,
        host: process.env.IMAP_HOST!,
        port: parseInt(process.env.IMAP_PORT || '993', 10),
        tls: true,
        tlsOptions: {
            rejectUnauthorized: false
        }
    },
    googleScriptUrl: process.env.GOOGLE_SCRIPT_URL!,
};

export default config;