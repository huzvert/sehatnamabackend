const express = require('express');
const router = express.Router();
const { protect, doctor, admin } = require('../middleware/authMiddleware');
const {
  createPrescription,
  updatePrescription,
  getPrescription,
  getAllPrescriptions,
  deletePrescription, // Add this import
  downloadPrescriptionPDF, // Add this import
} = require('../controllers/prescriptionController');

// Add the missing route for getting all prescriptions
router.route('/')
  .get(protect, getAllPrescriptions)
  .post(protect, doctor, createPrescription);

router.route('/:id')
  .get(protect, getPrescription)
  .put(protect, doctor, updatePrescription)
  .delete(protect, deletePrescription); // Add DELETE route

// Add PDF download route
router.route('/:id/pdf')
  .get(protect, downloadPrescriptionPDF);

module.exports = router;