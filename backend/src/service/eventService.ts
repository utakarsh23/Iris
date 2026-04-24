import { Event, IEvent } from "../model/eventsSchema";
import { logger } from "../utils/logger";


// ─── Fuzzy Matching Utilities ─────────────────────────────────────────

/**
 * Generate character bigrams from a string for similarity comparison.
 * e.g. "hello" → ["he", "el", "ll", "lo"]
 */
function getBigrams(str: string): Set<string> {
    const s = str.toLowerCase().trim();
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
        bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
}

/**
 * Dice coefficient similarity between two strings using bigrams.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
function bigramSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    const aNorm = a.toLowerCase().trim();
    const bNorm = b.toLowerCase().trim();
    if (aNorm === bNorm) return 1;

    const bigramsA = getBigrams(aNorm);
    const bigramsB = getBigrams(bNorm);
    if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

    let intersectionCount = 0;
    for (const bg of bigramsA) {
        if (bigramsB.has(bg)) intersectionCount++;
    }

    return (2 * intersectionCount) / (bigramsA.size + bigramsB.size);
}

/**
 * Extract the core name from a formatted title "EventType:Core Event Name"
 * Falls back to full title if no colon is present.
 */
function extractTitleCore(title: string): string {
    const colonIndex = title.indexOf(':');
    return colonIndex !== -1 ? title.substring(colonIndex + 1).trim() : title.trim();
}

const SIMILARITY_THRESHOLD = 0.6;
const DATE_WINDOW_DAYS = 14;

/**
 * Find an existing event that fuzzy-matches the incoming event.
 * Matches on: same eventType + same senderEmail + similar title prefix + date within window.
 */
async function findFuzzyMatch(incomingEvent: any): Promise<IEvent | null> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Look at all active events from the same sender with the same type (past 7 days + future)
    const lookbackDate = new Date(startOfToday);
    lookbackDate.setDate(lookbackDate.getDate() - 7);

    const candidates = await Event.find({
        isActive: true,
        eventType: incomingEvent.eventType,
        senderEmail: incomingEvent.senderEmail,
        date: { $gte: lookbackDate }
    });

    if (candidates.length === 0) return null;

    const incomingCore = extractTitleCore(incomingEvent.title);
    const incomingDate = new Date(incomingEvent.date);

    let bestMatch: IEvent | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
        const candidateCore = extractTitleCore(candidate.title);
        const score = bigramSimilarity(incomingCore, candidateCore);

        // Check date is within the window
        const candidateDate = new Date(candidate.date);
        const daysDiff = Math.abs((incomingDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24));

        if (score >= SIMILARITY_THRESHOLD && daysDiff <= DATE_WINDOW_DAYS && score > bestScore) {
            bestMatch = candidate;
            bestScore = score;
        }
    }

    if (bestMatch) {
        logger.info(`Fuzzy match found: "${incomingEvent.title}" ↔ "${bestMatch.title}" (score: ${bestScore.toFixed(2)})`);
    }

    return bestMatch;
}


// ─── Core Save Logic ──────────────────────────────────────────────────

async function saveEvents(events: any[]) {
    for (const event of events) {
        try {
            // 1. Exact hash match (existing behavior)
            const exactMatch = await Event.findOne({ eventHash: event.eventHash });
            if (exactMatch) {
                if (exactMatch.eventStatus !== event.eventStatus) {
                    await updateEventStatus(event.eventHash, event.eventStatus);
                    logger.info(`Updated status for exact match: "${event.title}"`);
                }
                continue;
            }

            // 2. Fuzzy match — check for similar existing events
            const fuzzyMatch = await findFuzzyMatch(event);
            if (fuzzyMatch) {
                const incomingDate = new Date(event.date);
                const existingDate = new Date(fuzzyMatch.date);

                if (incomingDate > existingDate) {
                    // Incoming event has a later date → reschedule the existing one
                    fuzzyMatch.date = incomingDate;
                    fuzzyMatch.time = event.time;
                    fuzzyMatch.eventStatus = 'rescheduled' as IEvent['eventStatus'];
                    fuzzyMatch.description = event.description;
                    await fuzzyMatch.save();
                    logger.info(`Rescheduled existing event: "${fuzzyMatch.title}" → new date: ${event.date}`);
                } else if (event.eventStatus === 'cancelled') {
                    // Cancellation notice
                    fuzzyMatch.eventStatus = 'cancelled' as IEvent['eventStatus'];
                    await fuzzyMatch.save();
                    logger.info(`Cancelled existing event: "${fuzzyMatch.title}"`);
                } else {
                    // Same or earlier date → duplicate reminder, skip
                    logger.info(`Skipped duplicate (fuzzy): "${event.title}" already exists as "${fuzzyMatch.title}"`);
                }
                continue;
            }

            // 3. No match at all → create new event
            await Event.create(event);
            logger.info(`Created new event: "${event.title}"`);

        } catch (error) {
            logger.error(`Error saving event "${event.title}"`, error);
        }
    }
}


async function updateEventStatus(eventHash: string, status: string) {
    try {
        const event = await Event.findOne({ eventHash });
        if (!event || event.isActive === false) {
            throw new Error("Event not found");
        }
        event.eventStatus = status as IEvent['eventStatus'];
        await event.save();
    } catch (error) {
        console.error("Error updating event status:", error);
    }
}


async function updateEvent(eventId: string, updatedEvent: IEvent) {
    try {
        const event = await Event.findById(eventId);
        if (!event || event.isActive === false) {
            throw new Error("Event not found");
        }
        event.title = updatedEvent.title ? updatedEvent.title : event.title;
        event.description = updatedEvent.description ? updatedEvent.description : event.description;
        event.eventType = updatedEvent.eventType ? updatedEvent.eventType : event.eventType;
        event.eventStatus = updatedEvent.eventStatus ? updatedEvent.eventStatus : event.eventStatus;
        event.priority = updatedEvent.priority ? updatedEvent.priority : event.priority;
        await event.save();
    } catch (error) {
        console.error("Error changing event status:", error);
    }
}


async function deleteEvent(eventId: string) {
    try {
        const event = await Event.findById(eventId);
        if (!event || event.isActive === false) {
            throw new Error("Event not found");
        }
        event.isActive = false;
        await event.save();
    } catch (error) {
        console.error("Error deleting event:", error);
    }
}

async function getAllUpcomingEvents() {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const events = await Event.find({ isActive: true, date: { $gte: startOfToday } }).sort({ date: 1 });
        return events;
    } catch (error) {
        console.error("Error fetching events:", error);
    }
}

async function eventsByDate(date: string) {
    try {
        const events = await Event.find({ isActive: true, date: new Date(date) }).sort({ date: 1 });
        return events;
    } catch (error) {
        console.error("Error fetching events by date:", error);
    }
}

async function pastEvents(days: number) {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfPast = new Date(startOfToday);
        startOfPast.setDate(startOfToday.getDate() - days);
        const events = await Event.find({ isActive: true, date: { $gte: startOfPast, $lt: startOfToday } }).sort({ date: 1 });
        return events;
    } catch (error) {
        console.error("Error fetching events:", error);
    }
}

async function allEvents() {
    try {
        const upcoming = await getAllUpcomingEvents();
        const past = await pastEvents(7);
        return { upcoming, past };
    } catch (error) {
        console.error("Error fetching events:", error);
    }
}


async function searchEvents(query: string) {
    try {
        const regex = new RegExp(query, 'i');
        const events = await Event.find({
            isActive: true,
            $or: [
                { title: regex },
                { description: regex },
                { eventType: regex },
                { eventStatus: regex },
                { priority: regex },
                { senderEmail: regex }
            ]
        }).sort({ date: 1 });
        return events;
    } catch (error) {
        console.error("Error searching events:", error);
    }
}

async function markMissedEvents() {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const result = await Event.updateMany(
            { isActive: true, eventStatus: 'pending', date: { $lt: startOfToday } },
            { $set: { eventStatus: 'missed' } }
        );

        if (result.modifiedCount > 0) {
            console.log(`Automatically marked ${result.modifiedCount} past events as missed.`);
        }
    } catch (error) {
        console.error("Error marking missed events:", error);
    }
}

export { saveEvents, updateEventStatus, updateEvent, deleteEvent, getAllUpcomingEvents, eventsByDate, pastEvents, allEvents, searchEvents, markMissedEvents };
