const express = require('express');
const router = express.Router();
const { protect, doctor, admin } = require('../middleware/authMiddleware');
const { getDashboardStats } = require('../controllers/dashboardController');

router.route('/stats').get(protect, getDashboardStats);

module.exports = router;
