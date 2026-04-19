import { summarizeEmails } from "./aiService";
import { fetchRecentEmails } from "./mailService";
import { saveEvents } from "./eventService";
import { Mail } from "../model/emailsSchema";
import { generateMailHash } from "../service/hashingService"


import { logger } from "../utils/logger";

async function processEmails() {
    try {
        logger.info("Pipeline triggered: Manual email fetch initiated");
        const emails = await fetchRecentEmails();
        logger.info(`Fetched ${emails.length} emails from IMAP`);

        const events = await summarizeEmails(emails);
        logger.info(`Extracted ${events.length} actionable events via AI`);

        await saveEvents(events);
        logger.info("Successfully persisted extracted events to database");
        return events;
    } catch (error) {
        logger.error("Error processing manual emails", error);
        throw error;
    }
}

// Processes emails sent directly from Google Apps Script webhook
async function processWebhookEmails(emails: any[]) {
    try {
        logger.info(`Webhook triggered: Received ${emails.length} raw emails for processing`);

        const nonExistingMails = [];
        const hashesToSave = [];

        for (const email of emails) {
            // Compose a unique string for the email (thread URL + Date)
            const uniqueString = `${email.url ?? ''}-${email.date ?? ''}`;
            const hash = generateMailHash(uniqueString);

            // Check if this specific email thread has already been processed by AI
            const exists = await Mail.findOne({ mailHash: hash });
            if (!exists) {
                nonExistingMails.push(email);
                hashesToSave.push(hash);
            }
        }

        if (nonExistingMails.length === 0) {
            logger.info("No new emails to process. All emails are already in DB.");
            return [];
        }

        const events = await summarizeEmails(nonExistingMails);
        logger.info(`Extracted ${events.length} actionable events via AI`);

        await saveEvents(events);
        logger.info("Successfully persisted webhook events to database");

        // Mark these emails as processed in the DB so we skip them next time
        const mailDocs = hashesToSave.map(h => ({ mailHash: h, processed: true }));
        await Mail.insertMany(mailDocs);

        return events;
    } catch (error) {
        logger.error("Error processing webhook emails", error);
        throw error;
    }
}

async function triggerGoogleScript() {
    const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL;
    if (!googleScriptUrl) {
        logger.error("GOOGLE_SCRIPT_URL not configured in .env");
        return;
    }
    
    await fetch(googleScriptUrl, { method: 'GET' });
    logger.info("Sent trigger to Google Apps Script successfully");
}

export { processEmails, processWebhookEmails, triggerGoogleScript };
