import mongoose, { Document } from "mongoose";
import { generateEventHash } from "../service/hashingService";


interface IEvent extends Document {
    title: string; //title of the event(AI WEBINAR/DSA ASSIGNMENT SUBMISSION)
    description: string;
    eventType: "ASSIGNMENT" | "EVENT" | "INTERVIEW" | "EXAM" | "MEETING" | "WEBINAR" | "WORKSHOP" | "SUBMISSION" | "FORM" | "HACKATHON" | "OTHER";
    date: Date; //to be happening date
    time: string; //to be happening time
    eventStatus: "pending" | "missed" | "cancelled" | "completed" | "rescheduled";
    senderEmail: string; //email of sender
    priority: "ultra-high" | "high" | "medium" | "low";
    eventHash: string; //hash of the event to identify it in case of any update is recieved(title + eventType + senderEmail)
    isActive: boolean;
    emailUrl?: string; // Permalink back to the source Gmail thread
}

//we are using this schema to store events, senderEmail & title are used to identify the event in case of any update is recieved(eg : if event is scheduled for later we can match both and verify if the event is same and update it instead of creating a new one)

const eventSchema = new mongoose.Schema<IEvent>({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    eventType: {
        type: String,
        required: true,
        enum: ['ASSIGNMENT', 'EVENT', 'INTERVIEW', 'EXAM', 'MEETING', 'OTHER']
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    eventStatus: {
        type: String,
        required: true,
        default: 'pending',
        enum: ['pending', 'missed', 'cancelled', 'completed', 'rescheduled']
    },
    senderEmail: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        required: true,
        enum: ['ultra-high', 'high', 'medium', 'low']
    },
    eventHash: {
        type: String,
        required: true,
        unique: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    emailUrl: {
        type: String,
        required: false
    }
}, { timestamps: true })


const Event = mongoose.model<IEvent>("Event", eventSchema);

export { Event, IEvent };