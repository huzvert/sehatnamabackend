const express = require('express');
const router = express.Router();
const { protect, doctor, admin } = require('../middleware/authMiddleware');
const {
  getAllAppointments,
  getTodayAppointments,
  createAppointment,
  getAppointment,
  updateAppointment,
  getPatientAppointments,
  getAppointmentsByDate,
  searchAppointments,
  deleteAppointment
} = require('../controllers/appointmentController');

// PUBLIC ROUTES
// None

// PROTECTED ROUTES
// Base route: /api/appointments

// Get all appointments (admin only) and create appointment (all users)
router.route('/')
  .get(protect, admin, getAllAppointments)
  .post(protect, createAppointment);

// Get today's appointments (doctor/admin only)
router.route('/today')
  .get(protect, doctor, getTodayAppointments);

// Get appointments by date
router.route('/date/:date')
  .get(protect, getAppointmentsByDate);

// Search appointments
router.route('/search')
  .get(protect, searchAppointments);

// Get appointments for a specific patient
router.route('/patients/:patientId/appointments')
  .get(protect, getPatientAppointments);

// Get, update, or delete a specific appointment
router.route('/:id')
  .get(protect, getAppointment)
  .put(protect, updateAppointment)
  .delete(protect, deleteAppointment);

module.exports = router;