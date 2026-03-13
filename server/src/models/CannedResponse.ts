import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICannedResponse extends Document {
  title: string;
  shortcut: string;
  body: string;
  category?: string;
  createdBy: Types.ObjectId;
  isGlobal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CannedResponseSchema = new Schema<ICannedResponse>(
  {
    title: { type: String, required: true },
    shortcut: { type: String, required: true, unique: true },
    body: { type: String, required: true },
    category: { type: String, default: 'General' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isGlobal: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CannedResponseSchema.index({ shortcut: 1 });

export const CannedResponse = mongoose.model<ICannedResponse>('CannedResponse', CannedResponseSchema);
