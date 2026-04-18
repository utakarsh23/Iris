import { summarizeEmails } from "./aiService";
import { fetchRecentEmails } from "./mailService";
import { saveEvents } from "./eventService";


async function processEmails() {
    try {
        const emails = await fetchRecentEmails();
        const events = await summarizeEmails(emails);
        await saveEvents(events);
        return events;
    } catch (error) {
        console.error("Error processing emails:", error);
        throw error;
    }
}

// Processes emails sent directly from Google Apps Script webhook
async function processWebhookEmails(emails: any[]) {
    try {
        const events = await summarizeEmails(emails);

        await saveEvents(events);

        return events;
    } catch (error) {
        console.error("Error processing webhook emails:", error);
        throw error;
    }
}

export { processEmails, processWebhookEmails };
