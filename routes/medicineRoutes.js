const express = require('express');
const router = express.Router();
const {
  getMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getLowStockMedicines,
  getOutOfStockMedicines,
  searchMedicines
} = require('../controllers/medicineController');
const { protect } = require('../middleware/authMiddleware');

// Use auth middleware if you have it
// router.use(protect);

// Search and filter routes
router.get('/search', searchMedicines);
router.get('/low-stock', getLowStockMedicines);
router.get('/out-of-stock', getOutOfStockMedicines);

// Main routes
router.route('/')
  .get(getMedicines)
  .post(createMedicine);

router.route('/:id')
  .get(getMedicineById)
  .put(updateMedicine)
  .delete(deleteMedicine);

module.exports = router;