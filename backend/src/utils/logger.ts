import fs from 'fs';
import path from 'path';

// Define log directory and file
const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Ensure the log file exists
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
}

/**
 * Helper to write a formatted log entry and print to console
 */
function writeLog(level: 'INFO' | 'ERROR' | 'WARN', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;

    if (data) {
        if (data instanceof Error) {
            logMessage += ` | ${data.message}\n${data.stack}`;
        } else {
            logMessage += ` | ${JSON.stringify(data)}`;
        }
    }

    logMessage += '\n';

    // Output to console
    if (level === 'ERROR') {
        console.error(logMessage.trim());
    } else if (level === 'WARN') {
        console.warn(logMessage.trim());
    } else {
        console.log(logMessage.trim());
    }

    // Append to log file
    fs.appendFileSync(LOG_FILE, logMessage);
}

export const logger = {
    info: (msg: string, data?: any) => writeLog('INFO', msg, data),
    error: (msg: string, data?: any) => writeLog('ERROR', msg, data),
    warn: (msg: string, data?: any) => writeLog('WARN', msg, data),
};
