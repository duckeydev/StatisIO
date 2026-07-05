import mongoose from "mongoose";

const monitorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  uuid: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  type: { type: String, enum: ["http", "https", "tcp"], required: true },
  interval: { type: Number, default: 60000 },
  lastChecked: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

monitorSchema.pre("save", function () {
  this.updatedAt = new Date();
});

monitorSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Monitor", monitorSchema);