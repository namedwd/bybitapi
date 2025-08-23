module.exports = {
  // 서버 설정
  server: {
    wsPort: parseInt(process.env.WS_PORT) || 8080,
    httpPort: parseInt(process.env.HTTP_PORT) || 8081,
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000'
    }
  },
  
  // Bybit API 설정
  bybit: {
    wsUrl: process.env.BYBIT_WS_URL || 'wss://stream.bybit.com/v5/public/linear',
    restUrl: process.env.BYBIT_REST_URL || 'https://api.bybit.com',
    defaultSymbol: process.env.DEFAULT_SYMBOL || 'BTCUSDT',
    subscriptions: {
      ticker: true,
      orderbook: true,
      kline: true
    }
  },
  
  // 트레이딩 설정
  trading: {
    initialBalance: {
      USDT: parseFloat(process.env.INITIAL_BALANCE_USDT || 10000),
      BTC: parseFloat(process.env.INITIAL_BALANCE_BTC || 0)
    },
    defaultLeverage: parseInt(process.env.DEFAULT_LEVERAGE || 10),
    maxLeverage: parseInt(process.env.MAX_LEVERAGE || 100),
    minOrderAmount: parseFloat(process.env.MIN_ORDER_AMOUNT || 0.001),
    maxPositions: parseInt(process.env.MAX_POSITIONS || 10)
  },
  
  // 업데이트 주기
  intervals: {
    pnlUpdate: parseInt(process.env.PNL_UPDATE_INTERVAL || 5000),
    ping: parseInt(process.env.PING_INTERVAL || 20000),
    reconnect: parseInt(process.env.RECONNECT_INTERVAL || 5000)
  },
  
  // 데이터 설정
  data: {
    maxCandles: parseInt(process.env.MAX_CANDLES || 200),
    maxOrderbookLevels: parseInt(process.env.MAX_ORDERBOOK_LEVELS || 20),
    candleInterval: process.env.CANDLE_INTERVAL || '1' // 1분봉
  }
};
