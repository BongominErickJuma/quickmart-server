const express = require('express');
const authController = require('../controllers/auth.controller');
const userController = require('../controllers/user.controller');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);

router.use(authController.protect);

router.patch(
  '/update-me',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  userController.updateMe
);
router.patch('/update-password', authController.updatePassword);

router.delete('/delete-me', userController.deleteMe);
router.get('/logout', authController.logout);
router.get('/me', userController.getMe, userController.getUser);

router.route('/').get(userController.getAllUsers);
router.route('/:id').get(userController.getUser);

module.exports = router;
