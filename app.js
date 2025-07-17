const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const userRoutes = require('./routes/user.routes');
const productRoutes = require('./routes/products.routes');
const orderRoutes = require('./routes/order.routes');
const globalErrorHandler = require('./controllers/error.controller');
const AppError = require('./utils/appError');

const orderController = require('./controllers/order.controller');

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// webhook endpoint

app.post(
  '/webhook-checkout',
  express.raw({ type: 'application/json' }),
  orderController.webhookCheckout
);

const allowedOrigins = [
  'http://localhost:5173',
  'https://qm-client.netlify.app',
];

// middlewares

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: function (origin, cb) {
      // allow requests without origin like postman, thunderclieent, curl
      if (!origin) {
        return cb(null, true);
      }
      // block origins which you dont allow
      if (!allowedOrigins.includes(origin)) {
        return cb(next(new AppError('Origin not allowed by CORS', 400)), false);
      }

      return cb(null, true);
    },
    credentials: true,
  })
);

app.use(morgan('dev'));
app.set('query parser', 'extended');
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/v1/qm/users', userRoutes);
app.use('/api/v1/qm/products', productRoutes);
app.use('/api/v1/qm/orders', orderRoutes);

app.all('/{*any}', (req, res, next) => {
  next(new AppError(`Can not find ${req.originalUrl} from our server!!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
