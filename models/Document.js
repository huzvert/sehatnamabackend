// models/Document.js
const mongoose = require('mongoose');

const documentSchema = mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['prescription', 'lab-report', 'doctor-note', 'other'],
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    fileType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    processed: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
    },
    url: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;