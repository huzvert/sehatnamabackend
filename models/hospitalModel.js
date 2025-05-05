const mongoose = require('mongoose');

const hospitalSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a hospital/lab name'],
      trim: true
    },
    type: {
      type: String,
      required: [true, 'Please specify the facility type'],
      enum: ['Hospital', 'Laboratory', 'Diagnostic Center', 'Specialty Clinic', 'Other'],
    },
    address: {
      type: String,
      required: [true, 'Please add an address']
    },
    phone: {
      type: String,
      required: [true, 'Please add a phone number']
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email'
      ]
    },
    services: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Hospital', hospitalSchema);