const WebSocket = require('ws');
const axios = require('axios');
const EventEmitter = require('events');

class BybitService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.ws = null;
    this.pingInterval = null;
    this.reconnectTimeout = null;
    this.marketData = {
      ticker: { last: 0, change24h: 0, changePercent: 0 },
      orderbook: { bids: [], asks: [] },
      candles: [],
      lastUpdate: Date.now()
    };
  }
  
  async initialize() {
    await this.loadInitialCandles();
    this.connect();
  }
  
  connect() {
    try {
      // 기존 연결 정리
      this.cleanup();
      
      this.ws = new WebSocket(this.config.bybit.wsUrl);
      
      this.ws.on('open', () => {
        console.log('Connected to Bybit WebSocket');
        this.subscribe();
        this.startPing();
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });
      
      this.ws.on('close', () => {
        console.log('Bybit WebSocket disconnected, reconnecting...');
        this.scheduleReconnect();
      });
      
      this.ws.on('error', (error) => {
        console.error('Bybit WebSocket error:', error.message);
      });
      
    } catch (error) {
      console.error('Error in connect:', error.message);
      this.scheduleReconnect();
    }
  }
  
  cleanup() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  subscribe() {
    const symbol = this.config.bybit.defaultSymbol;
    const subscriptions = [];
    
    if (this.config.bybit.subscriptions.ticker) {
      subscriptions.push(`tickers.${symbol}`);
    }
    if (this.config.bybit.subscriptions.orderbook) {
      subscriptions.push(`orderbook.50.${symbol}`);
    }
    if (this.config.bybit.subscriptions.kline) {
      subscriptions.push(`kline.${this.config.data.candleInterval}.${symbol}`);
    }
    
    const subscribeMsg = {
      op: "subscribe",
      args: subscriptions
    };
    
    this.ws.send(JSON.stringify(subscribeMsg));
  }
  
  startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: "ping" }));
      }
    }, this.config.intervals.ping);
  }
  
  scheduleReconnect() {
    this.cleanup();
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, this.config.intervals.reconnect);
  }
  
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.topic) {
        this.processMarketData(message);
      }
    } catch (error) {
      console.error('Error parsing Bybit message:', error);
    }
  }
  
  processMarketData(message) {
    const { topic, data } = message;
    
    if (topic.includes('tickers')) {
      this.processTicker(data);
    } else if (topic.includes('orderbook')) {
      this.processOrderbook(data);
    } else if (topic.includes('kline')) {
      this.processKline(data);
    }
    
    this.marketData.lastUpdate = Date.now();
  }
  
  processTicker(data) {
    if (data && data[0]) {
      const ticker = data[0];
      
      this.marketData.ticker = {
        last: parseFloat(ticker.lastPrice || ticker.last_price || ticker.markPrice || 0),
        change24h: parseFloat(ticker.price24hPcnt || ticker.price_24h_pcnt || 0) * 100,
        changePercent: parseFloat(ticker.price24hPcnt || ticker.price_24h_pcnt || 0) * 100,
        volume24h: parseFloat(ticker.volume24h || ticker.volume_24h || ticker.turnover24h || 0),
        high24h: parseFloat(ticker.highPrice24h || ticker.high_price_24h || ticker.prevPrice24h || 0),
        low24h: parseFloat(ticker.lowPrice24h || ticker.low_price_24h || 0)
      };
      
      this.emit('ticker', this.marketData.ticker);
    }
  }
  
  processOrderbook(data) {
    if (!data) return;
    
    const isSnapshot = data.type === 'snapshot';
    
    if (isSnapshot) {
      this.marketData.orderbook = {
        bids: data.b ? data.b.slice(0, this.config.data.maxOrderbookLevels).map(([price, size]) => ({
          price: parseFloat(price),
          size: parseFloat(size)
        })) : [],
        asks: data.a ? data.a.slice(0, this.config.data.maxOrderbookLevels).map(([price, size]) => ({
          price: parseFloat(price),
          size: parseFloat(size)
        })) : []
      };
    } else {
      // Delta 업데이트 처리
      this.updateOrderbook(data);
    }
    
    if (this.marketData.orderbook.bids.length > 0 || this.marketData.orderbook.asks.length > 0) {
      this.emit('orderbook', this.marketData.orderbook);
    }
  }
  
  updateOrderbook(data) {
    // 매수 호가 업데이트
    if (data.b) {
      const bidMap = new Map(this.marketData.orderbook.bids.map(b => [b.price, b]));
      data.b.forEach(([price, size]) => {
        const p = parseFloat(price);
        const s = parseFloat(size);
        if (s === 0) {
          bidMap.delete(p);
        } else {
          bidMap.set(p, { price: p, size: s });
        }
      });
      this.marketData.orderbook.bids = Array.from(bidMap.values())
        .sort((a, b) => b.price - a.price)
        .slice(0, this.config.data.maxOrderbookLevels);
    }
    
    // 매도 호가 업데이트
    if (data.a) {
      const askMap = new Map(this.marketData.orderbook.asks.map(a => [a.price, a]));
      data.a.forEach(([price, size]) => {
        const p = parseFloat(price);
        const s = parseFloat(size);
        if (s === 0) {
          askMap.delete(p);
        } else {
          askMap.set(p, { price: p, size: s });
        }
      });
      this.marketData.orderbook.asks = Array.from(askMap.values())
        .sort((a, b) => a.price - b.price)
        .slice(0, this.config.data.maxOrderbookLevels);
    }
  }
  
  processKline(data) {
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
      const lastCandle = this.marketData.candles[this.marketData.candles.length - 1];
      if (lastCandle && lastCandle.time === newCandle.time) {
        this.marketData.candles[this.marketData.candles.length - 1] = newCandle;
      } else {
        this.marketData.candles.push(newCandle);
        if (this.marketData.candles.length > this.config.data.maxCandles) {
          this.marketData.candles.shift();
        }
      }
      
      this.emit('candles', this.marketData.candles);
    }
  }
  
  async loadInitialCandles() {
    try {
      const response = await axios.get(`${this.config.bybit.restUrl}/v5/market/kline`, {
        params: {
          category: 'linear',
          symbol: this.config.bybit.defaultSymbol,
          interval: this.config.data.candleInterval,
          limit: this.config.data.maxCandles
        },
        timeout: 10000
      });
      
      if (response.data.result && response.data.result.list) {
        this.marketData.candles = response.data.result.list
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
      console.error('Error loading initial candles:', error.message);
    }
  }
  
  getMarketData() {
    return this.marketData;
  }
  
  getCurrentPrice() {
    return this.marketData.ticker.last;
  }
  
  destroy() {
    this.cleanup();
  }
}

module.exports = BybitService;
