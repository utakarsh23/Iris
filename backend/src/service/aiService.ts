import { GoogleGenerativeAI } from '@google/generative-ai';
import config from "../config";
import { generateEventHash } from "./hashingService";
import { IEvent } from "../model/eventsSchema";
import { IDailySummary, DailySummary } from "../model/dailySummary";
import { logger } from "../utils/logger";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });



async function summarizeEmails(emails: any[]): Promise<any[]> {
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
    - The email contains meetings schedule, interviews, assignments, exams, hackathons, workshops, submissions, forms, events, etc. 

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

    STRICT TITLE FORMATTING (CRITICAL FOR DEDUPLICATION):
    - Title MUST follow this exact pattern: "EventType:Core Event Name"
    - EventType must be one of: Webinar, Assignment, Exam, Interview, Meeting, Hackathon, Workshop, Submission, Form, Event
    - Core Event Name must be the shortest unique identifier for the event, using ONLY proper nouns and key terms
    - Examples: "Webinar:Build a Startup with AI", "Exam:FLAT IA 1 & 2", "Assignment:Re-Tutorial Home", "Submission:Solution Challenge Prototype", "Form:Pending Exposure MNCC Course", "Hackathon:ETHGlobal Open Agents"
    - NEVER add filler words like "Join", "Attend", "Submit your", years, or dates into the title
    - The SAME event from the SAME sender MUST ALWAYS produce the EXACT SAME title string

    The current date and time is: ${currentDate}. Use this to determine if an event is already missed.

    Return ONLY a raw JSON array. No markdown, no explanation, no wrapping.
    If zero events are found, return exactly: []

    Schema:
    [
      {
        "emailIndex": number, // MUST match the EmailIndex of the source email
        "title": "EventType:Core Event Name",
        "description": "One-line description of what the user needs to do",
        "eventType": "ASSIGNMENT" | "EVENT" | "INTERVIEW" | "EXAM" | "MEETING" | "WEBINAR" | "WORKSHOP" | "SUBMISSION" | "FORM" | "HACKATHON" | "OTHER",
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
        logger.info(`Sending ${emails.length} emails to Gemini AI for extraction`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiGenerateText = response.text() || "[]";

        const parsedEvents = JSON.parse(aiGenerateText.trim().replace(/^```json|```$/g, ''));

        if (!Array.isArray(parsedEvents)) {
            logger.warn("AI returned non-array JSON structure");
            return [];
        }

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
                emailUrl: originalEmail?.url || "",
                // You can add more mapping here if needed (e.g. emailDate)
            };
        });

    } catch (error) {
        logger.error("Error generating summary from Gemini", error);
        return [];
    }
}

async function dailyMailSummary(events: any[]): Promise<string> {
    try {

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!events || events.length === 0) {
            await DailySummary.findOneAndUpdate(
                { date: today },
                { summary: "No tasks scheduled for today. Enjoy your free day!" },
                { upsert: true, new: true }
            );
            return "No tasks scheduled for today. Enjoy your free day!";
        }

        const context = events.map(e =>
            `- ${e.title} (${e.priority} priority) at ${e.time || 'no time'}`
        ).join('\n');

        const prompt = `You are Iris, a personal schedule assistant. Summarise the user's day in ONE short casual sentence (20-30 words). Be friendly. Mention the most important task by name.\n\nToday's tasks:\n${context}`;

        logger.info("Generating daily AI briefing");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text()?.trim() || "Have a great day!";

        // Save to DB
        await DailySummary.findOneAndUpdate(
            { date: today },
            { summary },
            { upsert: true, new: true }
        );

        logger.info(`Daily briefing saved: ${summary}`);
        return summary;
    } catch (error) {
        logger.error("Error generating daily mail summary", error);
        return "Couldn't generate today's summary.";
    }
}

export { summarizeEmails, dailyMailSummary };