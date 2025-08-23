# Bybit Mock Trading Server

## Description
Mock trading server for cryptocurrency trading simulation using Bybit market data.

## Features
- Real-time market data from Bybit
- Mock trading with virtual balance
- WebSocket connections for real-time updates
- Position management
- Order management (Market & Limit orders)

## Requirements
- Node.js 16+
- npm or yarn

## Installation

1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/bybit-mock-server.git
cd bybit-mock-server
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Run the server
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables
See `.env.example` for all available options.

## API Endpoints
- WebSocket: `ws://localhost:8080`
- HTTP Health Check: `http://localhost:8081/health`
- Config: `http://localhost:8081/config`

## License
MIT
