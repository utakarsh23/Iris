import mongoose from "mongoose";
import { Document } from "mongoose";


interface IDailySummary extends Document {
    date: Date;
    summary: string;
}

const dailySummarySchema = new mongoose.Schema<IDailySummary>({
    date: { type: Date, required: true, unique: true },
    summary: { type: String, required: true },
}, { timestamps: true });

const DailySummary = mongoose.model<IDailySummary>("DailySummary", dailySummarySchema);

export { DailySummary, IDailySummary };