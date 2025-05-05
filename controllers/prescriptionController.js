// controllers/prescriptionController.js

const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const User = require('../models/User');

// @desc    Create a new prescription
// @route   POST /api/prescriptions
// @access  Private/Doctor
const createPrescription = async (req, res) => {
  try {
    const { patientId, medications, notes, date } = req.body;
    const doctorId = req.user._id;

    // Find the patient by patientId
    const patient = await Patient.findOne({ patientId }).populate('user');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Create prescription
    const prescription = await Prescription.create({
      patient: patient._id,
      doctor: doctorId,
      date: date ? new Date(date) : new Date(),
      medications,
      notes: notes || '',
      status: 'Active',
    });

    // Populate the prescription for response
    const populatedPrescription = await Prescription.findById(prescription._id).populate([
      { path: 'patient', populate: { path: 'user', select: 'firstName lastName' } },
      { path: 'doctor', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      id: populatedPrescription._id,
      patientId: patient.patientId,
      patientName: `${patient.user.firstName} ${patient.user.lastName}`,
      date: populatedPrescription.date,
      medications: populatedPrescription.medications,
      status: populatedPrescription.status,
      notes: populatedPrescription.notes,
      doctor: `Dr. ${populatedPrescription.doctor.firstName} ${populatedPrescription.doctor.lastName}`
    });
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update prescription status
// @route   PUT /api/prescriptions/:id
// @access  Private/Doctor
const updatePrescription = async (req, res) => {
  try {
    const { status, notes, medications } = req.body;
    const prescriptionId = req.params.id;

    // Find prescription
    const prescription = await Prescription.findById(prescriptionId);

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check if user is the doctor of this prescription or admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== prescription.doctor.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update fields
    if (status) prescription.status = status;
    if (notes) prescription.notes = notes;
    if (medications) prescription.medications = medications;

    const updatedPrescription = await prescription.save();

    res.json({
      id: updatedPrescription._id,
      status: updatedPrescription.status,
      notes: updatedPrescription.notes,
      medications: updatedPrescription.medications,
    });
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get prescription by ID
// @route   GET /api/prescriptions/:id
// @access  Private
const getPrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' },
      })
      .populate('doctor', 'firstName lastName');

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check if user has permission
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';
    const isPatient = req.user.role === 'patient' && 
                      req.user.patientId === prescription.patient.patientId;

    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Format response
    const response = {
      id: prescription._id,
      patientName: `${prescription.patient.user.firstName} ${prescription.patient.user.lastName}`,
      patientId: prescription.patient.patientId,
      doctor: `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
      date: prescription.date,
      medications: prescription.medications,
      notes: prescription.notes,
      status: prescription.status,
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting prescription:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all prescriptions
// @route   GET /api/prescriptions
// @access  Private (Doctor/Admin can see all, Patients can see only their own)
const getAllPrescriptions = async (req, res) => {
  try {
    let query = {};
    
    // If user is a patient, only show their prescriptions
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ user: req.user._id });
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }
      query = { patient: patient._id };
    }

    const prescriptions = await Prescription.find(query)
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' },
      })
      .populate('doctor', 'firstName lastName')
      .sort({ createdAt: -1 });

    const formattedPrescriptions = prescriptions.map(prescription => ({
      id: prescription._id,
      patientName: `${prescription.patient.user.firstName} ${prescription.patient.user.lastName}`,
      patientId: prescription.patient.patientId,
      doctor: `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
      date: prescription.date,
      medications: prescription.medications,
      notes: prescription.notes,
      status: prescription.status,
    }));

    res.json(formattedPrescriptions);
  } catch (error) {
    console.error('Error getting all prescriptions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// controllers/prescriptionController.js (add these functions)

// @desc    Delete prescription
// @route   DELETE /api/prescriptions/:id
// @access  Private/Doctor/Admin
const deletePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check if user is the doctor of this prescription or admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== prescription.doctor.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prescription.deleteOne();

    res.json({ message: 'Prescription deleted successfully' });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Download prescription as PDF
// @route   GET /api/prescriptions/:id/pdf
// @access  Private
const downloadPrescriptionPDF = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' },
      })
      .populate('doctor', 'firstName lastName');

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check if user has permission
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';
    const isPatient = req.user.role === 'patient' && 
                      req.user.patientId === prescription.patient.patientId;

    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // For simplicity, we'll send JSON data instead of PDF
    // In production, you'd want to use a PDF library like PDFKit or pdfmake
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=prescription-${prescription._id}.json`);
    
    const pdfData = {
      id: prescription._id,
      patientName: `${prescription.patient.user.firstName} ${prescription.patient.user.lastName}`,
      patientId: prescription.patient.patientId,
      doctor: `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
      date: prescription.date,
      medications: prescription.medications,
      notes: prescription.notes,
      status: prescription.status,
    };

    res.json(pdfData);
  } catch (error) {
    console.error('Error downloading prescription:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createPrescription,
  updatePrescription,
  getPrescription,
  getAllPrescriptions,
  deletePrescription, // Add this
  downloadPrescriptionPDF, // Add this
};