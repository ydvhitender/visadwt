import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITag extends Document {
  name: string;
  color: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, unique: true },
    color: { type: String, required: true, default: '#6366f1' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Tag = mongoose.model<ITag>('Tag', TagSchema);
