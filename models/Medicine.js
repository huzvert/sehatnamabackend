// models/Medicine.js
const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    manufacturer: {
      type: String,
      default: '',
    },
    sideEffects: [{
      type: String,
    }],
    precautions: [{
      type: String,
    }],
  },
  {
    timestamps: true,
  }
);

const Medicine = mongoose.model('Medicine', medicineSchema);

module.exports = Medicine;