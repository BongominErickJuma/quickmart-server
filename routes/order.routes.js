const express = require('express');
const authController = require('../controllers/auth.controller');
const orderController = require('../controllers/order.controller');

const router = express.Router();

router.use(authController.protect);

router.post('/checkout-session', orderController.getCheckoutSession);

router.get('/my-orders', orderController.getMyOrders);

router.route('/').get(orderController.getAllOrders);

router
  .route('/:id')
  .get(orderController.getOrder)
  .delete(orderController.deleteOrder);

module.exports = router;
