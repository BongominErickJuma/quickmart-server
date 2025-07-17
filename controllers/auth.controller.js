const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const crypto = require('crypto');

const User = require('../models/user.model');
const appError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signJWT = (id) => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signJWT(user._id);

  res.cookie('qm_v1_cookie', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: (process.env.NODE_ENV = 'production'),
    sameSite: (process.env.NODE_ENV = 'production' ? 'none' : 'lax'),
  });

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

// SIGNUP USER

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);

  // const url = `${req.protocol}://${req.get('host')}/me`;

  const url = `https://https://qm-client.netlify.app/profile`;

  //  const  url = `http://localhost:5173/profile`;

  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

// LOGIN USER
exports.login = catchAsync(async (req, res, next) => {
  // check if email & password exists in the POSTed body
  const { email, password } = req.body;
  if (!email || !password)
    return next(new appError('Please provide email and password', 404));

  // check if email exists in the email

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.checkCorrectPassword(password, user.password)))
    return next(new appError('invalid Email or Password', 404));

  createSendToken(user, 200, res);
});

// LOGOUT USER

exports.logout = (req, res) => {
  res.cookie('qm_v1_cookie', 'logout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: (process.env.NODE_ENV = 'production'),
    sameSite: (process.env.NODE_ENV = 'production' ? 'none' : 'lax'),
  });

  res.status(200).json({ status: 'success', message: 'logout successfull' });
};

// PROTECT ROUTES

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  // 01 check for token in the header

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.qm_v1_cookie) {
    token = req.cookies.qm_v1_cookie;
  }

  if (!token) {
    return next(new AppError('You are not logged in, please login', 401));
  }

  // 02 decode the token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 03 check if user exists
  const currentUser = await User.findById({ _id: decoded.id });

  if (!currentUser) {
    return next(new AppError('User no longer exists', 404));
  }

  // 04 check if user changed password
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed Password, please login again', 400)
    );
  }

  // 05 if all is okay, send token

  req.user = currentUser;
  next();
});

// RESTRICT ACCESS

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

// FORGOT PASSWORD

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // chack if the POSTed email exists
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('Email does not exists', 404));
  }

  // send reset token
  const resetToken = await user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // send reset token to the user email

  const resetURL = `https://qm-client.netlify.app/reset-password?token=${resetToken}`;

  // resetURL = `http://localhost:5173/reset-password?token=${resetToken}`;

  try {
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: `Token sent to ${user.email}`,
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was a problem sending reset token, Try again later',
        500
      )
    );
  }
});

// RESET PASSWORD

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError('Token has expired or is invalid', 400));
  }

  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordResetExpires = undefined;
  user.passwordResetToken = undefined;
  await user.save();

  createSendToken(user, 200, res);
});

// UPDATE PASSWORD

exports.updatePassword = catchAsync(async (req, res, next) => {
  // check if user exists

  const user = await User.findById(req.user.id).select('+password');

  // check if user exists and if current password is correct

  if (
    !user ||
    !(await user.checkCorrectPassword(req.body.currentPassword, user.password))
  ) {
    return next(new AppError('Wrong current password', 400));
  }

  // reset password and send token
  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  await user.save();

  createSendToken(user, 200, res);
});
