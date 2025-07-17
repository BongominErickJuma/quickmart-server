const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const Product = require('../models/product.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// Create Stripe Checkout Session
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
    success_url: 'https://qm-client.netlify.app/my-orders',
    // success_url:'http://localhost:5173/my-orders',

    cancel_url: 'https://qm-client.netlify.app',
    // cancel_url: 'http://localhost:5173'
    customer_email: req.user.email,
    client_reference_id: req.user.id,
    line_items,
    metadata: {
      cart: JSON.stringify(items), // only contains product_id and quantity
    },
  });

  res.status(200).json({
    status: 'success',
    data: {
      session,
    },
  });
});

// Stripe Webhook Handler
exports.webhookCheckout = (req, res, next) => {
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    createOrderCheckout(event.data.object);
  }

  res.status(200).json({ received: true });
};

// Create Order from Stripe Session
const createOrderCheckout = async (session) => {
  const user = (await User.findOne({ email: session.customer_email }))?.id;
  const totalPrice = session.amount_total / 100;

  let products = [];

  if (session.metadata?.cart) {
    try {
      const cartItems = JSON.parse(session.metadata.cart);

      // ✅ Fetch full product info for price
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

      // Remove any failed lookups
      products = products.filter((p) => p !== null);
    } catch (err) {
      console.error(
        'Failed to parse or fetch products from cart metadata:',
        err
      );
    }
  }

  if (user && products.length > 0) {
    await Order.create({ products, user, totalPrice, paid: true });
  }
};

// Get a single order
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    'products.product'
  );

  if (!order) {
    return next(new AppError('No order found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      order,
    },
  });
});

// Get all orders
exports.getAllOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find().populate('products.product');

  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: {
      orders,
    },
  });
});

// Delete an order
exports.deleteOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findByIdAndDelete(req.params.id);

  if (!order) {
    return next(new AppError('No order found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// get order for only one user

exports.getMyOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ user: req.user.id });

  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: {
      orders,
    },
  });
});
