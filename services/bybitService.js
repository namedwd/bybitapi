const axios = require('axios');
const crypto = require('crypto');

class BybitService {
  constructor() {
    this.apiKey = process.env.BYBIT_API_KEY;
    this.apiSecret = process.env.BYBIT_API_SECRET;
    this.baseUrl = process.env.BYBIT_TESTNET === 'true' 
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';
    this.recvWindow = 20000;
  }

  generateSignature(timestamp, apiKey, recvWindow, queryString = '') {
    const str = timestamp + apiKey + recvWindow + queryString;
    return crypto.createHmac('sha256', this.apiSecret).update(str).digest('hex');
  }

  async makeRequest(method, endpoint, params = {}, isPrivate = true) {
    try {
      const timestamp = Date.now().toString();
      const url = `${this.baseUrl}${endpoint}`;
      
      let config = {
        method,
        url,
        headers: {}
      };

      if (isPrivate) {
        config.headers['X-BAPI-API-KEY'] = this.apiKey;
        config.headers['X-BAPI-TIMESTAMP'] = timestamp;
        config.headers['X-BAPI-RECV-WINDOW'] = this.recvWindow.toString();
      }

      if (method === 'GET') {
        const queryString = new URLSearchParams(params).toString();
        if (queryString) {
          config.url = `${url}?${queryString}`;
        }
        if (isPrivate) {
          config.headers['X-BAPI-SIGN'] = this.generateSignature(
            timestamp, 
            this.apiKey, 
            this.recvWindow, 
            queryString
          );
        }
      } else {
        config.data = params;
        config.headers['Content-Type'] = 'application/json';
        if (isPrivate) {
          config.headers['X-BAPI-SIGN'] = this.generateSignature(
            timestamp, 
            this.apiKey, 
            this.recvWindow, 
            JSON.stringify(params)
          );
        }
      }

      const response = await axios(config);
      
      if (response.data.retCode !== 0) {
        throw new Error(`Bybit API Error: ${response.data.retMsg}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('Bybit API Request Error:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  // Account methods
  async getBalance(accountType = 'CONTRACT', coin = null) {
    const params = { accountType };
    if (coin) params.coin = coin;
    return this.makeRequest('GET', '/v5/account/wallet-balance', params);
  }

  // Position methods
  async getPositions(category = 'linear', symbol = null) {
    const params = { category };
    if (symbol) params.symbol = symbol;
    return this.makeRequest('GET', '/v5/position/list', params);
  }

  // Order methods
  async placeOrder(orderData) {
    const requiredFields = ['category', 'symbol', 'side', 'orderType', 'qty'];
    for (const field of requiredFields) {
      if (!orderData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    return this.makeRequest('POST', '/v5/order/create', orderData);
  }

  async cancelOrder(category, symbol, orderId) {
    const params = { category, symbol, orderId };
    return this.makeRequest('POST', '/v5/order/cancel', params);
  }

  async getOpenOrders(category = 'linear', symbol = null) {
    const params = { category };
    if (symbol) params.symbol = symbol;
    return this.makeRequest('GET', '/v5/order/realtime', params);
  }

  async getOrderHistory(category = 'linear', symbol = null, limit = 20) {
    const params = { category, limit };
    if (symbol) params.symbol = symbol;
    return this.makeRequest('GET', '/v5/order/history', params);
  }

  // Market data methods (public)
  async getKlineData(category, symbol, interval, limit = 200) {
    const params = { category, symbol, interval, limit };
    return this.makeRequest('GET', '/v5/market/kline', params, false);
  }

  async getTickers(category, symbol = null) {
    const params = { category };
    if (symbol) params.symbol = symbol;
    return this.makeRequest('GET', '/v5/market/tickers', params, false);
  }

  async getOrderBook(category, symbol, limit = 25) {
    const params = { category, symbol, limit };
    return this.makeRequest('GET', '/v5/market/orderbook', params, false);
  }

  // Trading settings
  async setLeverage(category, symbol, buyLeverage, sellLeverage) {
    const params = { 
      category, 
      symbol, 
      buyLeverage: buyLeverage.toString(), 
      sellLeverage: sellLeverage.toString() 
    };
    return this.makeRequest('POST', '/v5/position/set-leverage', params);
  }

  async getFeeRate(category, symbol = null) {
    const params = { category };
    if (symbol) params.symbol = symbol;
    return this.makeRequest('GET', '/v5/account/fee-rate', params);
  }
}

module.exports = new BybitService();
