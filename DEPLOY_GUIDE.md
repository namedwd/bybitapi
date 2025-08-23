# AWS Lightsail 서버 배포 가이드

## 1. GitHub 리포지토리 생성

### 로컬에서 실행:
```bash
cd C:\Users\pc\Documents\bybitapi

# Git 초기화 및 커밋
git init
git add .
git commit -m "Initial commit"

# GitHub에 리포지토리 생성 후
git remote add origin https://github.com/YOUR_USERNAME/bybit-mock-server.git
git branch -M main
git push -u origin main
```

## 2. Lightsail 서버 접속

```bash
# SSH로 서버 접속 (Lightsail 콘솔에서 다운로드한 키 사용)
ssh -i LightsailDefaultKey.pem ubuntu@YOUR_SERVER_IP
```

## 3. 서버 초기 설정

### 방법 1: 자동 설정 스크립트 사용
```bash
# 스크립트 다운로드 및 실행
wget https://raw.githubusercontent.com/YOUR_USERNAME/bybit-mock-server/main/setup-server.sh
chmod +x setup-server.sh
./setup-server.sh
```

### 방법 2: 수동 설정
```bash
# 1. 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 2. Node.js 18 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. 필수 도구 설치
sudo apt-get install -y build-essential git

# 4. PM2 설치 (프로세스 관리자)
sudo npm install -g pm2

# 5. Nginx 설치 (리버스 프록시)
sudo apt-get install -y nginx
```

## 4. 애플리케이션 배포

```bash
# 1. 앱 디렉토리 생성
mkdir -p ~/apps
cd ~/apps

# 2. GitHub에서 코드 클론
git clone https://github.com/YOUR_USERNAME/bybit-mock-server.git
cd bybit-mock-server

# 3. 의존성 설치
npm install

# 4. 환경 변수 설정
cp .env.example .env
nano .env  # 필요한 설정 수정
```

### .env 파일 수정 사항:
```env
# 프론트엔드 URL을 실제 도메인으로 변경
FRONTEND_URL=http://your-domain.com

# 나머지는 기본값 사용 가능
WS_PORT=8080
HTTP_PORT=8081
```

## 5. PM2로 서버 실행

```bash
# PM2로 서버 시작
pm2 start ecosystem.config.js

# PM2 프로세스 저장 (재부팅 시 자동 시작)
pm2 save
pm2 startup
# 출력된 명령어 실행

# PM2 명령어
pm2 status          # 상태 확인
pm2 logs            # 로그 확인
pm2 restart all     # 재시작
pm2 stop all        # 중지
```

## 6. Nginx 설정

```bash
# 1. Nginx 설정 파일 생성
sudo nano /etc/nginx/sites-available/bybit-server

# 2. 아래 내용 붙여넣기 (IP 주소 수정)
```

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;  # 실제 IP 주소로 변경

    # WebSocket 프록시
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # API 프록시
    location /api/ {
        proxy_pass http://localhost:8081/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# 3. 설정 활성화
sudo ln -s /etc/nginx/sites-available/bybit-server /etc/nginx/sites-enabled/

# 4. 기본 설정 제거 (선택사항)
sudo rm /etc/nginx/sites-enabled/default

# 5. Nginx 테스트 및 재시작
sudo nginx -t
sudo systemctl restart nginx
```

## 7. 방화벽 설정

```bash
# UFW 방화벽 설정
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS (추후 SSL용)
sudo ufw allow 8080/tcp   # WebSocket
sudo ufw allow 8081/tcp   # API
sudo ufw --force enable

# 상태 확인
sudo ufw status
```

## 8. Lightsail 네트워킹 설정

Lightsail 콘솔에서:
1. 인스턴스 선택
2. "네트워킹" 탭 클릭
3. "방화벽" 섹션에서 다음 규칙 추가:
   - HTTP (80)
   - HTTPS (443)
   - Custom TCP 8080
   - Custom TCP 8081

## 9. 서버 테스트

```bash
# 로컬에서 상태 확인
curl http://YOUR_SERVER_IP/api/health

# PM2 로그 확인
pm2 logs

# Nginx 로그 확인
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## 10. 프론트엔드 연결

프론트엔드 .env 파일 수정:
```env
NEXT_PUBLIC_WS_URL=ws://YOUR_SERVER_IP/ws
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP/api
```

## 11. 업데이트 배포

```bash
cd ~/apps/bybit-mock-server
git pull origin main
npm install
pm2 restart all
```

## 12. 모니터링

```bash
# PM2 모니터링
pm2 monit

# 시스템 리소스 확인
htop  # 설치: sudo apt install htop

# 디스크 사용량
df -h

# 메모리 사용량
free -m
```

## 문제 해결

### WebSocket 연결 실패
- Nginx 설정 확인
- 방화벽 규칙 확인
- PM2 프로세스 상태 확인

### 502 Bad Gateway
- PM2로 서버가 실행 중인지 확인
- 포트 번호가 일치하는지 확인

### 메모리 부족
- Swap 파일 생성:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## SSL 인증서 설정 (선택사항)

```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d your-domain.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

## 백업

```bash
# 환경 변수 백업
cp ~/apps/bybit-mock-server/.env ~/backup-env

# PM2 설정 백업
pm2 save
```
