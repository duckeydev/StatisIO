import mongoose, { Schema } from 'mongoose';

const statusPageSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  
  groups: [{
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    
    services: [{
      name: { type: String, required: true },
      monitorId: { type: String, required: true },
      status: { type: String, enum: ['operational', 'degraded', 'partial_outage', 'major_outage'], default: 'operational' },
      description: String,
      order: { type: Number, default: 0 }
    }]
  }],

  activeIncidents: [{
    title: { type: String, required: true },
    description: String,
    severity: { type: String, enum: ['info', 'warning', 'critical'] },
    affectedServices: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
  }],

  settings: {
    theme: { type: String, default: 'light' },
    isPublic: { type: Boolean, default: true },
    customDomain: String
  }
});

export default mongoose.model('StatusPage', statusPageSchema);