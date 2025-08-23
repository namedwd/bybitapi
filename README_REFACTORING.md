# 모의투자 웹사이트 - 개선된 구조

## 변경 사항

### 백엔드 (bybitapi 폴더)
- 모든 하드코딩된 값들을 환경 변수와 설정 파일로 분리
- 서비스 기반 아키텍처로 리팩토링
- 코드 모듈화 및 재사용성 향상

### 프론트엔드 (vv 폴더)
- React Hooks 패턴으로 로직 분리
- 컴포넌트 모듈화
- 설정 파일 중앙화

## 실행 방법

### 백엔드 서버 실행
```bash
cd bybitapi

# 새로운 구조로 실행
npm run dev

# 기존 서버 실행 (필요시)
npm run dev:old
```

### 프론트엔드 실행
```bash
cd vv

# 개발 서버 실행
npm run dev
```

새로운 trading 페이지는 `/trading-new`에서 확인할 수 있습니다.
기존 페이지는 `/trading`에 그대로 있습니다.

## 폴더 구조

### 백엔드 (bybitapi)
```
bybitapi/
├── src/
│   ├── config/          # 설정 파일
│   │   └── index.js     # 중앙 설정 관리
│   ├── services/        # 비즈니스 로직
│   │   ├── WebSocketService.js
│   │   ├── BybitService.js
│   │   └── TradingService.js
│   ├── controllers/     # (추후 추가 가능)
│   └── utils/          # (추후 추가 가능)
├── server-new.js       # 새로운 메인 서버
├── server.js          # 기존 서버 (보존)
└── .env              # 환경 변수
```

### 프론트엔드 (vv)
```
vv/
├── config/
│   └── index.js        # 프론트엔드 설정
├── hooks/              # React Custom Hooks
│   ├── useWebSocket.js
│   ├── useTrading.js
│   └── useMarketData.js
├── components/
│   ├── trading/        # 트레이딩 관련 컴포넌트
│   │   ├── OrderForm.js
│   │   ├── PositionList.js
│   │   ├── OrderBook.js
│   │   └── PriceDisplay.js
│   └── SimpleChart.js  # 기존 차트
├── pages/
│   ├── trading-new.js  # 새로운 트레이딩 페이지
│   └── trading.js      # 기존 페이지 (보존)
└── .env.local         # 환경 변수
```

## 주요 개선 사항

### 1. 설정 관리
- 모든 하드코딩된 값을 환경 변수로 분리
- 설정 변경이 코드 수정 없이 가능

### 2. 코드 모듈화
- 각 기능을 독립적인 서비스로 분리
- 재사용 가능한 컴포넌트 생성

### 3. 에러 처리
- WebSocket 재연결 로직 개선
- 메시지 큐를 통한 안정적인 통신

### 4. 확장성
- 새로운 거래소나 심볼 추가 용이
- 데이터베이스 연동 준비 완료

## 환경 변수 설정

### 백엔드 (.env)
```env
# 서버 포트
WS_PORT=8080
HTTP_PORT=8081

# 초기 잔고
INITIAL_BALANCE_USDT=10000

# 트레이딩 설정
DEFAULT_LEVERAGE=10
MAX_LEVERAGE=100
MIN_ORDER_AMOUNT=0.001
MAX_POSITIONS=10

# 업데이트 주기 (밀리초)
PNL_UPDATE_INTERVAL=5000
```

### 프론트엔드 (.env.local)
```env
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_API_URL=http://localhost:8081
```

## 다음 단계 권장사항

1. **데이터베이스 연동**
   - PostgreSQL 또는 MongoDB 추가
   - 사용자 인증 시스템 구현

2. **상태 관리**
   - Zustand 또는 Redux Toolkit 도입
   - 전역 상태 관리 개선

3. **테스트 코드**
   - Jest를 활용한 유닛 테스트
   - React Testing Library 활용

4. **성능 최적화**
   - React.memo를 활용한 불필요한 리렌더링 방지
   - WebSocket 메시지 throttling

5. **UI/UX 개선**
   - 반응형 디자인 완성
   - 다크/라이트 테마 전환
   - 토스트 알림 시스템

## 문제 해결

### WebSocket 연결 실패
- 백엔드 서버가 실행 중인지 확인
- 포트 번호가 환경 변수와 일치하는지 확인

### 데이터가 업데이트되지 않음
- 브라우저 콘솔에서 에러 확인
- 네트워크 탭에서 WebSocket 연결 상태 확인

## 라이선스
MIT
