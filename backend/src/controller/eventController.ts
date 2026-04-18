import { Event, IEvent } from "../model/eventsSchema";
import { updateEvent, deleteEvent, getAllUpcomingEvents, eventsByDate, pastEvents, allEvents, searchEvents } from "../service/eventService";
import { Request, Response } from 'express';
import { processEmails, processWebhookEmails } from "../service/pipelineService";
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
        return res.status(200).json({ message: "Event updated successfully", event: updatedEvent });
    } catch (error) {
        console.error("Error updating event:", error);
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
        return res.status(200).json({ message: "Event deleted successfully", event: updatedEvent });
    } catch (error) {
        console.error("Error deleting event:", error);
        return res.status(500).json({ message: "Error deleting event" });
    }
}

async function getUpcomingEvents(req: Request, res: Response) {
    try {
        const events = await getAllUpcomingEvents();
        return res.status(200).json({ message: "Events fetched successfully", events });
    } catch (error) {
        console.error("Error fetching events:", error);
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
        console.error("Error fetching events:", error);
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
        console.error("Error fetching events:", error);
        return res.status(500).json({ message: "Error fetching events" });
    }
}

async function getAllEvents(req: Request, res: Response) {
    try {
        const events = await allEvents();
        return res.status(200).json({ message: "Events fetched successfully", events });
    } catch (error) {
        console.error("Error fetching events:", error);
        return res.status(500).json({ message: "Error fetching events" });
    }
}

async function loadNewEvents(req: Request, res: Response) {
    try {
        const googleScriptUrl = config.googleScriptUrl;
        if (!googleScriptUrl) {
            return res.status(500).json({ message: "GOOGLE_SCRIPT_URL not configured in .env" });
        }

        // This pings the Google Script, which will then fetch emails and webhook back to us
        await fetch(googleScriptUrl, { method: 'GET' });

        return res.status(200).json({ message: "Trigger sent to Google Apps Script successfully" });
    } catch (error) {
        console.error("Error triggering events:", error);
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

        return res.status(200).json({ message: "Webhook events processed successfully", events });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return res.status(500).json({ message: "Error processing webhook" });
    }
}

async function search(req: Request, res: Response) {
    try {
        const q = req.query.q as string;
        if (!q || q.trim().length === 0) {
            return res.status(400).json({ message: "Search query is required" });
        }
        const events = await searchEvents(q.trim());
        return res.status(200).json({ message: "Search results", events });
    } catch (error) {
        console.error("Error searching events:", error);
        return res.status(500).json({ message: "Error searching events" });
    }
}

export { changeEvent, removeEvent, getUpcomingEvents, getEventsByDate, getPastEvents, getAllEvents, loadNewEvents, loadNewEventsWebhook, search };