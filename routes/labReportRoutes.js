const express = require('express');
const router = express.Router();
const { protect, doctor, admin } = require('../middleware/authMiddleware');
const {
  getAllLabReports,
  getLabReport,
  createLabReport,
  updateLabReport,
  deleteLabReport,
  downloadLabReport,
} = require('../controllers/labReportController');

// Lab report routes
router.route('/')
  .get(protect, getAllLabReports)
  .post(protect, doctor, createLabReport);

router.route('/:id')
  .get(protect, getLabReport)
  .put(protect, doctor, updateLabReport)
  .delete(protect, admin, deleteLabReport);

router.route('/:id/download')
  .get(protect, downloadLabReport);

module.exports = router;