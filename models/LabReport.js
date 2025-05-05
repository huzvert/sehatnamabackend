const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  test: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    default: ''
  },
  normalRange: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Normal', 'Abnormal', 'Critical'],
    default: 'Normal'
  }
});

const labReportSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      required: true
    },
    lab: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
      default: 'Pending'
    },
    results: [resultSchema],
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Add virtual field for id
labReportSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

const LabReport = mongoose.model('LabReport', labReportSchema);

module.exports = LabReport;