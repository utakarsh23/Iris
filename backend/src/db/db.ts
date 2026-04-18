import mongoose from "mongoose";
import { logger } from "../utils/logger";


async function connectDB(uri: string) {
    try {
        if (!uri) {
            throw new Error("MongoDB URI is not provided");
        }
        await mongoose.connect(uri);
        logger.info("MongoDB connected securely");
    } catch (error) {
        logger.error("Error connecting to MongoDB", error);
        throw error;
    }
}

async function disconnectDB() {
    try {
        if (!mongoose.connection.readyState) {
            return;
        }
        await mongoose.disconnect();
        logger.info("MongoDB disconnected");
    } catch (error) {
        logger.error("Error disconnecting from MongoDB", error);
        throw error;
    }
}

export { connectDB, disconnectDB };