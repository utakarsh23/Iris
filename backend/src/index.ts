import express from "express";
import config from "./config";
import { connectDB, disconnectDB } from "./db/db";
import eventRouter from "./api/eventRouter";
import { processEmails, triggerGoogleScript } from "./service/pipelineService";
import { markMissedEvents } from "./service/eventService";
import cron from "node-cron";
import { logger } from "./utils/logger";

const app = express();
let server: any;

async function startServer() {
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    await connectDB(config.mongodb.uri);

    app.use("/event", eventRouter);
    app.get("/health", (req, res) => {
        res.send("Iris Working Fine");
    });

    server = app.listen(config.port, () => {
        logger.info(`Server is running natively on port ${config.port}`);
    });
}

async function closeServer() {
    logger.info("Shutting down gracefully...");

    if (server) {
        server.close(async () => {
            logger.info("HTTP server closed.");
            await disconnectDB();
            logger.info("Database disconnected. Process exiting...");
            process.exit(0);
        });
    } else {
        await disconnectDB();
        process.exit(0);
    }
}

async function init() {
    try {
        await startServer();
        // Run immediately on boot to catch missed events if server was offline
        await markMissedEvents();
        await startCron();
    } catch (error) {
        logger.error("Error starting server", error);
        process.exit(1);
    }
}

async function startCron() {
    // Run every hour at the top of the hour (e.g. 1:00, 2:00, 3:00)
    cron.schedule("0 * * * *", async () => {
        logger.info("Cron: Running hourly cleanup of missed events");
        await markMissedEvents();
    });

    // Run twice a day at 1:00 AM and 1:00 PM to fetch new emails using the existing google script trigger function
    cron.schedule("0 1,13 * * *", async () => {
        logger.info("Cron: Running 1 AM / 1 PM email fetch via Google Apps Script");
        await triggerGoogleScript();
    });
}

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);

init();
