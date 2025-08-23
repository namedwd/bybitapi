const express = require('express');
const router = express.Router();
const bybitService = require('../services/bybitService');

// Get account balance
router.get('/balance', async (req, res, next) => {
  try {
    const accountType = req.query.accountType || 'CONTRACT';
    const coin = req.query.coin;
    const result = await bybitService.getBalance(accountType, coin);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get positions
router.get('/positions', async (req, res, next) => {
  try {
    const { category, symbol } = req.query;
    const result = await bybitService.getPositions(category, symbol);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Place order
router.post('/order', async (req, res, next) => {
  try {
    const orderData = req.body;
    const result = await bybitService.placeOrder(orderData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Cancel order
router.delete('/order/:orderId', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { category, symbol } = req.query;
    const result = await bybitService.cancelOrder(category, symbol, orderId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get open orders
router.get('/orders/open', async (req, res, next) => {
  try {
    const { category, symbol } = req.query;
    const result = await bybitService.getOpenOrders(category, symbol);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get order history
router.get('/orders/history', async (req, res, next) => {
  try {
    const { category, symbol, limit } = req.query;
    const result = await bybitService.getOrderHistory(category, symbol, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get kline data
router.get('/kline', async (req, res, next) => {
  try {
    const { category, symbol, interval, limit } = req.query;
    const result = await bybitService.getKlineData(category, symbol, interval, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get tickers
router.get('/tickers', async (req, res, next) => {
  try {
    const { category, symbol } = req.query;
    const result = await bybitService.getTickers(category, symbol);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get order book
router.get('/orderbook', async (req, res, next) => {
  try {
    const { category, symbol, limit } = req.query;
    const result = await bybitService.getOrderBook(category, symbol, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Set leverage
router.post('/leverage', async (req, res, next) => {
  try {
    const { category, symbol, buyLeverage, sellLeverage } = req.body;
    const result = await bybitService.setLeverage(category, symbol, buyLeverage, sellLeverage);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get fee rate
router.get('/fee-rate', async (req, res, next) => {
  try {
    const { category, symbol } = req.query;
    const result = await bybitService.getFeeRate(category, symbol);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
