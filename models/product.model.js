const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price must be at least 0'],
      set: (val) => Math.round(val * 100) / 100, // Ensures 2 decimal places
    },
    image: {
      type: String,
      default: '/img/products/default.jpg',
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      enum: {
        values: [
          'Appliances',
          'Electronics',
          'Furniture',
          'Home & Kitchen',
          'Fitness',
          'Fashion',
          'Home Automation',
          'Accessories',
          'Home & Storage',
          'Home & Office',
        ],
        message: 'Please select a valid category',
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ category: 1 });

// Virtual for formatted price (e.g., $69.99)
productSchema.virtual('formattedPrice').get(function () {
  return `$${this.price.toFixed(2)}`;
});

// Static method to get products by category
productSchema.statics.findByCategory = function (category) {
  return this.find({ category: new RegExp(category, 'i') });
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
