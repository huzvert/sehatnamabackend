const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const User = require('../models/User');

// @desc    Get all appointments with pagination
// @route   GET /api/appointments
// @access  Private/Admin
const getAllAppointments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const total = await Appointment.countDocuments();
    
    const appointments = await Appointment.find()
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .populate('doctor', 'firstName lastName specialty')
      .sort({ date: -1, time: 1 })
      .skip(skip)
      .limit(limit);
    
    const formattedAppointments = appointments.map(appointment => {
      return {
        id: appointment._id,
        patient: appointment.patient?._id,
        patientName: appointment.patient?.user 
          ? `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`
          : appointment.patientName || 'Unknown Patient',
        doctor: appointment.doctor?._id,
        doctorName: appointment.doctor 
          ? `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`
          : appointment.doctorName || 'Unknown Doctor',
        date: appointment.date,
        time: appointment.time,
        purpose: appointment.purpose,
        notes: appointment.notes || '',
        status: appointment.status,
        manualEntry: appointment.manualEntry || false
      };
    });
    
    res.json({
      appointments: formattedAppointments,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching all appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get today's appointments
// @route   GET /api/appointments/today
// @access  Private/Doctor
const getTodayAppointments = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const query = {
      date: {
        $gte: today,
        $lt: tomorrow
      }
    };
    
    if (req.user.role === 'doctor') {
      query.doctor = req.user._id;
    }
    
    const appointments = await Appointment.find(query)
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .populate('doctor', 'firstName lastName specialty')
      .sort({ time: 1 });
    
    const formattedAppointments = appointments.map(appointment => {
      return {
        id: appointment._id,
        patient: appointment.patient?._id,
        patientName: appointment.patient?.user 
          ? `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`
          : appointment.patientName || 'Unknown Patient',
        doctor: appointment.doctor?._id,
        doctorName: appointment.doctor 
          ? `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`
          : appointment.doctorName || 'Unknown Doctor',
        date: appointment.date,
        time: appointment.time,
        purpose: appointment.purpose,
        notes: appointment.notes || '',
        status: appointment.status,
        manualEntry: appointment.manualEntry || false
      };
    });
    
    res.json(formattedAppointments);
  } catch (error) {
    console.error('Error getting today\'s appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new appointment
// @route   POST /api/appointments
// @access  Private
const createAppointment = async (req, res) => {
  try {
    const { 
      patient, 
      patientName, 
      doctor, 
      doctorName, 
      date, 
      time, 
      purpose, 
      notes, 
      status,
      manualEntry 
    } = req.body;
    
    // Validate required fields
    if (!date || !time || !purpose) {
      return res.status(400).json({ message: 'Please provide date, time, and purpose' });
    }
    
    // Handle manual entry mode
    if (manualEntry === true) {
      if (!patientName) {
        return res.status(400).json({ message: 'Patient name is required for manual entry' });
      }
      
      const appointment = new Appointment({
        patient: "000000000000000000000000", // Placeholder ObjectId
        patientName: patientName,
        doctor: doctor || req.user._id,
        doctorName: doctorName || `Dr. ${req.user.firstName} ${req.user.lastName}`,
        date: new Date(date),
        time,
        purpose,
        notes: notes || '',
        status: status || 'Scheduled',
        manualEntry: true
      });
      
      await appointment.save();
      
      return res.status(201).json({
        id: appointment._id,
        patientName: patientName,
        doctorName: appointment.doctorName,
        date: appointment.date,
        time: appointment.time,
        purpose: appointment.purpose,
        status: appointment.status,
        message: 'Appointment created successfully'
      });
    } 
    
    // Standard mode
    if (!patient) {
      return res.status(400).json({ message: 'Patient is required' });
    }
    
    const patientDoc = await Patient.findOne({ patientId: patient });
    
    if (!patientDoc) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    const appointment = new Appointment({
      patient: patientDoc._id,
      doctor: doctor || req.user._id,
      date: new Date(date),
      time,
      purpose,
      notes: notes || '',
      status: status || 'Scheduled',
      manualEntry: false
    });
    
    await appointment.save();
    
    res.status(201).json({
      id: appointment._id,
      patientId: patient,
      date: appointment.date,
      time: appointment.time,
      purpose: appointment.purpose,
      status: appointment.status,
      message: 'Appointment created successfully'
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update appointment
// @route   PUT /api/appointments/:id
// @access  Private
const updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    const { 
      patient, 
      patientName, 
      doctor, 
      doctorName, 
      date, 
      time, 
      purpose, 
      notes, 
      status,
      manualEntry 
    } = req.body;
    
    // Update fields
    if (date) appointment.date = new Date(date);
    if (time) appointment.time = time;
    if (purpose) appointment.purpose = purpose;
    if (notes !== undefined) appointment.notes = notes;
    if (status) appointment.status = status;
    
    // Handle manual entry
    if (manualEntry) {
      appointment.patientName = patientName;
      appointment.doctorName = doctorName;
      appointment.manualEntry = true;
    } else {
      appointment.patientName = '';
      appointment.doctorName = '';
      appointment.manualEntry = false;
      
      if (patient) {
        const patientDoc = await Patient.findOne({ patientId: patient });
        if (patientDoc) {
          appointment.patient = patientDoc._id;
        }
      }
    }
    
    if (doctor && req.user.role === 'admin') {
      appointment.doctor = doctor;
    }
    
    await appointment.save();
    
    res.json(appointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get appointment by ID
// @route   GET /api/appointments/:id
// @access  Private
const getAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName email' }
      })
      .populate('doctor', 'firstName lastName specialty');
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    res.json(appointment);
  } catch (error) {
    console.error('Error getting appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get appointments for a specific patient
// @route   GET /api/patients/:patientId/appointments
// @access  Private
const getPatientAppointments = async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const patient = await Patient.findOne({ patientId });
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    const appointments = await Appointment.find({ patient: patient._id })
      .populate('doctor', 'firstName lastName specialty')
      .sort({ date: -1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error getting patient appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get appointments by date
// @route   GET /api/appointments/date/:date
// @access  Private
const getAppointmentsByDate = async (req, res) => {
  try {
    const dateString = req.params.date;
    
    const startDate = new Date(dateString);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(dateString);
    endDate.setHours(23, 59, 59, 999);
    
    const query = {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    if (req.user.role === 'doctor') {
      query.doctor = req.user._id;
    }
    
    const appointments = await Appointment.find(query)
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .populate('doctor', 'firstName lastName specialty')
      .sort({ time: 1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error getting appointments by date:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Search appointments
// @route   GET /api/appointments/search
// @access  Private
const searchAppointments = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const patients = await Patient.find()
      .populate({
        path: 'user',
        match: {
          $or: [
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } }
          ]
        }
      });
    
    const matchedPatients = patients.filter(patient => patient.user !== null);
    const patientIds = matchedPatients.map(patient => patient._id);
    
    const appointments = await Appointment.find({
      $or: [
        { patient: { $in: patientIds } },
        { purpose: { $regex: query, $options: 'i' } },
        { notes: { $regex: query, $options: 'i' } },
        { patientName: { $regex: query, $options: 'i' } },
        { doctorName: { $regex: query, $options: 'i' } }
      ]
    })
      .populate({
        path: 'patient',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .populate('doctor', 'firstName lastName specialty')
      .sort({ date: -1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error searching appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete an appointment
// @route   DELETE /api/appointments/:id
// @access  Private
const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    await appointment.deleteOne();
    
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllAppointments,
  getTodayAppointments,
  createAppointment,
  getAppointment,
  updateAppointment,
  getPatientAppointments,
  getAppointmentsByDate,
  searchAppointments,
  deleteAppointment
};