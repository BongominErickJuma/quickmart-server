const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const appError = require('./../utils/appError');
const catchAsync = require('./../utils/catchAsync');

const signJWT = (id) => {
  return jwt.sign(id, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signJWT(user._id);

  res.status(statusCode).json({
    status: 'success',
    token,
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  // check if email & password exists in the POSTed body
  const { email, password } = req.body;
  if (!email || !password)
    return next(new appError('Please provide email and password', 404));

  // check if email exists in the email

  const user = await User.findOne({ email }).select('+password');
  if (!user || (await user.checkCorrectPassword(password, user.password)))
    return next(new appError('invalid Email or Password', 404));

  createSendToken(user, 200, res);
});
