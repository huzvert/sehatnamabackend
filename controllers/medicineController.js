/**
 * @desc    Medicine controller methods for managing medicines in the inventory
 * @author  Created based on frontend requirements
 */

const asyncHandler = require('express-async-handler');
const Medicine = require('../models/Medicine');

/**
 * @desc    Get all medicines
 * @route   GET /api/medicines
 * @access  Private
 */
const getMedicines = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find({}).sort({ createdAt: -1 });
  res.status(200).json(medicines);
});

/**
 * @desc    Get single medicine by ID
 * @route   GET /api/medicines/:id
 * @access  Private
 */
const getMedicineById = asyncHandler(async (req, res) => {
  const medicine = await Medicine.findById(req.params.id);
  
  if (!medicine) {
    res.status(404);
    throw new Error('Medicine not found');
  }
  
  res.status(200).json(medicine);
});

/**
 * @desc    Create new medicine
 * @route   POST /api/medicines
 * @access  Private
 */
const createMedicine = asyncHandler(async (req, res) => {
  const { name, category, manufacturer, dosage, form, stock, status } = req.body;

  // Validate required fields
  if (!name || !category || !manufacturer || !dosage || !form) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  // Create new medicine
  const medicine = await Medicine.create({
    name,
    category,
    manufacturer,
    dosage,
    form,
    stock: stock || 0,
    status: status || 'Out of Stock' // Status will be set by the pre-save middleware
  });

  res.status(201).json(medicine);
});

/**
 * @desc    Update medicine
 * @route   PUT /api/medicines/:id
 * @access  Private
 */
const updateMedicine = asyncHandler(async (req, res) => {
  const { name, category, manufacturer, dosage, form, stock, status } = req.body;

  // Find medicine
  const medicine = await Medicine.findById(req.params.id);
  
  if (!medicine) {
    res.status(404);
    throw new Error('Medicine not found');
  }

  // Update fields
  medicine.name = name || medicine.name;
  medicine.category = category || medicine.category;
  medicine.manufacturer = manufacturer || medicine.manufacturer;
  medicine.dosage = dosage || medicine.dosage;
  medicine.form = form || medicine.form;
  
  // Handle stock specifically
  if (stock !== undefined) {
    medicine.stock = stock;
    
    // Update status based on stock
    if (stock === 0) {
      medicine.status = 'Out of Stock';
    } else if (stock < 20) {
      medicine.status = 'Low Stock';
    } else {
      medicine.status = 'In Stock';
    }
  }
  
  // Status can be explicitly set, but stock will still override it
  if (status && stock === undefined) {
    medicine.status = status;
  }

  const updatedMedicine = await medicine.save();
  res.status(200).json(updatedMedicine);
});

/**
 * @desc    Delete medicine
 * @route   DELETE /api/medicines/:id
 * @access  Private
 */
const deleteMedicine = asyncHandler(async (req, res) => {
  const medicine = await Medicine.findById(req.params.id);
  
  if (!medicine) {
    res.status(404);
    throw new Error('Medicine not found');
  }

  await medicine.deleteOne();
  res.status(200).json({ message: 'Medicine removed', id: req.params.id });
});

/**
 * @desc    Get low stock medicines
 * @route   GET /api/medicines/low-stock
 * @access  Private
 */
const getLowStockMedicines = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find({ status: 'Low Stock' });
  res.status(200).json(medicines);
});

/**
 * @desc    Get out of stock medicines
 * @route   GET /api/medicines/out-of-stock
 * @access  Private
 */
const getOutOfStockMedicines = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find({ status: 'Out of Stock' });
  res.status(200).json(medicines);
});

/**
 * @desc    Search medicines by name, category, or manufacturer
 * @route   GET /api/medicines/search
 * @access  Private
 */
const searchMedicines = asyncHandler(async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ message: 'Search query is required' });
  }
  
  const medicines = await Medicine.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { category: { $regex: query, $options: 'i' } },
      { manufacturer: { $regex: query, $options: 'i' } }
    ]
  });
  
  res.status(200).json(medicines);
});

module.exports = {
  getMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getLowStockMedicines,
  getOutOfStockMedicines,
  searchMedicines
};