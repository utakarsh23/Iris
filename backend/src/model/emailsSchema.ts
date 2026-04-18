import mongoose, { Document } from "mongoose";
import { generateEventHash } from "../service/hashingService";


interface IMail extends Document {
    mailHash: string;
    processed: boolean;
}

const mailSchema = new mongoose.Schema<IMail>({
    mailHash: {
        type: String,
        required: true
    },
    processed: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })


const Mail = mongoose.model<IMail>("Mail", mailSchema);

export { Mail, IMail };