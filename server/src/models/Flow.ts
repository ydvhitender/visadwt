import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFlowButton {
  id: string;
  title: string;
  response?: {
    text?: string;
    headerText?: string;
    footerText?: string;
    buttons?: IFlowButton[];
  };
}

export interface IFlow extends Document {
  name: string;
  enabled: boolean;
  triggers: string[]; // keywords that match (case-insensitive, exact or contains)
  matchType: 'exact' | 'contains' | 'starts_with';
  message: {
    text: string;
    headerText?: string;
    footerText?: string;
  };
  buttons: IFlowButton[];
  priority: number; // higher priority = checked first
  createdBy: Types.ObjectId; // flows are user-specific
  createdAt: Date;
  updatedAt: Date;
}

const FlowButtonSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    response: {
      text: String,
      headerText: String,
      footerText: String,
      buttons: [Schema.Types.Mixed],
    },
  },
  { _id: false }
);

const FlowSchema = new Schema<IFlow>(
  {
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    triggers: [{ type: String }],
    matchType: { type: String, enum: ['exact', 'contains', 'starts_with'], default: 'contains' },
    message: {
      text: { type: String, required: true },
      headerText: String,
      footerText: String,
    },
    buttons: [FlowButtonSchema],
    priority: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

FlowSchema.index({ createdBy: 1, enabled: 1, priority: -1 });

export const Flow = mongoose.model<IFlow>('Flow', FlowSchema);
