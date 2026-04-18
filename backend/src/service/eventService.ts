import { Event, IEvent } from "../model/eventsSchema";


async function saveEvents(events: any[]) {
    try {
        for (const event of events) {
            const existingEvent = await Event.findOne({ eventHash: event.eventHash });
            if (existingEvent) {
                if (existingEvent.eventStatus !== event.eventStatus) {
                    await updateEventStatus(event.eventHash, event.eventStatus);
                }
            } else {
                await Event.create(event);
            }
        }
    } catch (error) {
        console.error("Error saving events:", error);
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

export { saveEvents, updateEventStatus, updateEvent, deleteEvent, getAllUpcomingEvents, eventsByDate, pastEvents, allEvents, searchEvents };
