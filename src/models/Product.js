const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Product name is required'], trim: true, minlength: 2, maxlength: 120 },
  sku: { type: String, required: [true, 'SKU is required'], unique: true, trim: true, uppercase: true, minlength: 3, maxlength: 40 },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0, validate: Number.isInteger },
  reorderLevel: { type: Number, required: true, min: 0, validate: Number.isInteger },
  supplier: { type: String, required: true, trim: true, maxlength: 120 }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
productSchema.virtual('stockValue').get(function () { return Number((this.price * this.quantity).toFixed(2)); });
module.exports = mongoose.model('Product', productSchema);
