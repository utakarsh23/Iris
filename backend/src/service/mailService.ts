import * as imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import config from '../config';

const imapConfig: imaps.ImapSimpleOptions = {
    imap: {
        user: config.imap.user,
        password: config.imap.password,
        host: config.imap.host,
        port: config.imap.port,
        tls: config.imap.tls,
        tlsOptions: config.imap.tlsOptions
    }
}

export async function fetchRecentEmails(limit: number = 25): Promise<any[]> {
    try {
        const connection = await imaps.connect(imapConfig);
        await connection.openBox('INBOX');

        // 'UNSEEN' | 'ALL' | 'SEEN'
        const searchCriteria = ['ALL'];
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
            struct: true,
            markSeen: true
        };

        const messages = await connection.search(searchCriteria, fetchOptions);

        const mappedMessages = messages.map(async (message) => {
            const parts = imaps.getParts(message.attributes.struct!);

            // Extract the body content
            const textPart = parts.find(part => part.disposition !== 'attachment' && part.which === 'TEXT');
            let body = '';

            if (textPart) {
                const partData = await connection.getPartData(message, textPart);
                const parsed = await simpleParser(partData);
                body = parsed.text || parsed.html || '';
            } else {
                // Fallback for simple messages
                const all = message.parts.find(p => p.which === 'TEXT');
                if (all) {
                    const parsed = await simpleParser(all.body);
                    body = parsed.text || parsed.html || '';
                }
            }

            const header = message.parts.find(p => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
            return {
                subject: header?.body?.subject?.[0] || 'No Subject',
                from: header?.body?.from?.[0] || 'Unknown Sender',
                date: header?.body?.date?.[0] || 'Unknown Date',
                body: body
            };
        });

        const results = await Promise.all(mappedMessages.slice(0, limit));
        connection.end();
        return results;

    } catch (error) {
        console.error('Error fetching emails:', error);
        throw error;
    }
}
