const WebSocket = require('ws');
const crypto = require('crypto');

class WebSocketService {
  constructor() {
    this.ws = null;
    this.subscriptions = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.pingInterval = null;
    this.apiKey = process.env.BYBIT_API_KEY;
    this.apiSecret = process.env.BYBIT_API_SECRET;
    this.wsUrl = process.env.BYBIT_TESTNET === 'true'
      ? 'wss://stream-testnet.bybit.com/v5/private'
      : 'wss://stream.bybit.com/v5/private';
  }

  generateAuthSignature() {
    const expires = Date.now() + 10000;
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(`GET/realtime${expires}`)
      .digest('hex');
    return { expires, signature };
  }

  initialize() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.authenticate();
        this.startPing();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      this.ws.on('close', () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.stopPing();
        this.attemptReconnect();
      });

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.attemptReconnect();
    }
  }

  authenticate() {
    if (!this.apiKey || !this.apiSecret) {
      console.log('No API credentials provided, using public WebSocket');
      return;
    }

    const { expires, signature } = this.generateAuthSignature();
    const authMessage = {
      op: 'auth',
      args: [this.apiKey, expires, signature]
    };
    
    this.send(authMessage);
  }

  handleMessage(message) {
    try {
      const data = JSON.parse(message);
      
      // Handle auth response
      if (data.op === 'auth') {
        if (data.success) {
          console.log('WebSocket authenticated successfully');
          this.resubscribeAll();
        } else {
          console.error('WebSocket authentication failed:', data.ret_msg);
        }
        return;
      }

      // Handle pong
      if (data.op === 'pong') {
        return;
      }

      // Handle subscription response
      if (data.op === 'subscribe') {
        if (data.success) {
          console.log('Subscription successful:', data.req_id);
        } else {
          console.error('Subscription failed:', data.ret_msg);
        }
        return;
      }

      // Handle data updates
      if (data.topic && data.data) {
        const callbacks = this.subscriptions.get(data.topic);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback(data.data);
            } catch (error) {
              console.error('Error in subscription callback:', error);
            }
          });
        }
      }

    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  subscribe(topic, callback) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      
      if (this.isConnected) {
        this.send({
          op: 'subscribe',
          args: [topic]
        });
      }
    }
    
    this.subscriptions.get(topic).add(callback);
    
    return () => this.unsubscribe(topic, callback);
  }

  unsubscribe(topic, callback) {
    const callbacks = this.subscriptions.get(topic);
    if (callbacks) {
      callbacks.delete(callback);
      
      if (callbacks.size === 0) {
        this.subscriptions.delete(topic);
        
        if (this.isConnected) {
          this.send({
            op: 'unsubscribe',
            args: [topic]
          });
        }
      }
    }
  }

  resubscribeAll() {
    for (const topic of this.subscriptions.keys()) {
      this.send({
        op: 'subscribe',
        args: [topic]
      });
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  startPing() {
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ op: 'ping' });
      }
    }, 20000); // Ping every 20 seconds
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.subscriptions.clear();
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

module.exports = new WebSocketService();
