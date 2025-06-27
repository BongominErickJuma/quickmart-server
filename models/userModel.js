const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      trim: true,
      unique: [true, 'A user with your username already exists'],
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [
        /^[a-zA-Z0-9_]+$/,
        'Username can only contain letters, numbers, and underscores',
      ],
    },
    firstName: {
      type: String,
      trim: true,
      required: [true, 'Firstname is required'],
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      trim: true,
      required: [true, 'Lastname is required'],
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      trim: true,
      required: [true, 'Email is required'],
      unique: [true, 'User must have a unique email'],
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
      default: '/assets/images/default-user.png',
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
      select: false,
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
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add index for frequently queried fields
userSchema.index({ email: 1, username: 1, isActive: 1 });

userSchema.pre('save', async function (next) {
  // haspassword if its not a modified password
  if (!this.isModified(password)) return next();

  this.password = await bcrypt.hash(this.password, 12);

  this.confirmPassword = undefined;
  next();
});

userSchema.methods.checkCorrectPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
