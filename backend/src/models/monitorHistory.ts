import mongoose from 'mongoose';

const monitorHistorySchema = new mongoose.Schema({
  uuid: { 
    type: String, 
    required: true, 
    index: true
  },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['up', 'down'], required: true },
  responseTime: { type: Number },
  statusCode: { type: Number },
  errorMessage: { type: String }
});

monitorHistorySchema.index({ uuid: 1, timestamp: -1 });

export default mongoose.model('History', monitorHistorySchema);