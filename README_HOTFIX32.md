# CARESTEP Clinic v9.1.1 · Hotfix 32
## SOLAPI OAuth 상태 검증 + 시작 설정 메시징 온보딩 통합

기준 버전: CARESTEP v9.1 SOLAPI OAuth2 + Hotfix 31 UX

## 이번 변경

### 1. SOLAPI OAuth 연결 상태를 실제 API 호출로 검증
OAuth 토큰이 존재하는지만 보지 않고 `GET /senderid/v1/numbers`를 실제 호출해 발신번호 조회 권한과 ACTIVE 번호를 확인합니다.

표시 상태:
- `ready` — OAuth 정상 + `senderid:read` 확인 + ACTIVE 발신번호 존재
- `no_sender` — OAuth/권한 정상, ACTIVE 발신번호 없음
- `permission_missing` — `senderid:read` 재승인 필요
- `token_error` — 토큰 갱신/복호화/인증 문제, SOLAPI 재연결 필요
- `provider_error` — SOLAPI 일시 조회 오류
- `disconnected` — 미연결

연결 직후 발신번호 조회 오류를 더 이상 조용히 무시하지 않습니다.

### 2. 시작 설정의 문자 온보딩을 한 단계로 통합
기존 `발신번호` + `문자 발송` 두 단계 대신 `문자 자동발송` 한 단계에서 아래 3개를 순서대로 진행합니다.

1. SOLAPI 계정 OAuth2 연결
2. ACTIVE 발신번호 선택 · 저장
3. 테스트 문자 실제 휴대폰 수신 확인

시작 설정은 기존 7단계에서 6단계로 단순화됩니다.

### 3. 발신번호 선택 시 자동발송 준비까지 같이 저장
시작 설정에서 승인 발신번호를 선택하고 `선택 · 저장`을 누르면:
- 기본 채널: SMS/LMS
- 해당 발신번호 저장
- 자동발송 사용: ON

상태로 저장되어 바로 테스트 문자를 보낼 수 있습니다.

### 4. OAuth 재승인 후 시작 설정으로 복귀
시작 설정에서 OAuth 연결/재승인을 시작하면 승인 완료 후 `후속관리`가 아니라 다시 `시작 설정`으로 돌아옵니다.
후속관리 페이지에서 시작한 OAuth는 기존처럼 후속관리로 돌아갑니다.

## 배포 순서

1. Cloudflare Worker 코드를 `worker.js`로 교체 후 Deploy
2. D1 migration은 하지 않습니다. 신규 테이블/컬럼 없음
3. 기존 Worker Secrets는 그대로 유지
   - SOLAPI_OAUTH_CLIENT_ID
   - SOLAPI_OAUTH_CLIENT_SECRET
   - CARESTEP_INTEGRATION_ENCRYPTION_KEY
   - 기존 SOLAPI_API_KEY / SOLAPI_API_SECRET (Legacy fallback 유지)
4. GitHub Pages `carestepclinic/carestepclinic.github.io`의 `index.html`을 새 파일로 교체
5. 브라우저에서 Ctrl+Shift+R 강력 새로고침

## 배포 후 확인

### 이미 OAuth 연결된 외부 병원
`시작 설정 → 문자 자동발송`에서 다음 중 하나가 명확히 표시되어야 합니다.
- `OAuth + senderid:read 확인`
- `OAuth 정상 · 발신번호 없음`
- `senderid:read 재승인 필요`
- `SOLAPI 재연결 필요`
- `SOLAPI 조회 지연`

### 신규 병원
`시작 설정 → 문자 자동발송`에서:
1. SOLAPI 계정 연결
2. 발신번호 선택 · 저장
3. 테스트 수신번호 입력
4. 테스트 문자 보내기
5. 실제 휴대폰 수신 후 전달상태 확인

전체 완료 시 `문자 자동발송` 단계가 완료 처리됩니다.

## 보안/데이터 원칙 유지
- SOLAPI clientSecret은 Worker Secret에만 존재
- 병원 OAuth 토큰은 서버측 AES-GCM 암호화 저장
- 보호자 전화번호/발송본문은 CARESTEP D1에 저장하지 않음
- OAuth 병원의 메시지 비용은 병원 SOLAPI 계정에서 직접 차감
- 기존 메디스 중앙 SOLAPI Legacy 경로는 이번 Hotfix에서 삭제하지 않음

## QA
- Worker JavaScript syntax: PASS
- Frontend inline JavaScript syntax: PASS
- Static HTML ID duplicate: 0
- D1 schema migration: 없음
