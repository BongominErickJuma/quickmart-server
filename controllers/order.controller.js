const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const Product = require('../models/product.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// controllers/order.controller.js

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
        unit_amount: product.price * 100, // Stripe expects amount in cents
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
    success_url:
      process.env.NODE_ENV === 'production'
        ? 'https://qm-client.netlify.app'
        : 'http://localhost:5173',
    cancel_url:
      process.env.NODE_ENV === 'production'
        ? 'https://qm-client.netlify.app'
        : 'http://localhost:5173',
    customer_email: req.user.email,
    client_reference_id: req.user.id,
    line_items,
    metadata: {
      cart: JSON.stringify(items),
    },
  });

  res.status(200).json({
    status: 'success',
    data: {
      session,
    },
  });
});

const createOrderCheckout = async (session) => {
  const user = (await User.findOne({ email: session.customer_email })).id;
  const totalPrice = session.amount_total / 100;

  let products = [];

  if (session.metadata && session.metadata.cart) {
    try {
      const cartItems = JSON.parse(session.metadata.cart);
      products = cartItems.map((item) => ({
        product: item.product_id || item._id || item.id,
        quantity: item.quantity || item.count || 1,
        unitPrice: item.price,
      }));
    } catch (err) {
      console.error('Failed to parse cart metadata:', err);
    }
  }

  console.log('Creating order for user:', user);
  console.log('Order data:', { products, user, totalPrice });

  await Order.create({ products, user, totalPrice, paid: true });

  console.log('Order successfully created!');
};

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

  if (event.type === 'checkout.session.completed')
    createOrderCheckout(event.data.object);

  res.status(200).json({ received: true });
};

exports.getOrder = catchAsync(async (req, res, next) => {});
exports.getAllOrders = catchAsync(async (req, res, next) => {});
exports.deleteOrder = catchAsync(async (req, res, next) => {});
