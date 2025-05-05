const express = require('express');
const router = express.Router();
const { protect, doctor, admin } = require('../middleware/authMiddleware');
const {
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
  processPatientDocument
} = require('../controllers/patientController');
const { getPatientAppointments } = require('../controllers/appointmentController');

// Patient routes
router.route('/')
  .get(protect, doctor, getAllPatients)
  .post(protect, doctor, createPatient);

router.route('/recent')
  .get(protect, doctor, getRecentPatients);

router.route('/:patientId')
  .get(protect, getPatient)
  .put(protect, updatePatient)
  .delete(protect, deletePatient);

router.route('/:patientId/history')
  .get(protect, getPatientHistory);

router.route('/:patientId/documents')
  .get(protect, getPatientDocuments)
  .post(protect, uploadPatientDocument);

router.route('/:patientId/documents/:documentId')
  .delete(protect, deletePatientDocument);

router.route('/:patientId/documents/:documentId/process')
  .put(protect, doctor, processPatientDocument);

router.route('/:patientId/appointments')
  .get(protect, getPatientAppointments);

module.exports = router;