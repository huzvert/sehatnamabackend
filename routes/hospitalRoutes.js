const express = require('express');
const router = express.Router();
const {
  getHospitals,
  getHospital,
  createHospital,
  updateHospital,
  deleteHospital
} = require('../controllers/hospitalController');

// Routes without auth middleware
router.route('/')
  .get(getHospitals)
  .post(createHospital);

router.route('/:id')
  .get(getHospital)
  .put(updateHospital)
  .delete(deleteHospital);

module.exports = router;