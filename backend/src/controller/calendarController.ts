import { Request, Response } from 'express';
import { Event } from "../model/eventsSchema";
import { logger } from "../utils/logger";
import config from "../config";

function formatIcsDate(date: Date, timeStr: string): string {
    const d = new Date(date);
    const [hours, minutes] = (timeStr && timeStr !== "00:00" ? timeStr : "09:00").split(':');
    
    // We assume the time extracted is local to the user, but ICS defaults to UTC if 'Z' is appended. 
    // To make it show correctly in Apple Calendar, we'll format it dynamically.
    // If we just output it as a "floating" local time (no Z), it uses the user's current timezone!
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    
    return `${year}${month}${day}T${hours}${minutes}00`;
}

export const getCalendarFeed = async (req: Request, res: Response) => {
    try {
        const token = req.query.token;
        
        if (config.calendarToken && token !== config.calendarToken) {
            res.status(401).send("Unauthorized: Invalid Token");
            return;
        }

        const events = await Event.find({ isActive: true, eventStatus: { $in: ['pending', 'rescheduled'] } });
        
        let icsContent = "BEGIN:VCALENDAR\r\n";
        icsContent += "VERSION:2.0\r\n";
        icsContent += "PRODID:-//Iris//MailScheduler//EN\r\n";
        icsContent += "CALSCALE:GREGORIAN\r\n";
        icsContent += "METHOD:PUBLISH\r\n";
        icsContent += "X-WR-CALNAME:Iris Automated Schedule\r\n";
        icsContent += "X-WR-TIMEZONE:Asia/Kolkata\r\n";
        icsContent += "X-PUBLISHED-TTL:PT10M\r\n"; // Refresh every 10 mins

        const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        for (const event of events) {
            const dtstart = formatIcsDate(event.date, event.time);
            
            icsContent += "BEGIN:VEVENT\r\n";
            icsContent += `UID:${event.eventHash}@iris.app\r\n`;
            icsContent += `DTSTAMP:${nowStamp}\r\n`;
            icsContent += `DTSTART;TZID=Asia/Kolkata:${dtstart}\r\n`; 
            // Defaulting duration to 1 hour
            icsContent += `DTEND;TZID=Asia/Kolkata:${dtstart.substring(0, 9)}${parseInt(dtstart.substring(9,11))+1}${dtstart.substring(11)}\r\n`;
            icsContent += `SUMMARY:${event.title}\r\n`;
            icsContent += `DESCRIPTION:Priority: ${event.priority}\\nSender: ${event.senderEmail}\\n\\n${event.description}\r\n`;
            if (event.emailUrl) {
                icsContent += `URL:${event.emailUrl}\r\n`;
            }
            // 60 minute warning alert
            icsContent += "BEGIN:VALARM\r\n";
            icsContent += "ACTION:DISPLAY\r\n";
            icsContent += `DESCRIPTION:${event.title}\r\n`;
            icsContent += "TRIGGER:-PT60M\r\n";
            icsContent += "END:VALARM\r\n";
            // 5 minute warning alert
            icsContent += "BEGIN:VALARM\r\n";
            icsContent += "ACTION:DISPLAY\r\n";
            icsContent += `DESCRIPTION:${event.title}\r\n`;
            icsContent += "TRIGGER:-PT5M\r\n";
            icsContent += "END:VALARM\r\n";

            icsContent += "END:VEVENT\r\n";
        }

        icsContent += "END:VCALENDAR\r\n";

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="iris_calendar.ics"');
        res.send(icsContent);

    } catch (error) {
        logger.error("Error generating ICS feed", error);
        res.status(500).send("Error generating ICS feed");
    }
};
