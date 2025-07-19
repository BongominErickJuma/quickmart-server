const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// ⚡ Create Stripe Checkout Session
exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  const items = req.body.items;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new AppError('No products selected for checkout', 400));
  }

  const line_items = [];

  for (const item of items) {
    const product = await Product.findById(item.product_id);
    if (!product) {
      return next(
        new AppError(`Product with ID ${item.product_id} not found`, 404)
      );
    }

    line_items.push({
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(product.price * 100),
        product_data: {
          name: product.name,
          description: product.description,
          images: [
            `${req.protocol}://${req.get('host')}/img/products/${
              product.image
            }`,
          ],
        },
      },
      quantity: item.quantity,
    });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/my-orders`,
    cancel_url: `${process.env.CLIENT_URL}`,
    customer_email: req.user.email,
    client_reference_id: req.user.id,
    line_items,
    metadata: {
      cart: JSON.stringify(items), // Only contains product_id and quantity
    },
  });

  res.status(200).json({
    status: 'success',
    data: {
      session,
    },
  });
});

// ⚡ Stripe Webhook Handler
exports.webhookCheckout = catchAsync(async (req, res, next) => {
  const signature = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('⚠️ Stripe Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    console.log('✅ Stripe checkout.session.completed received');
    await createOrderCheckout(event.data.object);
  }

  res.status(200).json({ received: true });
});

// ✅ Create Order After Checkout
const createOrderCheckout = async (session) => {
  const user = (await User.findOne({ email: session.customer_email }))?.id;
  const totalPrice = session.amount_total / 100;

  if (!user) return;

  let products = [];

  try {
    const cartItems = JSON.parse(session.metadata.cart || '[]');

    products = await Promise.all(
      cartItems.map(async (item) => {
        const productDoc = await Product.findById(item.product_id);
        if (!productDoc) return null;

        return {
          product: productDoc._id,
          quantity: item.quantity,
          unitPrice: productDoc.price,
        };
      })
    );

    products = products.filter(Boolean);
  } catch (err) {
    console.error('❌ Failed to parse cart metadata:', err);
    return;
  }

  if (products.length === 0) return;

  // ❗ Idempotency check: avoid duplicate orders
  const existingOrder = await Order.findOne({
    user,
    totalPrice,
    paid: true,
  });

  if (!existingOrder) {
    await Order.create({ products, user, totalPrice, paid: true });
    console.log('✅ Order created from Stripe webhook.');
  } else {
    console.log('⚠️ Duplicate order skipped (already exists).');
  }
};

// 📦 Get single order by ID
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    'products.product'
  );

  if (!order) {
    return next(new AppError('No order found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { order },
  });
});

// 📦 Get all orders (admin)
exports.getAllOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find().populate('products.product');

  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: { orders },
  });
});

// 🗑️ Delete order
exports.deleteOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findByIdAndDelete(req.params.id);

  if (!order) {
    return next(new AppError('No order found with that ID', 404));
  }

  res.status(204).json({ status: 'success', data: null });
});

// 📦 Get orders for logged-in user
exports.getMyOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ user: req.user.id }).populate(
    'products.product'
  );

  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: { orders },
  });
});
