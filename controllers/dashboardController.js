const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Prescription = require('../models/Prescription');
const LabReport = require('../models/LabReport');

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private/Doctor/Admin
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get total patients - for doctors, get only their patients via appointments
    let totalPatients;
    if (req.user.role === 'doctor') {
      // Get unique patients from appointments
      const patientIds = await Appointment.distinct('patient', { doctor: userId });
      totalPatients = patientIds.length;
    } else {
      // For admin, get all patients
      totalPatients = await Patient.countDocuments();
    }
    
    // Get today's appointments for this doctor/admin
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let todayQuery = {
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    };
    
    if (req.user.role === 'doctor') {
      todayQuery.doctor = userId;
    }
    
    const todayAppointments = await Appointment.countDocuments(todayQuery);
    
    // Count remaining appointments (not completed)
    const remainingQuery = {
      ...todayQuery,
      status: { $ne: 'Completed' }
    };
    const remainingAppointments = await Appointment.countDocuments(remainingQuery);
    
    // Get total prescriptions
    let prescriptionQuery = {};
    if (req.user.role === 'doctor') {
      prescriptionQuery.doctor = userId;
    }
    const prescriptions = await Prescription.countDocuments(prescriptionQuery);
    
    // Get total lab reports
    const labReports = await LabReport.countDocuments();
    
    // Get pending lab reports
    const pendingReports = await LabReport.countDocuments({
      status: 'Pending'
    });

    res.json({
      totalPatients,
      appointmentsToday: todayAppointments,
      remainingAppointments,
      prescriptions,
      labReports,
      pendingReports
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDashboardStats
};