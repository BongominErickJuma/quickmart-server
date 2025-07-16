const multer = require('multer');
const sharp = require('sharp');

const User = require('../models/user.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const multerStorage = multer.memoryStorage();

// multer filter

const multerFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image')) {
    cb(new AppError('not an image, please provide an image', 400), false);
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

// upload the user photo

exports.uploadUserPhoto = upload.single('photo');

// resize user photo

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `${req.user.username}-${req.user.id}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

// filter out fields the user can't change

const filterObject = (obj, ...allowedFields) => {
  const newObj = {};

  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });

  return newObj;
};

exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.confirmPassword) {
    return next(
      new AppError(
        'This route is not for changing password. Please use update password',
        400
      )
    );
  }

  // Step 1: Filter allowed fields
  const filteredBody = filterObject(
    req.body,
    'firstName',
    'lastName',
    'username',
    'email',
    'phones',
    'city',
    'country'
  );

  // ✅ Step 2: Parse phones correctly into filteredBody
  if (req.body.phones) {
    try {
      filteredBody.phones = JSON.parse(req.body.phones);
    } catch (err) {
      return next(new AppError('Invalid phone number format', 400));
    }
  }

  // ✅ Step 3: Handle photo upload
  if (req.file) {
    filteredBody.photo = `/img/users/${req.file.filename}`;
  }

  // Step 4: Update user
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.user.id, { isActive: false });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    status: 'success',
    result: users.length,
    data: {
      users,
    },
  });
});

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});
