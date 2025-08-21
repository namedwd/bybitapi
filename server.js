const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 바이비트 웹소켓 URL
const BYBIT_WS_URL = 'wss://stream.bybit.com/v5/public/linear';
const BYBIT_REST_URL = 'https://api.bybit.com';

// 클라이언트 연결 관리
const clients = new Map();

// 시장 데이터 캐시
const marketData = {
  ticker: { last: 0, change24h: 0, changePercent: 0 },
  orderbook: { bids: [], asks: [] },
  candles: [],
  lastUpdate: Date.now()
};

// 모의 거래 데이터
const mockData = {
  users: new Map(), // userId -> userData
  positions: new Map(), // positionId -> position
  orders: new Map(), // orderId -> order
};

// WebSocket 서버
const wss = new WebSocket.Server({ port: PORT });

console.log(`WebSocket server running on port ${PORT}`);

// 바이비트 실시간 데이터 연결
let bybitWs = null;

function connectBybit() {
  bybitWs = new WebSocket(BYBIT_WS_URL);
  
  bybitWs.on('open', () => {
    console.log('Connected to Bybit WebSocket');
    
    // 구독 메시지
    const subscribeMsg = {
      op: "subscribe",
      args: [
        "tickers.BTCUSDT",
        "orderbook.50.BTCUSDT",
        "kline.1.BTCUSDT"
      ]
    };
    
    bybitWs.send(JSON.stringify(subscribeMsg));
    
    // 핑 메시지 (연결 유지)
    setInterval(() => {
      if (bybitWs.readyState === WebSocket.OPEN) {
        bybitWs.send(JSON.stringify({ op: "ping" }));
      }
    }, 20000);
  });
  
  bybitWs.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.topic) {
        handleBybitMessage(message);
      }
    } catch (error) {
      console.error('Error parsing Bybit message:', error);
    }
  });
  
  bybitWs.on('close', () => {
    console.log('Bybit WebSocket disconnected, reconnecting...');
    setTimeout(connectBybit, 5000);
  });
  
  bybitWs.on('error', (error) => {
    console.error('Bybit WebSocket error:', error);
  });
}

// 바이비트 메시지 처리
function handleBybitMessage(message) {
  const { topic, data } = message;
  
  if (topic.includes('tickers')) {
    // 티커 데이터 업데이트
    if (data && data[0]) {
      const ticker = data[0];
      marketData.ticker = {
        last: parseFloat(ticker.lastPrice),
        change24h: parseFloat(ticker.price24hPcnt) * 100,
        changePercent: parseFloat(ticker.price24hPcnt) * 100,
        volume24h: parseFloat(ticker.volume24h),
        high24h: parseFloat(ticker.highPrice24h),
        low24h: parseFloat(ticker.lowPrice24h)
      };
      
      // 모든 클라이언트에게 전송
      broadcastToAll({
        type: 'ticker',
        data: marketData.ticker
      });
    }
  } else if (topic.includes('orderbook')) {
    // 오더북 데이터 업데이트
    if (data) {
      const orderbook = {
        bids: data.b ? data.b.slice(0, 20).map(([price, size]) => ({
          price: parseFloat(price),
          size: parseFloat(size)
        })) : marketData.orderbook.bids,
        asks: data.a ? data.a.slice(0, 20).map(([price, size]) => ({
          price: parseFloat(price),
          size: parseFloat(size)
        })) : marketData.orderbook.asks
      };
      
      marketData.orderbook = orderbook;
      
      broadcastToAll({
        type: 'orderbook',
        data: marketData.orderbook
      });
    }
  } else if (topic.includes('kline')) {
    // 캔들 데이터 업데이트
    if (data && data[0]) {
      const candle = data[0];
      const newCandle = {
        time: Math.floor(candle.start / 1000),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume)
      };
      
      // 최신 캔들 업데이트 또는 추가
      const lastCandle = marketData.candles[marketData.candles.length - 1];
      if (lastCandle && lastCandle.time === newCandle.time) {
        marketData.candles[marketData.candles.length - 1] = newCandle;
      } else {
        marketData.candles.push(newCandle);
        // 최대 200개 캔들 유지
        if (marketData.candles.length > 200) {
          marketData.candles.shift();
        }
      }
      
      broadcastToAll({
        type: 'candles',
        data: marketData.candles
      });
    }
  }
  
  marketData.lastUpdate = Date.now();
}

// 초기 캔들 데이터 로드
async function loadInitialCandles() {
  try {
    const response = await axios.get(`${BYBIT_REST_URL}/v5/market/kline`, {
      params: {
        category: 'linear',
        symbol: 'BTCUSDT',
        interval: '1',
        limit: 200
      }
    });
    
    if (response.data.result && response.data.result.list) {
      marketData.candles = response.data.result.list
        .map(candle => ({
          time: Math.floor(parseInt(candle[0]) / 1000),
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5])
        }))
        .reverse();
    }
  } catch (error) {
    console.error('Error loading initial candles:', error);
  }
}

// 모든 클라이언트에게 브로드캐스트
function broadcastToAll(message) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

// 특정 클라이언트에게 전송
function sendToClient(clientId, message) {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

// 사용자 초기화
function initUser(userId) {
  if (!mockData.users.has(userId)) {
    mockData.users.set(userId, {
      balance: { USDT: 10000, BTC: 0 },
      positions: [],
      orders: [],
      totalPnL: 0,
      trades: []
    });
  }
  return mockData.users.get(userId);
}

// 주문 처리
function processOrder(userId, orderData) {
  const user = mockData.users.get(userId);
  if (!user) return { success: false, message: 'User not found' };
  
  const { symbol, side, orderType, quantity, price, leverage } = orderData;
  const currentPrice = marketData.ticker.last;
  
  // 시장가 주문 즉시 체결
  if (orderType === 'market') {
    const requiredMargin = (quantity * currentPrice) / leverage;
    
    if (user.balance.USDT < requiredMargin) {
      return { success: false, message: 'Insufficient balance' };
    }
    
    // 잔고 차감
    user.balance.USDT -= requiredMargin;
    
    // 포지션 생성/업데이트
    const positionId = uuidv4();
    const position = {
      id: positionId,
      userId,
      symbol,
      side,
      quantity,
      entryPrice: currentPrice,
      leverage,
      margin: requiredMargin,
      pnl: 0,
      createdAt: Date.now()
    };
    
    mockData.positions.set(positionId, position);
    user.positions.push(positionId);
    
    // 클라이언트에게 업데이트 전송
    updateClientPositions(userId);
    updateClientBalance(userId);
    
    return { success: true, position };
    
  } else if (orderType === 'limit') {
    // 지정가 주문 생성
    const orderId = uuidv4();
    const order = {
      id: orderId,
      userId,
      symbol,
      side,
      orderType,
      quantity,
      price,
      leverage,
      status: 'pending',
      createdAt: Date.now()
    };
    
    mockData.orders.set(orderId, order);
    user.orders.push(orderId);
    
    // 클라이언트에게 업데이트 전송
    updateClientOrders(userId);
    
    // 즉시 체결 가능한지 확인
    checkOrderExecution(orderId);
    
    return { success: true, order };
  }
}

// 주문 체결 확인 (지정가)
function checkOrderExecution(orderId) {
  const order = mockData.orders.get(orderId);
  if (!order || order.status !== 'pending') return;
  
  const currentPrice = marketData.ticker.last;
  
  // 매수 주문: 현재가가 지정가 이하
  // 매도 주문: 현재가가 지정가 이상
  const shouldExecute = 
    (order.side === 'buy' && currentPrice <= order.price) ||
    (order.side === 'sell' && currentPrice >= order.price);
  
  if (shouldExecute) {
    executeOrder(orderId);
  }
}

// 주문 체결
function executeOrder(orderId) {
  const order = mockData.orders.get(orderId);
  if (!order) return;
  
  const user = mockData.users.get(order.userId);
  if (!user) return;
  
  const requiredMargin = (order.quantity * order.price) / order.leverage;
  
  if (user.balance.USDT < requiredMargin) {
    // 잔고 부족으로 주문 취소
    order.status = 'cancelled';
    return;
  }
  
  // 잔고 차감
  user.balance.USDT -= requiredMargin;
  
  // 포지션 생성
  const positionId = uuidv4();
  const position = {
    id: positionId,
    userId: order.userId,
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity,
    entryPrice: order.price,
    leverage: order.leverage,
    margin: requiredMargin,
    pnl: 0,
    createdAt: Date.now()
  };
  
  mockData.positions.set(positionId, position);
  user.positions.push(positionId);
  
  // 주문 상태 업데이트
  order.status = 'filled';
  
  // 클라이언트 업데이트
  updateClientPositions(order.userId);
  updateClientBalance(order.userId);
  updateClientOrders(order.userId);
}

// 포지션 종료
function closePosition(userId, positionId) {
  const position = mockData.positions.get(positionId);
  if (!position || position.userId !== userId) {
    return { success: false, message: 'Position not found' };
  }
  
  const user = mockData.users.get(userId);
  if (!user) return { success: false, message: 'User not found' };
  
  const currentPrice = marketData.ticker.last;
  
  // PnL 계산
  let pnl = 0;
  if (position.side === 'buy') {
    pnl = (currentPrice - position.entryPrice) * position.quantity;
  } else {
    pnl = (position.entryPrice - currentPrice) * position.quantity;
  }
  
  // 잔고 업데이트 (마진 + PnL)
  user.balance.USDT += position.margin + pnl;
  user.totalPnL += pnl;
  
  // 포지션 제거
  user.positions = user.positions.filter(id => id !== positionId);
  mockData.positions.delete(positionId);
  
  // 거래 기록 추가
  user.trades.push({
    id: uuidv4(),
    positionId,
    side: position.side,
    quantity: position.quantity,
    entryPrice: position.entryPrice,
    exitPrice: currentPrice,
    pnl,
    closedAt: Date.now()
  });
  
  // 클라이언트 업데이트
  updateClientPositions(userId);
  updateClientBalance(userId);
  
  return { success: true, pnl };
}

// 주문 취소
function cancelOrder(userId, orderId) {
  const order = mockData.orders.get(orderId);
  if (!order || order.userId !== userId) {
    return { success: false, message: 'Order not found' };
  }
  
  if (order.status !== 'pending') {
    return { success: false, message: 'Order cannot be cancelled' };
  }
  
  const user = mockData.users.get(userId);
  if (!user) return { success: false, message: 'User not found' };
  
  // 주문 상태 업데이트
  order.status = 'cancelled';
  
  // 사용자 주문 목록에서 제거
  user.orders = user.orders.filter(id => id !== orderId);
  
  // 클라이언트 업데이트
  updateClientOrders(userId);
  
  return { success: true };
}

// 클라이언트 업데이트 함수들
function updateClientPositions(userId) {
  const user = mockData.users.get(userId);
  if (!user) return;
  
  const positions = user.positions
    .map(id => mockData.positions.get(id))
    .filter(pos => pos)
    .map(pos => {
      const currentPrice = marketData.ticker.last;
      let pnl = 0;
      
      if (pos.side === 'buy') {
        pnl = (currentPrice - pos.entryPrice) * pos.quantity;
      } else {
        pnl = (pos.entryPrice - currentPrice) * pos.quantity;
      }
      
      return { ...pos, pnl, currentPrice };
    });
  
  sendToClient(userId, {
    type: 'position_update',
    data: positions
  });
}

function updateClientBalance(userId) {
  const user = mockData.users.get(userId);
  if (!user) return;
  
  sendToClient(userId, {
    type: 'balance_update',
    data: user.balance
  });
}

function updateClientOrders(userId) {
  const user = mockData.users.get(userId);
  if (!user) return;
  
  const orders = user.orders
    .map(id => mockData.orders.get(id))
    .filter(order => order && order.status === 'pending');
  
  sendToClient(userId, {
    type: 'order_update',
    data: orders
  });
}

// 모든 포지션 PnL 업데이트 (정기적으로 실행)
function updateAllPositionsPnL() {
  mockData.positions.forEach((position) => {
    updateClientPositions(position.userId);
  });
  
  // 지정가 주문 체결 확인
  mockData.orders.forEach((order) => {
    if (order.status === 'pending') {
      checkOrderExecution(order.id);
    }
  });
}

// WebSocket 클라이언트 연결 처리
wss.on('connection', (ws) => {
  const clientId = uuidv4();
  const client = {
    id: clientId,
    ws,
    userId: clientId, // 간단하게 clientId를 userId로 사용
    subscriptions: []
  };
  
  clients.set(clientId, client);
  console.log(`Client connected: ${clientId}`);
  
  // 사용자 초기화
  initUser(clientId);
  
  // 초기 데이터 전송
  ws.send(JSON.stringify({
    type: 'connection',
    data: { clientId, message: 'Connected to mock trading server' }
  }));
  
  // 현재 시장 데이터 전송
  ws.send(JSON.stringify({ type: 'ticker', data: marketData.ticker }));
  ws.send(JSON.stringify({ type: 'orderbook', data: marketData.orderbook }));
  ws.send(JSON.stringify({ type: 'candles', data: marketData.candles }));
  
  // 사용자 데이터 전송
  updateClientBalance(clientId);
  updateClientPositions(clientId);
  updateClientOrders(clientId);
  
  // 메시지 처리
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      handleClientMessage(clientId, data);
    } catch (error) {
      console.error('Error parsing client message:', error);
    }
  });
  
  // 연결 종료
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId}`);
  });
  
  // 에러 처리
  ws.on('error', (error) => {
    console.error(`Client error ${clientId}:`, error);
  });
});

// 클라이언트 메시지 처리
function handleClientMessage(clientId, message) {
  const { type, data } = message;
  
  switch (type) {
    case 'subscribe':
      // 구독 처리 (이미 자동으로 전송 중)
      break;
      
    case 'place_order':
      const orderResult = processOrder(clientId, data);
      sendToClient(clientId, {
        type: 'order_response',
        data: orderResult
      });
      break;
      
    case 'close_position':
      const closeResult = closePosition(clientId, data.positionId);
      sendToClient(clientId, {
        type: 'close_position_response',
        data: closeResult
      });
      break;
      
    case 'cancel_order':
      const cancelResult = cancelOrder(clientId, data.orderId);
      sendToClient(clientId, {
        type: 'cancel_order_response',
        data: cancelResult
      });
      break;
      
    case 'get_balance':
      updateClientBalance(clientId);
      break;
      
    case 'get_positions':
      updateClientPositions(clientId);
      break;
      
    case 'get_orders':
      updateClientOrders(clientId);
      break;
      
    default:
      console.log(`Unknown message type: ${type}`);
  }
}

// 초기화
async function init() {
  await loadInitialCandles();
  connectBybit();
  
  // PnL 업데이트 (1초마다)
  setInterval(updateAllPositionsPnL, 1000);
  
  console.log('Mock trading server initialized');
}

// Express 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    clients: clients.size,
    marketData: {
      lastUpdate: marketData.lastUpdate,
      ticker: marketData.ticker
    }
  });
});

app.listen(PORT + 1, () => {
  console.log(`HTTP server running on port ${PORT + 1}`);
});

// 서버 시작
init();