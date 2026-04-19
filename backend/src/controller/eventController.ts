import { Event, IEvent } from "../model/eventsSchema";
import { updateEvent, deleteEvent, getAllUpcomingEvents, eventsByDate, pastEvents, allEvents, searchEvents } from "../service/eventService";
import { Request, Response } from 'express';
import { processWebhookEmails, triggerGoogleScript } from "../service/pipelineService";
import { dailyMailSummary } from "../service/aiService";
import { DailySummary } from "../model/dailySummary";
import { logger } from "../utils/logger";
import config from "../config";


async function changeEvent(req: Request, res: Response) {
    try {
        const { eventId } = req.params as { eventId: string };
        if (!eventId) {
            return res.status(400).json({ message: "Event ID is required" });
        }
        const event = req.body as IEvent;
        if (!event) {
            return res.status(400).json({ message: "Event is required" });
        }
        const updatedEvent = await updateEvent(eventId, event);
        logger.info(`Event updated successfully: ${eventId}`);
        return res.status(200).json({ message: "Event updated successfully", event: updatedEvent });
    } catch (error) {
        logger.error("Error updating event", error);
        return res.status(500).json({ message: "Error updating event" });
    }
}

async function removeEvent(req: Request, res: Response) {
    try {
        const { eventId } = req.params as { eventId: string };
        if (!eventId) {
            return res.status(400).json({ message: "Event ID is required" });
        }
        const updatedEvent = await deleteEvent(eventId);
        logger.info(`Event deleted successfully: ${eventId}`);
        return res.status(200).json({ message: "Event deleted successfully", event: updatedEvent });
    } catch (error) {
        logger.error("Error deleting event", error);
        return res.status(500).json({ message: "Error deleting event" });
    }
}

async function getUpcomingEvents(req: Request, res: Response) {
    try {
        const events = await getAllUpcomingEvents();
        return res.status(200).json({ message: "Events fetched successfully", events });
    } catch (error) {
        logger.error("Error fetching upcoming events", error);
        return res.status(500).json({ message: "Error fetching events" });
    }
}

async function getEventsByDate(req: Request, res: Response) {
    try {
        const { date } = req.params as { date: string };
        if (!date) {
            return res.status(400).json({ message: "Date is required" });
        }
        const events = await eventsByDate(date);
        return res.status(200).json({ message: "Events fetched successfully", events });
    } catch (error) {
        logger.error("Error fetching events by date", error);
        return res.status(500).json({ message: "Error fetching events" });
    }
}

async function getPastEvents(req: Request, res: Response) {
    try {
        let days = 5;
        if (req.params.days) {
            days = Number(req.params.days);
        }
        const events = await pastEvents(days);
        return res.status(200).json({ message: "Events fetched successfully", events });
    } catch (error) {
        logger.error("Error fetching past events", error);
        return res.status(500).json({ message: "Error fetching events" });
    }
}

async function getAllEvents(req: Request, res: Response) {
    try {
        const events = await allEvents();
        return res.status(200).json({ message: "Events fetched successfully", events });
    } catch (error) {
        logger.error("Error fetching all events", error);
        return res.status(500).json({ message: "Error fetching events" });
    }
}

async function loadNewEvents(req: Request, res: Response) {
    try {
        await triggerGoogleScript();
        return res.status(200).json({ message: "Trigger sent to Google Apps Script successfully" });
    } catch (error) {
        logger.error("Error triggering events via Google Script fetch", error);
        return res.status(500).json({ message: "Error triggering Google Script fetch" });
    }
}

async function loadNewEventsWebhook(req: Request, res: Response) {
    try {
        const emails = req.body;
        if (!Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ message: "Invalid email payload" });
        }

        const events = await processWebhookEmails(emails);
        logger.info("Webhook processed successfully");

        return res.status(200).json({ message: "Webhook events processed successfully", events });
    } catch (error) {
        logger.error("Error processing webhook", error);
        return res.status(500).json({ message: "Error processing webhook" });
    }
}

async function search(req: Request, res: Response) {
    try {
        const q = req.query.q as string;
        if (!q || q.trim().length === 0) {
            return res.status(400).json({ message: "Search query is required" });
        }
        const events = await searchEvents(q.trim()) as IEvent[];
        logger.info(`Conducted search for query: "${q.trim()}" | Found: ${events.length} results`);
        return res.status(200).json({ message: "Search results", events });
    } catch (error) {
        logger.error("Error searching events", error);
        return res.status(500).json({ message: "Error searching events" });
    }
}

async function getDailySummary(req: Request, res: Response) {
    try {

        // Check if we already have today's summary
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existing = await DailySummary.findOne({ date: today });

        if (existing) {
            return res.status(200).json({ summary: existing.summary });
        }

        // Generate a new one
        const events = await getAllUpcomingEvents() as IEvent[];
        const todaysEvents = events.filter((e: IEvent) => {
            const eDate = new Date(e.date).toISOString().split('T')[0];
            const tDate = new Date().toISOString().split('T')[0];
            return eDate === tDate;
        }) as IEvent[];

        const summary = await dailyMailSummary(todaysEvents);
        return res.status(200).json({ summary });
    } catch (error) {
        logger.error("Error getting daily summary", error);
        return res.status(500).json({ message: "Error getting daily summary" });
    }
}

export { changeEvent, removeEvent, getUpcomingEvents, getEventsByDate, getPastEvents, getAllEvents, loadNewEvents, loadNewEventsWebhook, search, getDailySummary };