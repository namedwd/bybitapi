const WebSocket = require('ws');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class WebSocketService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.clients = new Map();
    this.wss = null;
  }
  
  start() {
    this.wss = new WebSocket.Server({ port: this.config.server.wsPort });
    
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      this.handleNewClient(clientId, ws);
    });
    
    console.log(`WebSocket server started on port ${this.config.server.wsPort}`);
  }
  
  handleNewClient(clientId, ws) {
    const client = {
      id: clientId,
      ws,
      userId: clientId, // 간단하게 clientId를 userId로 사용
      subscriptions: new Set()
    };
    
    this.clients.set(clientId, client);
    
    ws.on('message', (message) => {
      this.handleMessage(clientId, message);
    });
    
    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });
    
    ws.on('error', (error) => {
      console.error(`Client ${clientId} error:`, error.message);
    });
    
    // 초기 연결 확인
    this.sendToClient(clientId, {
      type: 'connection',
      data: { clientId, message: 'Connected to mock trading server' }
    });
    
    this.emit('clientConnected', clientId);
  }
  
  handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message.toString());
      this.emit('message', { clientId, ...data });
    } catch (error) {
      console.error('Invalid message format:', error);
    }
  }
  
  handleDisconnect(clientId) {
    this.emit('clientDisconnected', clientId);
    this.clients.delete(clientId);
    console.log(`Client disconnected: ${clientId}`);
  }
  
  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }
  
  broadcast(data, filter = null) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (!filter || filter(client)) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message);
        }
      }
    });
  }
  
  broadcastToAll(data) {
    this.broadcast(data);
  }
  
  generateClientId() {
    return uuidv4();
  }
  
  getClient(clientId) {
    return this.clients.get(clientId);
  }
  
  getClientCount() {
    return this.clients.size;
  }
}

module.exports = WebSocketService;
