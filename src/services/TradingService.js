const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class TradingService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.users = new Map();
    this.positions = new Map();
    this.orders = new Map();
  }
  
  createUser(userId) {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        id: userId,
        balance: { ...this.config.trading.initialBalance },
        positions: [],
        orders: [],
        trades: [],
        totalPnL: 0,
        createdAt: Date.now()
      });
    }
    return this.users.get(userId);
  }
  
  getUser(userId) {
    return this.users.get(userId);
  }
  
  placeOrder(userId, orderData) {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    // 주문 유효성 검사
    const validation = this.validateOrder(user, orderData);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // 주문 처리
    if (orderData.orderType === 'market') {
      return this.executeMarketOrder(user, orderData);
    } else {
      return this.placeLimitOrder(user, orderData);
    }
  }
  
  validateOrder(user, orderData) {
    const { quantity, leverage, price } = orderData;
    
    // 최소 주문 수량 확인
    if (quantity < this.config.trading.minOrderAmount) {
      return { valid: false, error: 'Order amount too small' };
    }
    
    // 레버리지 확인
    if (leverage > this.config.trading.maxLeverage) {
      return { valid: false, error: 'Leverage too high' };
    }
    
    // 포지션 개수 확인
    const openPositions = user.positions.filter(id => {
      const pos = this.positions.get(id);
      return pos && pos.status === 'open';
    });
    
    if (openPositions.length >= this.config.trading.maxPositions) {
      return { valid: false, error: 'Maximum positions reached' };
    }
    
    return { valid: true };
  }
  
  executeMarketOrder(user, orderData) {
    const currentPrice = orderData.currentPrice || 0;
    const requiredMargin = (orderData.quantity * currentPrice) / orderData.leverage;
    
    if (user.balance.USDT < requiredMargin) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    // 잔고 차감
    user.balance.USDT -= requiredMargin;
    
    // 포지션 생성
    const positionId = uuidv4();
    const position = {
      id: positionId,
      userId: user.id,
      symbol: orderData.symbol,
      side: orderData.side,
      quantity: orderData.quantity,
      entryPrice: currentPrice,
      leverage: orderData.leverage,
      margin: requiredMargin,
      pnl: 0,
      status: 'open',
      createdAt: Date.now()
    };
    
    this.positions.set(positionId, position);
    user.positions.push(positionId);
    
    this.emit('positionOpened', { userId: user.id, position });
    this.emit('balanceUpdated', { userId: user.id, balance: user.balance });
    
    return { success: true, position };
  }
  
  placeLimitOrder(user, orderData) {
    const orderId = uuidv4();
    const order = {
      id: orderId,
      userId: user.id,
      symbol: orderData.symbol,
      side: orderData.side,
      orderType: 'limit',
      quantity: orderData.quantity,
      price: orderData.price,
      leverage: orderData.leverage,
      status: 'pending',
      createdAt: Date.now()
    };
    
    this.orders.set(orderId, order);
    user.orders.push(orderId);
    
    this.emit('orderPlaced', { userId: user.id, order });
    
    return { success: true, order };
  }
  
  checkPendingOrders(currentPrice) {
    this.orders.forEach((order, orderId) => {
      if (order.status !== 'pending') return;
      
      const shouldExecute = 
        (order.side === 'buy' && currentPrice <= order.price) ||
        (order.side === 'sell' && currentPrice >= order.price);
      
      if (shouldExecute) {
        this.executeLimitOrder(orderId, currentPrice);
      }
    });
  }
  
  executeLimitOrder(orderId, currentPrice) {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'pending') return;
    
    const user = this.users.get(order.userId);
    if (!user) return;
    
    const requiredMargin = (order.quantity * order.price) / order.leverage;
    
    if (user.balance.USDT < requiredMargin) {
      order.status = 'cancelled';
      this.emit('orderCancelled', { userId: user.id, orderId });
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
      status: 'open',
      createdAt: Date.now()
    };
    
    this.positions.set(positionId, position);
    user.positions.push(positionId);
    
    // 주문 상태 업데이트
    order.status = 'filled';
    order.filledAt = Date.now();
    
    this.emit('orderFilled', { userId: user.id, order, position });
    this.emit('balanceUpdated', { userId: user.id, balance: user.balance });
  }
  
  updatePositionsPnL(currentPrice) {
    this.positions.forEach((position) => {
      if (position.status !== 'open') return;
      
      const pnl = this.calculatePnL(position, currentPrice);
      position.pnl = pnl;
      position.currentPrice = currentPrice;
      
      const user = this.users.get(position.userId);
      if (user) {
        this.emit('positionUpdated', { 
          userId: position.userId, 
          positions: this.getUserPositions(position.userId) 
        });
      }
    });
  }
  
  calculatePnL(position, currentPrice) {
    const { side, quantity, entryPrice } = position;
    
    if (side === 'buy') {
      return (currentPrice - entryPrice) * quantity;
    } else {
      return (entryPrice - currentPrice) * quantity;
    }
  }
  
  closePosition(userId, positionId) {
    const position = this.positions.get(positionId);
    if (!position || position.userId !== userId || position.status !== 'open') {
      return { success: false, error: 'Position not found or already closed' };
    }
    
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    const currentPrice = position.currentPrice || position.entryPrice;
    const pnl = this.calculatePnL(position, currentPrice);
    
    // 잔고 업데이트 (마진 + PnL)
    user.balance.USDT += position.margin + pnl;
    user.totalPnL += pnl;
    
    // 포지션 상태 업데이트
    position.status = 'closed';
    position.closedAt = Date.now();
    position.exitPrice = currentPrice;
    position.realizedPnL = pnl;
    
    // 거래 기록 추가
    const trade = {
      id: uuidv4(),
      positionId,
      userId,
      symbol: position.symbol,
      side: position.side,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      pnl,
      closedAt: Date.now()
    };
    user.trades.push(trade);
    
    this.emit('positionClosed', { userId, position, pnl });
    this.emit('balanceUpdated', { userId, balance: user.balance });
    
    return { success: true, pnl };
  }
  
  cancelOrder(userId, orderId) {
    const order = this.orders.get(orderId);
    if (!order || order.userId !== userId) {
      return { success: false, error: 'Order not found' };
    }
    
    if (order.status !== 'pending') {
      return { success: false, error: 'Order cannot be cancelled' };
    }
    
    order.status = 'cancelled';
    order.cancelledAt = Date.now();
    
    this.emit('orderCancelled', { userId, orderId });
    
    return { success: true };
  }
  
  getUserPositions(userId) {
    const user = this.users.get(userId);
    if (!user) return [];
    
    return user.positions
      .map(id => this.positions.get(id))
      .filter(pos => pos && pos.status === 'open');
  }
  
  getUserOrders(userId) {
    const user = this.users.get(userId);
    if (!user) return [];
    
    return user.orders
      .map(id => this.orders.get(id))
      .filter(order => order && order.status === 'pending');
  }
  
  getUserBalance(userId) {
    const user = this.users.get(userId);
    return user ? user.balance : null;
  }
}

module.exports = TradingService;
