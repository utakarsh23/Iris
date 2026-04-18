import mongoose from "mongoose";


async function connectDB(uri: string) {
    try {
        if (!uri) {
            throw new Error("MongoDB URI is not provided");
        }
        await mongoose.connect(uri);
        console.log("MongoDB connected");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
}

async function disconnectDB() {
    try {
        if (!mongoose.connection.readyState) {
            return;
        }
        await mongoose.disconnect();
        console.log("MongoDB disconnected");
    } catch (error) {
        console.error("Error disconnecting from MongoDB:", error);
        throw error;
    }
}

export { connectDB, disconnectDB };