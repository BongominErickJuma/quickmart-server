const Product = require('../models/product.model');
const APIFeatures = require('../utils/apiFeatures');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.getAllProducts = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Product.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const products = await features.query;

  res.status(200).json({
    status: 'success',
    result: products.length,
    data: {
      products,
    },
  });
});

exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError('The product is not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      product,
    },
  });
});

exports.createProduct = catchAsync(async (req, res, next) => {
  const newProduct = await Product.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      product: newProduct,
    },
  });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedProduct) {
    return next(new AppError('Product not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      product: updatedProduct,
    },
  });
});

exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    return next(new AppError('Product not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
