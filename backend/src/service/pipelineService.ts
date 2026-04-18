import { summarizeEmails } from "./aiService";
import { fetchRecentEmails } from "./mailService";
import { saveEvents } from "./eventService";


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
        const events = await summarizeEmails(emails);
        logger.info(`Extracted ${events.length} actionable events via AI`);

        await saveEvents(events);
        logger.info("Successfully persisted webhook events to database");

        return events;
    } catch (error) {
        logger.error("Error processing webhook emails", error);
        throw error;
    }
}

export { processEmails, processWebhookEmails };
