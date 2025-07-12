const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      trim: true,
      unique: [true, 'A user with your username already exists'],
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [10, 'Username cannot exceed 10 characters'],
    },
    firstName: {
      type: String,
      trim: true,
      required: [true, 'Firstname is required'],
      maxlength: [15, 'First name cannot exceed 15 characters'],
    },
    lastName: {
      type: String,
      trim: true,
      required: [true, 'Lastname is required'],
      maxlength: [15, 'Last name cannot exceed 15 characters'],
    },
    email: {
      type: String,
      trim: true,
      required: [true, 'Email is required'],
      unique: [true, 'Email already exists'],
      validate: [validator.isEmail, 'Please enter a valid email'],
      lowercase: true,
    },
    phones: [
      {
        number: {
          type: String,
          trim: true,
          validate: {
            validator: function (v) {
              return validator.isMobilePhone(v, 'any', { strictMode: true });
            },
            message: 'Please enter a valid phone number',
          },
        },
        type: {
          type: String,
          enum: ['primary', 'secondary', 'mobile', 'home', 'work'],
          default: 'primary',
        },
      },
    ],
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    photo: {
      type: String,
      default: '/img/users/default.jpg',
    },
    city: {
      type: String,
      trim: true,
      required: [true, 'City is required'],
      maxlength: [50, 'City name cannot exceed 50 characters'],
    },
    country: {
      type: String,
      trim: true,
      required: [true, 'Country is required'],
      maxlength: [50, 'Country name cannot exceed 50 characters'],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      select: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
      minlength: [8, 'Password must be at least 8 characters'],
    },
    confirmPassword: {
      type: String,
      required: [true, 'Please confirm password'],
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: 'Passwords do not match',
      },
      select: false,
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailTokenExpires: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add index for frequently queried fields
userSchema.index({ email: 1, username: 1, isActive: 1 });

userSchema.pre('save', async function (next) {
  // haspassword if its not a modified password
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);

  this.confirmPassword = undefined;
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.checkCorrectPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed
  return false;
};

userSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ isActive: { $ne: false } });
  next();
});

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetToken = hashedToken;

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
