const mongoose = require('mongoose');

const mediaItemSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalname: { type: String, required: true },
  path: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const vehicleInspectionSchema = new mongoose.Schema({
  inspectionId: { type: String, required: true, unique: true },
  vehicleModel: { type: String, required: true },
  customerName: { type: String, default: '' },
  handoverTimestamp: { type: Date, required: true },
  returnTimestamp: { type: Date, default: null },
  beforeMedia: { type: [mediaItemSchema], default: [] },
  afterMedia: { type: [mediaItemSchema], default: [] },
  comparisonStatus: {
    type: String,
    enum: ['not_compared', 'in_progress', 'completed', 'failed'],
    default: 'not_compared'
  },
  returnStatus: {
    type: String,
    enum: ['awaiting_return', 'returned'],
    default: 'awaiting_return'
  },
  damageReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DamageReport',
    default: null
  }
}, { timestamps: true });

// Prevent handoverTimestamp from being changed after creation
vehicleInspectionSchema.pre('save', function (next) {
  if (!this.isNew && this.isModified('handoverTimestamp')) {
    const err = new Error('handoverTimestamp is immutable and cannot be changed after creation.');
    err.status = 400;
    return next(err);
  }
  next();
});

module.exports = mongoose.model('VehicleInspection', vehicleInspectionSchema);
