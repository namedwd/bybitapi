const express = require('express');
const cors = require('cors');
require('dotenv').config();

const config = require('./src/config');
const WebSocketService = require('./src/services/WebSocketService');
const BybitService = require('./src/services/BybitService');
const TradingService = require('./src/services/TradingService');

// Express 앱 설정
const app = express();
app.use(cors(config.server.cors));
app.use(express.json());

// 서비스 인스턴스 생성
const wsService = new WebSocketService(config);
const bybitService = new BybitService(config);
const tradingService = new TradingService(config);

// PnL 업데이트 인터벌
let pnlInterval = null;

// WebSocket 메시지 핸들러
wsService.on('message', ({ clientId, type, data }) => {
  console.log(`Message from ${clientId}: ${type}`);
  
  switch (type) {
    case 'subscribe':
      handleSubscribe(clientId, data);
      break;
      
    case 'place_order':
      handlePlaceOrder(clientId, data);
      break;
      
    case 'close_position':
      handleClosePosition(clientId, data);
      break;
      
    case 'cancel_order':
      handleCancelOrder(clientId, data);
      break;
      
    case 'get_balance':
      sendUserBalance(clientId);
      break;
      
    case 'get_positions':
      sendUserPositions(clientId);
      break;
      
    case 'get_orders':
      sendUserOrders(clientId);
      break;
      
    default:
      console.log(`Unknown message type: ${type}`);
  }
});

// 클라이언트 연결 핸들러
wsService.on('clientConnected', (clientId) => {
  // 사용자 초기화
  tradingService.createUser(clientId);
  
  // 현재 시장 데이터 전송
  const marketData = bybitService.getMarketData();
  wsService.sendToClient(clientId, { type: 'ticker', data: marketData.ticker });
  wsService.sendToClient(clientId, { type: 'orderbook', data: marketData.orderbook });
  wsService.sendToClient(clientId, { type: 'candles', data: marketData.candles });
  
  // 사용자 데이터 전송
  sendUserBalance(clientId);
  sendUserPositions(clientId);
  sendUserOrders(clientId);
});

// 클라이언트 연결 해제 핸들러
wsService.on('clientDisconnected', (clientId) => {
  console.log(`Client ${clientId} disconnected`);
});

// Bybit 데이터 핸들러
bybitService.on('ticker', (ticker) => {
  wsService.broadcastToAll({ type: 'ticker', data: ticker });
});

bybitService.on('orderbook', (orderbook) => {
  wsService.broadcastToAll({ type: 'orderbook', data: orderbook });
});

bybitService.on('candles', (candles) => {
  wsService.broadcastToAll({ type: 'candles', data: candles });
});

// Trading 서비스 이벤트 핸들러
tradingService.on('positionOpened', ({ userId, position }) => {
  sendUserPositions(userId);
});

tradingService.on('positionClosed', ({ userId, position, pnl }) => {
  sendUserPositions(userId);
  wsService.sendToClient(userId, {
    type: 'close_position_response',
    data: { success: true, pnl }
  });
});

tradingService.on('positionUpdated', ({ userId, positions }) => {
  wsService.sendToClient(userId, {
    type: 'position_update',
    data: positions
  });
});

tradingService.on('balanceUpdated', ({ userId, balance }) => {
  wsService.sendToClient(userId, {
    type: 'balance_update',
    data: balance
  });
});

tradingService.on('orderPlaced', ({ userId, order }) => {
  sendUserOrders(userId);
});

tradingService.on('orderFilled', ({ userId, order, position }) => {
  sendUserOrders(userId);
  sendUserPositions(userId);
});

tradingService.on('orderCancelled', ({ userId, orderId }) => {
  sendUserOrders(userId);
  wsService.sendToClient(userId, {
    type: 'cancel_order_response',
    data: { success: true }
  });
});

// 핸들러 함수들
function handleSubscribe(clientId, data) {
  console.log(`Client ${clientId} subscribed to ${data.channel || 'all'}`);
}

function handlePlaceOrder(clientId, data) {
  const currentPrice = bybitService.getCurrentPrice();
  const orderData = {
    ...data,
    currentPrice,
    symbol: config.bybit.defaultSymbol
  };
  
  const result = tradingService.placeOrder(clientId, orderData);
  wsService.sendToClient(clientId, {
    type: 'order_response',
    data: result
  });
}

function handleClosePosition(clientId, data) {
  const result = tradingService.closePosition(clientId, data.positionId);
  if (!result.success) {
    wsService.sendToClient(clientId, {
      type: 'close_position_response',
      data: result
    });
  }
}

function handleCancelOrder(clientId, data) {
  const result = tradingService.cancelOrder(clientId, data.orderId);
  if (!result.success) {
    wsService.sendToClient(clientId, {
      type: 'cancel_order_response',
      data: result
    });
  }
}

function sendUserBalance(userId) {
  const balance = tradingService.getUserBalance(userId);
  if (balance) {
    wsService.sendToClient(userId, {
      type: 'balance_update',
      data: balance
    });
  }
}

function sendUserPositions(userId) {
  const positions = tradingService.getUserPositions(userId);
  wsService.sendToClient(userId, {
    type: 'position_update',
    data: positions
  });
}

function sendUserOrders(userId) {
  const orders = tradingService.getUserOrders(userId);
  wsService.sendToClient(userId, {
    type: 'order_update',
    data: orders
  });
}

// PnL 업데이트 함수
function updateAllPnL() {
  try {
    const currentPrice = bybitService.getCurrentPrice();
    if (currentPrice > 0) {
      tradingService.updatePositionsPnL(currentPrice);
      tradingService.checkPendingOrders(currentPrice);
    }
  } catch (error) {
    console.error('Error updating PnL:', error.message);
  }
}

// REST API 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    clients: wsService.getClientCount(),
    marketData: bybitService.getMarketData(),
    config: {
      wsPort: config.server.wsPort,
      httpPort: config.server.httpPort,
      symbol: config.bybit.defaultSymbol
    }
  });
});

app.get('/config', (req, res) => {
  res.json({
    trading: {
      initialBalance: config.trading.initialBalance,
      defaultLeverage: config.trading.defaultLeverage,
      maxLeverage: config.trading.maxLeverage,
      minOrderAmount: config.trading.minOrderAmount,
      maxPositions: config.trading.maxPositions
    },
    symbol: config.bybit.defaultSymbol
  });
});

// 서버 시작
async function startServer() {
  console.log('Starting mock trading server...');
  
  // Bybit 서비스 초기화
  await bybitService.initialize();
  
  // WebSocket 서버 시작
  wsService.start();
  
  // HTTP 서버 시작
  app.listen(config.server.httpPort, () => {
    console.log(`HTTP server running on port ${config.server.httpPort}`);
  });
  
  // PnL 업데이트 시작
  pnlInterval = setInterval(updateAllPnL, config.intervals.pnlUpdate);
  
  console.log('Mock trading server initialized successfully');
}

// 종료 처리
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  
  if (pnlInterval) clearInterval(pnlInterval);
  
  bybitService.destroy();
  
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error.message);
});

// 서버 시작
startServer().catch(console.error);
