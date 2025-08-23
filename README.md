# Bybit API Server

AWS Lightsail에서 실행되는 Bybit API 서버입니다.

## 기능

- Bybit REST API 통합
- WebSocket 실시간 데이터 스트리밍
- 보안 (CORS, Rate Limiting, Helmet)
- PM2를 통한 프로세스 관리

## 설치

1. 의존성 설치:
```bash
npm install
```

2. 환경 변수 설정:
```bash
cp .env.example .env
```
`.env` 파일을 열고 Bybit API 키와 시크릿을 입력하세요.

## 실행

### 개발 환경:
```bash
npm run dev
```

### 프로덕션 환경 (PM2):
```bash
# PM2 설치 (전역)
npm install -g pm2

# 서버 시작
pm2 start ecosystem.config.js

# 로그 확인
pm2 logs bybit-api-server

# 서버 중지
pm2 stop bybit-api-server

# 서버 재시작
pm2 restart bybit-api-server

# 서버 상태 확인
pm2 status
```

## AWS Lightsail 배포

1. Lightsail 인스턴스에 SSH 접속
2. Node.js 및 npm 설치
3. 코드 클론 또는 업로드
4. 의존성 설치: `npm install`
5. 환경 변수 설정
6. PM2로 서버 시작: `pm2 start ecosystem.config.js`
7. PM2 시작 스크립트 설정: `pm2 startup` 및 `pm2 save`

## API 엔드포인트

### Account
- `GET /api/bybit/balance` - 계정 잔고 조회
- `GET /api/bybit/fee-rate` - 수수료율 조회

### Positions
- `GET /api/bybit/positions` - 포지션 조회

### Orders
- `POST /api/bybit/order` - 주문 생성
- `DELETE /api/bybit/order/:orderId` - 주문 취소
- `GET /api/bybit/orders/open` - 미체결 주문 조회
- `GET /api/bybit/orders/history` - 주문 내역 조회

### Market Data
- `GET /api/bybit/kline` - K선 데이터 조회
- `GET /api/bybit/tickers` - 티커 정보 조회
- `GET /api/bybit/orderbook` - 오더북 조회

### Trading Settings
- `POST /api/bybit/leverage` - 레버리지 설정

### Health Check
- `GET /health` - 서버 상태 확인

## 보안 설정

- CORS 설정: `.env`의 `ALLOWED_ORIGINS`
- Rate Limiting: 15분당 100 요청 제한
- Helmet.js를 통한 보안 헤더

## 로그

PM2를 사용하는 경우 로그는 `logs/` 디렉토리에 저장됩니다:
- `error.log` - 에러 로그
- `out.log` - 표준 출력 로그
- `combined.log` - 통합 로그

## 문제 해결

1. **포트 충돌**: `.env`에서 `PORT` 값 변경
2. **API 인증 실패**: API 키와 시크릿 확인
3. **WebSocket 연결 실패**: 방화벽 설정 확인

## 라이선스

ISC
