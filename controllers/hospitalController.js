const asyncHandler = require('express-async-handler');
const Hospital = require('../models/hospitalModel');

// @desc    Get all hospitals
// @route   GET /api/hospitals
// @access  Public
const getHospitals = asyncHandler(async (req, res) => {
  const hospitals = await Hospital.find({}).sort({ createdAt: -1 });
  res.status(200).json(hospitals);
});

// @desc    Get single hospital
// @route   GET /api/hospitals/:id
// @access  Public
const getHospital = asyncHandler(async (req, res) => {
  const hospital = await Hospital.findById(req.params.id);
  
  if (!hospital) {
    res.status(404);
    throw new Error('Hospital not found');
  }
  
  res.status(200).json(hospital);
});

// @desc    Create new hospital
// @route   POST /api/hospitals
// @access  Public
const createHospital = asyncHandler(async (req, res) => {
  const { name, type, address, phone, email, services, status } = req.body;
  
  // Basic validation
  if (!name || !type || !address || !phone || !email) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }
  
  // Create hospital
  const hospital = await Hospital.create({
    name,
    type,
    address,
    phone,
    email,
    services: services || [],
    status: status || 'Active'
  });
  
  if (hospital) {
    res.status(201).json(hospital);
  } else {
    res.status(400);
    throw new Error('Invalid hospital data');
  }
});

// @desc    Update hospital
// @route   PUT /api/hospitals/:id
// @access  Public
const updateHospital = asyncHandler(async (req, res) => {
  const hospital = await Hospital.findById(req.params.id);
  
  if (!hospital) {
    res.status(404);
    throw new Error('Hospital not found');
  }
  
  const updatedHospital = await Hospital.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  
  res.status(200).json(updatedHospital);
});

// @desc    Delete hospital
// @route   DELETE /api/hospitals/:id
// @access  Public
const deleteHospital = asyncHandler(async (req, res) => {
  const hospital = await Hospital.findById(req.params.id);
  
  if (!hospital) {
    res.status(404);
    throw new Error('Hospital not found');
  }
  
  await Hospital.findByIdAndDelete(req.params.id);
  
  res.status(200).json({ id: req.params.id });
});

module.exports = {
  getHospitals,
  getHospital,
  createHospital,
  updateHospital,
  deleteHospital
};