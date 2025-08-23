// 간단한 테스트 서버 - CPU 문제 확인용
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// 기본 미들웨어
app.use(express.json());

// 테스트 엔드포인트
app.get('/', (req, res) => {
  res.json({ 
    message: 'Test server running',
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// 서버 시작
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
