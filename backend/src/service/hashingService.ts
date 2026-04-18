import crypto from 'crypto';


function generateEventHash(title: string, eventType: string, senderEmail: string): string {
    const rawString = `${title.trim().toLowerCase()}-${eventType.trim().toUpperCase()}-${senderEmail.trim().toLowerCase()}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
}

function generateMailHash(mail: string): string {
    const rawString = `${mail.trim().toLowerCase()}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
}

export { generateEventHash, generateMailHash };