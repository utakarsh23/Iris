import { GoogleGenerativeAI } from '@google/generative-ai';
import config from "../config";
import { generateEventHash } from "./hashingService";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

export async function summarizeEmails(emails: any[]): Promise<any[]> {
    if (!emails || emails.length === 0) return [];

    const emailsContext = emails.map((e, index) =>
        `EmailIndex: ${index}\nFrom: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nBody: ${e.body.substring(0, 500)}\n---`
    ).join('\n');

    const currentDate = new Date().toISOString();
    const prompt = `
    You are a personal schedule extraction engine. Your ONLY job is to identify emails that contain a specific, time-bound action the recipient must take or attend.

    EXTRACT an event ONLY if the email contains ALL of the following:
    - A specific date or deadline (explicit or clearly implied, e.g., "by Friday", "April 20th", "tomorrow 3 PM")
    - A concrete action the recipient must perform (submit, attend, join, appear, complete, present, etc.)

    AUTOMATICALLY SKIP any email that is:
    - Mass-sent (newsletters, digests, marketing, notifications from platforms)
    - Informational with no personal action required
    - Social media notifications (Reddit, Twitter, LinkedIn, etc.)
    - Promotional or transactional (order confirmations, receipts, subscriptions)
    - Blog posts, product updates, or community roundups
    
    A good test: "Would the recipient miss something or face a consequence if they ignored this email?" If NO, skip it.

    PRIORITY RULES (assign based on consequence of missing it):
    - "ultra-high": Academic evaluations, graded submissions, or anything where missing it directly impacts academic/professional standing
    - "high": Professional screening rounds, career-related calls, or time-sensitive opportunities with hard deadlines
    - "medium": Scheduled group activities, collaborative sessions, or non-critical but time-bound commitments
    - "low": Informational gatherings, optional workshops, or low-stakes participation events

    The current date and time is: ${currentDate}. Use this to determine if an event is already missed.

    Return ONLY a raw JSON array. No markdown, no explanation, no wrapping.
    If zero events are found, return exactly: []

    Schema:
    [
      {
        "emailIndex": number, // MUST match the EmailIndex of the source email
        "title": "Concise event title",
        "description": "One-line description of what the user needs to do",
        "eventType": "ASSIGNMENT" | "EVENT" | "INTERVIEW" | "EXAM" | "MEETING" | "OTHER",
        "date": "YYYY-MM-DD",
        "time": "HH:MM", // Use "00:00" if no specific time is mentioned
        "eventStatus": "pending" | "missed" | "cancelled" | "completed" | "rescheduled",
        "priority": "ultra-high" | "high" | "medium" | "low"
      }
    ]

    Emails:
    ${emailsContext}
    `;



    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiGenerateText = response.text() || "[]";

        const parsedEvents = JSON.parse(aiGenerateText.trim().replace(/^```json|```$/g, ''));

        if (!Array.isArray(parsedEvents)) return [];

        // Merge AI extracted data with your deterministic, uncompromised data
        return parsedEvents.map(event => {
            const originalEmail = emails[event.emailIndex];

            return {
                title: event.title,
                description: event.description,
                eventType: event.eventType,
                date: event.date,
                time: event.time,
                priority: event.priority,
                eventStatus: event.eventStatus,
                eventHash: generateEventHash(event.title, event.eventType, originalEmail?.from || "Unknown"),

                // GUARANTEED SAFE DATA directly from the email source
                senderEmail: originalEmail?.from || "Unknown",
                // You can add more mapping here if needed (e.g. emailDate)
            };
        });

    } catch (error) {
        console.error("Error generating summary from Gemini:", error);
        return [];
    }
}
