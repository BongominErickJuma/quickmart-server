const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const userRoutes = require('./routes/userRoutes');
const globalErrorHandler = require('./controllers/errorController');
const appError = require('./utils/appError');

const app = express();

// middlewares

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.set('query parser', 'extended');

app.use('/api/v1/qm/users', userRoutes);

app.all('/{*any}', (req, res, next) => {
  next(new appError(`Can not find ${req.originalUrl} from our server!!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
