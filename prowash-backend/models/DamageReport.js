const mongoose = require('mongoose');

const damageItemSchema = new mongoose.Schema({
  damageType: { type: String },
  location: { type: String },
  severity: { type: String, enum: ['Low', 'Medium', 'High'] },
  confidenceScore: { type: Number, min: 0, max: 1 },
  description: { type: String }
}, { _id: false });

const annotatedImageSchema = new mongoose.Schema({
  originalFilename: { type: String },
  annotatedPath: { type: String },
  madScore: { type: Number }
}, { _id: false });

const damageReportSchema = new mongoose.Schema({
  inspectionId: { type: String, required: true },
  vehicleModel: { type: String },
  customerName: { type: String },
  handoverTimestamp: { type: Date },
  returnTimestamp: { type: Date },
  damageItems: { type: [damageItemSchema], default: [] },
  annotatedImages: { type: [annotatedImageSchema], default: [] },
  comparisonSummary: { type: String },
  noDamageDetected: { type: Boolean, default: false },
  warningMessage: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DamageReport', damageReportSchema);
