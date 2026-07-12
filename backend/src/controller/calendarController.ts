import { Request, Response } from 'express';
import { Event } from "../model/eventsSchema";
import { DailySummary } from '../model/dailySummary';
import { logger } from "../utils/logger";
import config from "../config";

function escapeIcsText(text: string): string {
    if (!text) return "";
    return text
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");
}

function foldIcsLine(line: string): string {
    const chars = Array.from(line);
    if (chars.length <= 70) return line;
    let result = "";
    for (let i = 0; i < chars.length; i += 70) {
        const chunk = chars.slice(i, i + 70).join("");
        if (i > 0) {
            result += "\r\n " + chunk;
        } else {
            result += chunk;
        }
    }
    return result;
}

function getIcsStartAndEnd(date: Date, timeStr: string): { start: string, end: string } {
    const d = new Date(date);
    const [hours, minutes] = (timeStr && timeStr !== "00:00" ? timeStr : "09:00").split(':').map(Number);

    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();

    const startMs = Date.UTC(year, month, day, hours, minutes, 0);
    const endMs = startMs + 60 * 60 * 1000; // Default duration of 1 hour

    const start = new Date(startMs);
    const end = new Date(endMs);

    const pad = (n: number) => n.toString().padStart(2, '0');

    const format = (dateObj: Date) => {
        const y = dateObj.getUTCFullYear();
        const m = pad(dateObj.getUTCMonth() + 1);
        const dayVal = pad(dateObj.getUTCDate());
        const h = pad(dateObj.getUTCHours());
        const min = pad(dateObj.getUTCMinutes());
        const s = pad(dateObj.getUTCSeconds());
        return `${y}${m}${dayVal}T${h}${min}${s}`;
    };

    return {
        start: format(start),
        end: format(end)
    };
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

        const appendLine = (line: string) => {
            icsContent += foldIcsLine(line) + "\r\n";
        };

        for (const event of events) {
            const { start, end } = getIcsStartAndEnd(event.date, event.time);

            appendLine("BEGIN:VEVENT");
            appendLine(`UID:${event.eventHash}@iris.app`);
            appendLine(`DTSTAMP:${nowStamp}`);
            appendLine(`DTSTART;TZID=Asia/Kolkata:${start}`);
            appendLine(`DTEND;TZID=Asia/Kolkata:${end}`);
            appendLine(`SUMMARY:${escapeIcsText(event.title)}`);
            appendLine(`DESCRIPTION:${escapeIcsText(`Priority: ${event.priority}\nSender: ${event.senderEmail}\n\n${event.description}`)}`);
            if (event.emailUrl) {
                appendLine(`URL:${event.emailUrl}`);
            }
            // 60 minute warning alert
            appendLine("BEGIN:VALARM");
            appendLine("ACTION:DISPLAY");
            appendLine(`DESCRIPTION:${escapeIcsText(event.title)}`);
            appendLine("TRIGGER:-PT60M");
            appendLine("END:VALARM");
            // 5 minute warning alert
            appendLine("BEGIN:VALARM");
            appendLine("ACTION:DISPLAY");
            appendLine(`DESCRIPTION:${escapeIcsText(event.title)}`);
            appendLine("TRIGGER:-PT5M");
            appendLine("END:VALARM");

            appendLine("END:VEVENT");
        }

        // Add today's Daily AI Briefing as an all-day event with an 8 AM alert
        const kolkataDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const targetDate = new Date(Date.UTC(kolkataDate.getFullYear(), kolkataDate.getMonth(), kolkataDate.getDate()));
        const dailySummary = await DailySummary.findOne({ date: targetDate });

        if (dailySummary) {
            const pad = (n: number) => n.toString().padStart(2, '0');
            const year = targetDate.getUTCFullYear();
            const month = pad(targetDate.getUTCMonth() + 1);
            const day = pad(targetDate.getUTCDate());
            const dateStr = `${year}${month}${day}`;

            appendLine("BEGIN:VEVENT");
            appendLine(`UID:daily-summary-${dateStr}@iris.app`);
            appendLine(`DTSTAMP:${nowStamp}`);
            // All day event format
            appendLine(`DTSTART;VALUE=DATE:${dateStr}`);
            appendLine(`SUMMARY:🤖 Iris Daily Briefing`);
            appendLine(`DESCRIPTION:${escapeIcsText(dailySummary.summary)}`);

            // 8:00 AM Trigger (8 hours after start of the day)
            appendLine("BEGIN:VALARM");
            appendLine("ACTION:DISPLAY");
            appendLine(`DESCRIPTION:Iris Daily Briefing`);
            appendLine(`TRIGGER:PT8H`);
            appendLine("END:VALARM");

            appendLine("END:VEVENT");
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
