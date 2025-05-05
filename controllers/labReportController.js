const LabReport = require('../models/LabReport');
const Patient = require('../models/Patient');
const User = require('../models/User');

// @desc    Get all lab reports with filtering
// @route   GET /api/lab-reports
// @access  Private
const getAllLabReports = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    let query = {};
    
    // If user is a patient, only show their reports
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ user: req.user._id });
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }
      query.patient = patient._id;
    }
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Search functionality
    if (search) {
      const patients = await Patient.find({
        '$or': [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').lean();
      
      query.$or = [
        { type: { $regex: search, $options: 'i' } },
        { lab: { $regex: search, $options: 'i' } },
        { patient: { $in: patients.map(p => p._id) } }
      ];
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const labReports = await LabReport.find(query)
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' },
      })
      .populate('requestedBy', 'firstName lastName')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await LabReport.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));
    
    const formattedReports = labReports.map(report => ({
      id: report.id,
      patientId: report.patient?.patientId,
      patientName: report.patient?.user 
        ? `${report.patient.user.firstName} ${report.patient.user.lastName}`
        : 'Unknown Patient',
      testType: report.type,
      date: report.date,
      lab: report.lab,
      requestedBy: report.requestedBy 
        ? `Dr. ${report.requestedBy.firstName} ${report.requestedBy.lastName}`
        : 'Unknown Doctor',
      status: report.status,
      results: report.results,
      notes: report.notes,
    }));
    
    res.json({
      reports: formattedReports,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages
    });
  } catch (error) {
    console.error('Error getting lab reports:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get lab report by ID
// @route   GET /api/lab-reports/:id
// @access  Private
const getLabReport = async (req, res) => {
  try {
    const labReport = await LabReport.findById(req.params.id)
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' },
      })
      .populate('requestedBy', 'firstName lastName');
    
    if (!labReport) {
      return res.status(404).json({ message: 'Lab report not found' });
    }
    
    // Check if user has permission
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';
    const isPatient = req.user.role === 'patient' && 
                      req.user._id.toString() === labReport.patient.user._id.toString();
    
    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const formattedReport = {
      id: labReport.id,
      patientId: labReport.patient?.patientId,
      patientName: labReport.patient?.user 
        ? `${labReport.patient.user.firstName} ${labReport.patient.user.lastName}`
        : 'Unknown Patient',
      testType: labReport.type,
      date: labReport.date,
      lab: labReport.lab,
      requestedBy: labReport.requestedBy 
        ? `Dr. ${labReport.requestedBy.firstName} ${labReport.requestedBy.lastName}`
        : 'Unknown Doctor',
      status: labReport.status,
      results: labReport.results,
      notes: labReport.notes,
    };
    
    res.json(formattedReport);
  } catch (error) {
    console.error('Error getting lab report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new lab report
// @route   POST /api/lab-reports
// @access  Private/Doctor
const createLabReport = async (req, res) => {
  try {
    const { patientId, type, lab, date, results, notes } = req.body;
    
    // Find the patient by patientId
    const patient = await Patient.findOne({ patientId });
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Create lab report
    const labReport = await LabReport.create({
      patient: patient._id,
      requestedBy: req.user._id,
      type,
      lab,
      date: date ? new Date(date) : new Date(),
      results: results || [],
      notes: notes || '',
      status: 'Pending',
    });
    
    // Populate the lab report for response
    const populatedReport = await LabReport.findById(labReport._id)
      .populate([
        { path: 'patient', populate: { path: 'user', select: 'firstName lastName' } },
        { path: 'requestedBy', select: 'firstName lastName' }
      ]);
    
    res.status(201).json({
      id: populatedReport.id,
      patientId: patient.patientId,
      patientName: `${patient.user.firstName} ${patient.user.lastName}`,
      message: 'Lab report created successfully',
    });
  } catch (error) {
    console.error('Error creating lab report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update lab report
// @route   PUT /api/lab-reports/:id
// @access  Private/Doctor
const updateLabReport = async (req, res) => {
  try {
    const { status, results, notes, type, lab, date } = req.body;
    
    const labReport = await LabReport.findById(req.params.id);
    
    if (!labReport) {
      return res.status(404).json({ message: 'Lab report not found' });
    }
    
    // Check if user is the doctor who requested this report or admin
    const isReporter = req.user._id.toString() === labReport.requestedBy.toString();
    if (req.user.role !== 'admin' && !isReporter) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Update fields
    if (status) labReport.status = status;
    if (results) labReport.results = results;
    if (notes) labReport.notes = notes;
    if (type) labReport.type = type;
    if (lab) labReport.lab = lab;
    if (date) labReport.date = date;
    
    await labReport.save();
    
    // Populate the updated report
    const populatedReport = await LabReport.findById(labReport._id)
      .populate([
        { path: 'patient', populate: { path: 'user', select: 'firstName lastName' } },
        { path: 'requestedBy', select: 'firstName lastName' }
      ]);
    
    res.json(populatedReport);
  } catch (error) {
    console.error('Error updating lab report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete lab report
// @route   DELETE /api/lab-reports/:id
// @access  Private/Admin
const deleteLabReport = async (req, res) => {
  try {
    const labReport = await LabReport.findById(req.params.id);
    
    if (!labReport) {
      return res.status(404).json({ message: 'Lab report not found' });
    }
    
    await labReport.deleteOne();
    
    res.json({ message: 'Lab report deleted successfully' });
  } catch (error) {
    console.error('Error deleting lab report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Download lab report as PDF
// @route   GET /api/lab-reports/:id/download
// @access  Private
const downloadLabReport = async (req, res) => {
  try {
    const labReport = await LabReport.findById(req.params.id)
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' },
      })
      .populate('requestedBy', 'firstName lastName');
    
    if (!labReport) {
      return res.status(404).json({ message: 'Lab report not found' });
    }
    
    // Check if user has permission
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';
    const isPatient = req.user.role === 'patient' && 
                      req.user._id.toString() === labReport.patient.user._id.toString();
    
    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // For simplicity, we'll send JSON data instead of PDF
    // In production, you'd want to use a PDF library like PDFKit
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=lab-report-${labReport._id}.json`);
    
    const pdfData = {
      id: labReport.id,
      patientName: `${labReport.patient.user.firstName} ${labReport.patient.user.lastName}`,
      patientId: labReport.patient.patientId,
      testType: labReport.type,
      lab: labReport.lab,
      date: labReport.date,
      requestedBy: `Dr. ${labReport.requestedBy.firstName} ${labReport.requestedBy.lastName}`,
      status: labReport.status,
      results: labReport.results,
      notes: labReport.notes,
      generatedOn: new Date().toLocaleString()
    };
    
    res.json(pdfData);
  } catch (error) {
    console.error('Error downloading lab report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllLabReports,
  getLabReport,
  createLabReport,
  updateLabReport,
  deleteLabReport,
  downloadLabReport,
};