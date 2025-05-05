const Patient = require('../models/Patient');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const LabReport = require('../models/LabReport');
const Document = require('../models/Document');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage for document uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const patientFolder = path.join('uploads', 'documents', req.params.patientId);
    if (!fs.existsSync(patientFolder)) {
      fs.mkdirSync(patientFolder, { recursive: true });
    }
    cb(null, patientFolder);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Files only!');
    }
  }
}).single('document');

// @desc    Create patient profile for self-registration
// @route   POST /api/patients/profile
// @access  Private (Patient only)
const createPatientProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if patient profile already exists
    const existingPatient = await Patient.findOne({ user: userId });
    if (existingPatient) {
      return res.status(400).json({ message: 'Patient profile already exists' });
    }

    const {
      age,
      gender,
      bloodGroup,
      contact,
      address,
      emergencyContact,
      condition,
      allergies,
    } = req.body;

    // Generate patient ID
    const patientId = 'P-' + Math.floor(1000 + Math.random() * 9000);

    // Create patient
    const patient = await Patient.create({
      user: userId,
      patientId,
      age,
      gender,
      bloodGroup,
      contact,
      address: address || '',
      emergencyContact: emergencyContact || '',
      condition: condition || '',
      allergies: allergies || [],
    });

    // Update user with patientId
    const user = req.user;
    user.patientId = patientId;
    await user.save();

    res.status(201).json({
      id: patient.patientId,
      message: 'Patient profile created successfully',
    });
  } catch (error) {
    console.error('Error creating patient profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get recent patients
// @route   GET /api/patients/recent
// @access  Private/Doctor/Admin
// @desc    Get recent patients
// @route   GET /api/patients/recent
// @access  Private/Doctor/Admin
const getRecentPatients = async (req, res) => {
  try {
    // Find recent appointments for this doctor
    const recentAppointments = await Appointment.find({
      doctor: req.user._id,
    })
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' },
      })
      .sort({ date: -1 })
      .limit(20);

    // Extract unique patients - with null checks
    const patientMap = new Map();
    recentAppointments.forEach((appointment) => {
      // Check if appointment has a patient
      if (appointment.patient && appointment.patient._id) {
        const patientId = appointment.patient._id.toString();
        
        // Only add if not already in map
        if (!patientMap.has(patientId)) {
          // Safely get patient data
          const firstName = appointment.patient?.user?.firstName || '';
          const lastName = appointment.patient?.user?.lastName || '';
          const name = firstName && lastName 
            ? `${firstName} ${lastName}` 
            : appointment.patient?.user?.firstName || appointment.patient?.user?.lastName || 'Unknown Patient';
          
          patientMap.set(patientId, {
            id: appointment.patient.patientId || patientId,
            name: name,
            age: appointment.patient.age || '',
            condition: appointment.patient.condition || 'No condition specified',
            lastVisit: new Date(appointment.date).toLocaleDateString(),
          });
        }
      }
    });

    // Convert map to array and take the first 5 patients
    const recentPatients = Array.from(patientMap.values()).slice(0, 5);

    res.json(recentPatients);
  } catch (error) {
    console.error('Error getting recent patients:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private/Doctor/Admin
const getAllPatients = async (req, res) => {
  try {
    const patients = await Patient.find({})
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const formattedPatients = patients.map(patient => {
      // Check if patient.user exists before trying to access its properties
      const firstName = patient.user ? patient.user.firstName : '';
      const lastName = patient.user ? patient.user.lastName : '';
      const email = patient.user ? patient.user.email : '';
      
      return {
        id: patient.patientId,
        name: patient.user ? `${firstName} ${lastName}` : 'Unknown Patient',
        age: patient.age || '',
        gender: patient.gender || '',
        contact: patient.contact || '',
        email: email,
        condition: patient.condition || '',
        lastVisit: patient.lastVisit || 'No visits yet'
      };
    });

    res.json(formattedPatients);
  } catch (error) {
    console.error('Error getting all patients:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get patient by ID
// @route   GET /api/patients/:patientId
// @access  Private
const getPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Find patient
    const patient = await Patient.findOne({ patientId }).populate('user', 'firstName lastName email');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check if user has permission
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';
    const isPatient = req.user.role === 'patient' && 
                      req.user._id.toString() === patient.user._id.toString();

    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get patient data
    const appointments = await Appointment.find({ patient: patient._id })
      .populate('doctor', 'firstName lastName specialty')
      .sort({ date: -1 });

    const prescriptions = await Prescription.find({ patient: patient._id })
      .populate('doctor', 'firstName lastName specialty')
      .sort({ date: -1 });

    const labReports = await LabReport.find({ patient: patient._id })
      .populate('requestedBy', 'firstName lastName')
      .sort({ date: -1 });

    // Format response
    const formattedAppointments = appointments.map((appointment) => {
      return {
        id: appointment._id,
        date: appointment.date,
        time: appointment.time,
        doctor: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        purpose: appointment.purpose,
        status: appointment.status,
        notes: appointment.notes,
      };
    });

    const formattedPrescriptions = prescriptions.map((prescription) => {
      return {
        id: prescription._id,
        date: prescription.date,
        doctor: `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
        medications: prescription.medications,
        notes: prescription.notes,
        status: prescription.status,
      };
    });

    const formattedLabReports = labReports.map((report) => {
      return {
        id: report._id,
        date: report.date,
        type: report.type,
        lab: report.lab,
        requestedBy: `Dr. ${report.requestedBy.firstName} ${report.requestedBy.lastName}`,
        results: report.results,
        status: report.status,
        notes: report.notes,
      };
    });

    const response = {
      id: patient.patientId,
      firstName: patient.user.firstName,
      lastName: patient.user.lastName,
      name: `${patient.user.firstName} ${patient.user.lastName}`,
      age: patient.age,
      gender: patient.gender,
      bloodGroup: patient.bloodGroup,
      contact: patient.contact,
      email: patient.user.email,
      address: patient.address,
      emergencyContact: patient.emergencyContact,
      condition: patient.condition,
      allergies: patient.allergies,
      appointments: formattedAppointments,
      prescriptions: formattedPrescriptions,
      labReports: formattedLabReports,
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting patient:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new patient
// @route   POST /api/patients
// @access  Private/Doctor/Admin
const createPatient = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      age,
      gender,
      bloodGroup,
      contact,
      address,
      emergencyContact,
      condition,
      allergies,
    } = req.body;

    // Check if email already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'patient',
    });

    // Generate patient ID
    const patientId = 'P-' + Math.floor(1000 + Math.random() * 9000);

    // Create patient
    const patient = await Patient.create({
      user: user._id,
      patientId,
      age,
      gender,
      bloodGroup,
      contact,
      address,
      emergencyContact,
      condition: condition || '',
      allergies: allergies || [],
    });

    // Update user with patientId
    user.patientId = patientId;
    await user.save();

    res.status(201).json({
      id: patient.patientId,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      age: patient.age,
      gender: patient.gender,
      message: 'Patient created successfully',
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a patient
// @route   PUT /api/patients/:patientId
// @access  Private/Doctor/Admin/Self
const updatePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const {
      firstName,
      lastName,
      age,
      gender,
      bloodGroup,
      contact,
      email,
      address,
      emergencyContact,
      condition,
      allergies,
    } = req.body;

    // Find patient
    const patient = await Patient.findOne({ patientId }).populate('user');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check if user has permission
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';
    const isPatient = req.user.role === 'patient' && 
                      req.user._id.toString() === patient.user._id.toString();

    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update patient info
    if (age) patient.age = age;
    if (gender) patient.gender = gender;
    if (bloodGroup) patient.bloodGroup = bloodGroup;
    if (contact) patient.contact = contact;
    if (address) patient.address = address;
    if (emergencyContact) patient.emergencyContact = emergencyContact;
    if (condition) patient.condition = condition;
    if (allergies) patient.allergies = allergies;

    await patient.save();

    // Update user info if provided
    if (firstName || lastName || email) {
      const user = patient.user;
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (email) user.email = email;
      await user.save();
    }

    res.json({ 
      message: 'Patient updated successfully',
      patient: {
        id: patient.patientId,
        name: `${patient.user.firstName} ${patient.user.lastName}`,
        age: patient.age,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup
      }
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get patient history (timeline of all medical events)
// @route   GET /api/patients/:patientId/history
// @access  Private
const getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Find patient
    const patient = await Patient.findOne({ patientId }).populate('user', 'firstName lastName');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check permissions
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';
    const isPatient = req.user.role === 'patient' && 
                      patient.user._id.toString() === req.user._id.toString();

    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get all medical events
    const appointments = await Appointment.find({ patient: patient._id })
      .populate('doctor', 'firstName lastName specialty')
      .select('date time purpose status notes doctor');

    const prescriptions = await Prescription.find({ patient: patient._id })
      .populate('doctor', 'firstName lastName specialty')
      .select('date medications notes status doctor');

    const labReports = await LabReport.find({ patient: patient._id })
      .populate('requestedBy', 'firstName lastName')
      .select('date type lab results status notes requestedBy');

    // Get doctor notes
    const doctorNotes = await Document.find({ 
      patient: patient._id,
      type: 'doctor-note'
    })
    .populate('uploadedBy', 'firstName lastName role')
    .select('date title uploadedBy notes');

    // Format all events into a unified timeline
    const history = [
      ...appointments.map(apt => ({
        id: `HIST-APT-${apt._id}`,
        type: 'appointment',
        date: apt.date,
        time: apt.time || '09:00 AM', // Default if time not provided
        title: `${apt.purpose} Appointment`,
        doctor: `Dr. ${apt.doctor.firstName} ${apt.doctor.lastName}`,
        details: apt.notes || 'No notes provided',
        status: apt.status
      })),
      ...prescriptions.map(rx => ({
        id: `HIST-RX-${rx._id}`,
        type: 'prescription',
        date: rx.date,
        time: '09:30 AM', // Default time for prescriptions
        title: `Prescription Update`,
        doctor: `Dr. ${rx.doctor.firstName} ${rx.doctor.lastName}`,
        details: rx.medications.map(med => 
          `${med.name} (${med.dosage}) - ${med.frequency} for ${med.duration}`
        ).join('; '),
        status: rx.status
      })),
      ...labReports.map(report => ({
        id: `HIST-LAB-${report._id}`,
        type: 'lab',
        date: report.date,
        time: '11:00 AM', // Default time for lab reports
        title: report.type,
        doctor: `Dr. ${report.requestedBy.firstName} ${report.requestedBy.lastName}`,
        details: report.results.length > 0 
          ? report.results.map(r => `${r.test}: ${r.value} (${r.status})`).join('; ')
          : report.notes || 'No details provided',
        status: report.status
      })),
      ...doctorNotes.map(note => ({
        id: `HIST-NOTE-${note._id}`,
        type: 'note',
        date: note.date,
        time: '11:45 AM', // Default time for notes
        title: note.title || 'Doctor\'s Note',
        doctor: note.uploadedBy.role === 'doctor' 
          ? `Dr. ${note.uploadedBy.firstName} ${note.uploadedBy.lastName}`
          : note.uploadedBy.firstName,
        details: note.notes || 'No details provided',
        status: 'N/A'
      }))
    ];

    // Sort by date and time
    history.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateB - dateA; // Recent first
    });

    res.json({
      id: patient.patientId,
      name: `${patient.user.firstName} ${patient.user.lastName}`,
      history
    });
  } catch (error) {
    console.error('Error getting patient history:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get patient documents
// @route   GET /api/patients/:patientId/documents
// @access  Private
const getPatientDocuments = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Find patient
    const patient = await Patient.findOne({ patientId });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check permissions
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';
    const isPatient = req.user.role === 'patient' && 
                      patient.user.toString() === req.user._id.toString();

    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get documents
    const documents = await Document.find({ patient: patient._id })
      .populate('uploadedBy', 'firstName lastName role')
      .sort({ date: -1 });

    const formattedDocuments = documents.map(doc => ({
      id: doc._id,
      type: doc.type, // prescription, lab-report, doctor-note, other
      title: doc.title,
      date: doc.date,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      uploadedBy: doc.uploadedBy.role === 'doctor' 
        ? `Dr. ${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`
        : doc.uploadedBy.firstName,
      tags: doc.tags || [],
      processed: doc.processed || false,
      url: `/uploads/documents/${patientId}/${path.basename(doc.url)}`
    }));

    res.json(formattedDocuments);
  } catch (error) {
    console.error('Error getting patient documents:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Upload patient document
// @route   POST /api/patients/:patientId/documents
// @access  Private/Doctor/Admin
const uploadPatientDocument = async (req, res) => {
  upload(req, res, async function(err) {
    if (err) {
      return res.status(400).json({ message: err });
    }
    
    try {
      const { patientId } = req.params;
      const { title, type, tags, processed, notes } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: 'Please upload a file' });
      }
  
      // Find patient
      const patient = await Patient.findOne({ patientId });
  
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }
  
      // Create document entry
      const document = await Document.create({
        patient: patient._id,
        title: title || 'Untitled Document',
        type: type || 'other',
        date: new Date(),
        fileType: path.extname(req.file.originalname).substring(1),
        fileSize: `${(req.file.size / 1024).toFixed(2)} KB`,
        uploadedBy: req.user._id,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        processed: processed === 'true',
        notes: notes || '',
        url: req.file.path
      });
  
      res.status(201).json({
        message: 'Document uploaded successfully',
        document: {
          id: document._id,
          title: document.title,
          type: document.type,
          date: document.date,
          url: `/uploads/documents/${patientId}/${path.basename(req.file.path)}`
        }
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
};

// @desc    Delete patient document
// @route   DELETE /api/patients/:patientId/documents/:documentId
// @access  Private/Doctor/Admin
const deletePatientDocument = async (req, res) => {
  try {
    const { patientId, documentId } = req.params;

    // Find patient
    const patient = await Patient.findOne({ patientId });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Find document
    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if document belongs to this patient
    if (document.patient.toString() !== patient._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if user has permission
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';
    const isUploader = document.uploadedBy.toString() === req.user._id.toString();

    if (!isDoctor && !isAdmin && !isUploader) {
      return res.status(403).json({ message: 'Not authorized to delete this document' });
    }

    // Delete file from server
    if (fs.existsSync(document.url)) {
      fs.unlinkSync(document.url);
    }

    // Delete document from database
    await document.remove();

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Process uploaded document (OCR and data extraction)
// @route   PUT /api/patients/:patientId/documents/:documentId/process
// @access  Private/Doctor/Admin
const processPatientDocument = async (req, res) => {
  try {
    const { patientId, documentId } = req.params;
    
    // Find patient
    const patient = await Patient.findOne({ patientId });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Find document
    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if user has permission
    const isDoctor = req.user.role === 'doctor';
    const isAdmin = req.user.role === 'admin';

    if (!isDoctor && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Simulate document processing (OCR & data extraction)
    // In a real application, you would integrate with a document processing API
    
    // Update document as processed
    document.processed = true;
    
    // Here you would extract data and potentially create new records
    // (prescriptions, lab reports, etc.) based on the document content
    
    // For demonstration purposes, we'll simulate extracting data based on document type
    if (document.type === 'prescription') {
      // Simulate creating a prescription from document
      const newPrescription = await Prescription.create({
        patient: patient._id,
        doctor: req.user._id,
        date: new Date(),
        medications: [
          { 
            name: 'Extracted Medication', 
            dosage: '25mg', 
            frequency: 'Once daily', 
            duration: '30 days' 
          }
        ],
        notes: 'Prescription extracted from uploaded document',
        status: 'Active'
      });
      
      res.json({ 
        message: 'Document processed successfully',
        data: {
          document: {
            id: document._id,
            processed: true
          },
          prescription: {
            id: newPrescription._id,
            date: newPrescription.date
          }
        }
      });
    } else if (document.type === 'lab-report') {
      // Simulate creating a lab report from document
      const newLabReport = await LabReport.create({
        patient: patient._id,
        requestedBy: req.user._id,
        date: new Date(),
        type: 'Extracted Lab Report',
        lab: 'Document Processing System',
        results: [
          { 
            test: 'Extracted Test', 
            value: 'Normal Value', 
            normalRange: 'Normal Range', 
            status: 'Normal' 
          }
        ],
        status: 'Completed',
        notes: 'Lab report extracted from uploaded document'
      });
      
      await document.save();
      
      res.json({ 
        message: 'Document processed successfully',
        data: {
          document: {
            id: document._id,
            processed: true
          },
          labReport: {
            id: newLabReport._id,
            date: newLabReport.date
          }
        }
      });
    } else {
      // Just mark as processed for other document types
      await document.save();
      
      res.json({ 
        message: 'Document processed successfully',
        data: {
          document: {
            id: document._id,
            processed: true
          }
        }
      });
    }
  } catch (error) {
    console.error('Error processing document:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
// @desc    Delete a patient
// @route   DELETE /api/patients/:patientId
// @access  Private/Admin/Doctor
const deletePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    console.log('Received patientId for deletion:', patientId)

    // Find patient
    const patient = await Patient.findOne({ patientId }).populate('user');

    if (!patient) {
      console.log(`Patient not found with ID: ${patientId}`)
      return res.status(404).json({ message: 'Patient not found' });
    }

    console.log('Found patient:', patient.patientId)

    // Check if user has permission (admin or doctor)
    const isAdmin = req.user.role === 'admin';
    const isDoctor = req.user.role === 'doctor';

    if (!isAdmin && !isDoctor) {
      console.log(`User ${req.user.email} is not authorized to delete patients`)
      return res.status(403).json({ message: 'Not authorized - admin or doctor access required' });
    }

    console.log('User has permission to delete patient')

    // Delete associated documents (this needs to handle files on disk)
    const documents = await Document.find({ patient: patient._id });
    for (const doc of documents) {
      try {
        if (doc.url && fs.existsSync(doc.url)) {
          fs.unlinkSync(doc.url);
        }
      } catch (fileError) {
        console.error(`Error deleting file ${doc.url}:`, fileError);
        // Continue with deletion even if file deletion fails
      }
      await doc.deleteOne(); // Use deleteOne instead of remove
    }

    // Delete associated appointments
    await Appointment.deleteMany({ patient: patient._id });

    // Delete associated prescriptions
    await Prescription.deleteMany({ patient: patient._id });

    // Delete associated lab reports
    await LabReport.deleteMany({ patient: patient._id });

    // Delete the patient document
    await patient.deleteOne(); // Use deleteOne instead of remove

    // Delete the user account
    if (patient.user && patient.user._id) {
      await User.deleteOne({ _id: patient.user._id });
    }

    console.log('Successfully deleted patient and associated data')
    res.json({ message: 'Patient and all associated data deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getRecentPatients,
  getAllPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientHistory,
  getPatientDocuments,
  uploadPatientDocument,
  deletePatientDocument,
  processPatientDocument,
  createPatientProfile  // Add this new function
};