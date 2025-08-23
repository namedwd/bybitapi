const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
});

// Initialize routes with try-catch to prevent circular dependency
let bybitRouter;
let websocketService;

try {
  bybitRouter = require('./routes/bybit');
  app.use('/api/bybit', bybitRouter);
} catch (error) {
  console.error('Failed to load bybit router:', error.message);
  // Create a fallback route
  app.use('/api/bybit', (req, res) => {
    res.status(503).json({ error: 'Bybit service temporarily unavailable' });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Bybit API Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Memory usage:`, process.memoryUsage());
  
  // Initialize WebSocket connection if enabled (with delay to prevent startup surge)
  if (process.env.ENABLE_WEBSOCKET === 'true') {
    setTimeout(() => {
      try {
        websocketService = require('./services/websocket');
        websocketService.initialize();
        console.log('WebSocket service initialized');
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error.message);
      }
    }, 5000); // 5 second delay
  }
});

// Set server timeout
server.timeout = 30000; // 30 seconds

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close WebSocket if connected
    if (websocketService && websocketService.isConnected && websocketService.isConnected()) {
      websocketService.disconnect();
      console.log('WebSocket disconnected');
    }
    
    console.log('Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Memory usage monitoring
setInterval(() => {
  const used = process.memoryUsage();
  const usage = {
    rss: `${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024 * 100) / 100} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`,
    external: `${Math.round(used.external / 1024 / 1024 * 100) / 100} MB`
  };
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('Memory usage:', usage);
  }
  
  // Trigger garbage collection if heap usage is too high (over 400MB)
  if (used.heapUsed > 400 * 1024 * 1024) {
    if (global.gc) {
      global.gc();
      console.log('Manual garbage collection triggered');
    }
  }
}, 60000); // Check every minute

module.exports = app;
