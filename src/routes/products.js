const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const router = express.Router();
const fields = ['name', 'sku', 'category', 'price', 'quantity', 'reorderLevel', 'supplier'];
const run = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (message) => Object.assign(new Error(message), { status: 400 });
function number(v, field, integer = false) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) throw bad(`${field} must be a non-negative ${integer ? 'integer' : 'number'}`);
  return n;
}
function payload(body, partial = false) {
  const data = Object.fromEntries(fields.filter((f) => Object.hasOwn(body, f)).map((f) => [f, body[f]]));
  if (!partial) {
    const missing = fields.filter((f) => data[f] === undefined || data[f] === '');
    if (missing.length) throw bad(`Missing required fields: ${missing.join(', ')}`);
  }
  if (data.price !== undefined) data.price = number(data.price, 'price');
  if (data.quantity !== undefined) data.quantity = number(data.quantity, 'quantity', true);
  if (data.reorderLevel !== undefined) data.reorderLevel = number(data.reorderLevel, 'reorderLevel', true);
  return data;
}
function validId(id) { if (!mongoose.isValidObjectId(id)) throw bad('Invalid product ID'); }

router.get('/', run(async (req, res) => {
  const page = number(req.query.page ?? 1, 'page', true);
  const limit = number(req.query.limit ?? 10, 'limit', true);
  if (page < 1 || limit < 1 || limit > 100) throw bad('page must be at least 1 and limit between 1 and 100');
  const filter = {};
  if (req.query.category) filter.category = new RegExp('^' + String(req.query.category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
  if (req.query.search) {
    const q = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(q, 'i') }, { sku: new RegExp(q, 'i') }, { supplier: new RegExp(q, 'i') }];
  }
  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    filter.price = {};
    if (req.query.minPrice !== undefined) filter.price.$gte = number(req.query.minPrice, 'minPrice');
    if (req.query.maxPrice !== undefined) filter.price.$lte = number(req.query.maxPrice, 'maxPrice');
    if (filter.price.$gte > filter.price.$lte) throw bad('minPrice cannot exceed maxPrice');
  }
  const sortBy = ['name','sku','category','price','quantity','reorderLevel','createdAt'].includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
  const sortOrder = String(req.query.sortOrder).toLowerCase() === 'asc' ? 1 : -1;
  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter).sort({ [sortBy]: sortOrder }).skip((page - 1) * limit).limit(limit)
  ]);
  res.json({ total, page, totalPages: Math.ceil(total / limit), count: products.length, products });
}));
router.post('/', run(async (req, res) => res.status(201).json(await Product.create(payload(req.body)))));
router.get('/low-stock', run(async (req, res) => {
  const products = await Product.find({ $expr: { $lte: ['$quantity', '$reorderLevel'] } }).sort({ quantity: 1, name: 1 });
  res.json({ count: products.length, lowStockItems: products });
}));
router.get('/summary/categories', run(async (req, res) => {
  const categories = await Product.aggregate([
    { $group: { _id: '$category', productCount: { $sum: 1 }, totalUnits: { $sum: '$quantity' },
      inventoryValue: { $sum: { $multiply: ['$price', '$quantity'] } },
      lowStockCount: { $sum: { $cond: [{ $lte: ['$quantity', '$reorderLevel'] }, 1, 0] } } } },
    { $project: { _id: 0, category: '$_id', productCount: 1, totalUnits: 1, inventoryValue: { $round: ['$inventoryValue', 2] }, lowStockCount: 1 } },
    { $sort: { category: 1 } }
  ]);
  res.json({ categories });
}));
router.get('/:id', run(async (req, res) => {
  validId(req.params.id); const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
}));
router.patch('/:id', run(async (req, res) => {
  validId(req.params.id); const updates = payload(req.body, true);
  if (!Object.keys(updates).length) throw bad('Provide at least one field to update');
  const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
}));
async function adjust(req, res, direction) {
  validId(req.params.id); const quantity = number(req.body.quantity, 'quantity', true);
  if (quantity < 1) throw bad('quantity must be at least 1');
  const filter = { _id: req.params.id };
  if (direction < 0) filter.quantity = { $gte: quantity };
  const product = await Product.findOneAndUpdate(filter, { $inc: { quantity: direction * quantity } }, { new: true, runValidators: true });
  if (!product) {
    if (!await Product.exists({ _id: req.params.id })) return res.status(404).json({ error: 'Product not found' });
    return res.status(409).json({ error: 'Insufficient stock for this sale' });
  }
  res.json({ message: direction > 0 ? 'Stock restocked' : 'Sale recorded', product });
}
router.post('/:id/restock', run((req, res) => adjust(req, res, 1)));
router.post('/:id/sale', run((req, res) => adjust(req, res, -1)));
router.delete('/:id', run(async (req, res) => {
  validId(req.params.id); const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ message: 'Product deleted', id: product._id });
}));
module.exports = router;
