import express from "express";
import config from "./config";
import { connectDB, disconnectDB } from "./db/db";
import eventRouter from "./api/eventRouter";
import { processEmails } from "./service/pipelineService";
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
        // await startCron();
    } catch (error) {
        logger.error("Error starting server", error);
        process.exit(1);
    }
}

async function startCron() {
    cron.schedule("* * * * *", async () => {
        logger.info("Cron job triggered automatically");
        await processEmails();
    });
}



process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);

init();
