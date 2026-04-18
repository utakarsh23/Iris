import express from "express";
import config from "./config";
import { connectDB, disconnectDB } from "./db/db";
import eventRouter from "./api/eventRouter";
import { processEmails } from "./service/pipelineService";
import cron from "node-cron";

const app = express();
let server: any;

async function startServer() {
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    await connectDB(config.mongodb.uri);

    app.use("/event", eventRouter);

    server = app.listen(config.port, () => {
        console.log(`Server is running on port ${config.port}`);
    });
}

async function closeServer() {
    console.log("Shutting down gracefully...");

    if (server) {
        server.close(async () => {
            console.log("HTTP server closed.");
            await disconnectDB();
            console.log("Database disconnected. Process exiting...");
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
        console.error("Error starting server:", error);
        process.exit(1);
    }
}

async function startCron() {
    cron.schedule("* * * * *", async () => {
        console.log("Cron job started");
        await processEmails();
    });
}



process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);

init();
