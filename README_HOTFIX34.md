# CARESTEP v9.3.2 · Hotfix 34

## 수정 대상
1. 새 환자 / 초기화가 반응하지 않거나 모달 상태가 꼬이는 회귀
2. v9.3에서 `kakao:read`가 기본 SOLAPI OAuth scope에 합쳐지면서 기존 문자용 SOLAPI 연결까지 실패할 수 있는 회귀

## 핵심 수정

### 1) 새 환자 초기화 복구
- `forceNewCaseReset()` 안전 초기화 경로 추가
- 오래 남은 reset modal Promise가 있으면 먼저 해제
- 환자/보호자/개별지시/복약/Journey/후속관리 case nonce/현재 문자 입력·동의 상태를 초기화
- 병원정보, 병원 프리셋, Google/Outlook, SOLAPI, 요금제/직원 설정은 유지
- 초기화 후 Builder/Badge/Readiness/대시보드 상태를 강제 재렌더
- ESC로 초기화 모달을 닫아도 Promise가 정상 해제되도록 보강

### 2) SOLAPI OAuth scope 분리
- 기본 문자 연결: `message:write message:read senderid:read`
- 카카오 알림톡 권한은 필요할 때만 별도 재승인: 위 3개 + `kakao:read`
- 카카오 권한 미승인 상태여도 SMS/LMS SOLAPI 연결은 정상 유지
- 카카오 영역에 `카카오 권한 추가 승인` 버튼 추가
- refresh token 갱신 요청에도 OAuth client_id/client_secret을 포함하도록 보강

## 배포 순서
1. Cloudflare Worker 코드를 `CARESTEP_v9.3.2_HOTFIX34_worker.js` 내용으로 교체 후 Deploy
2. GitHub Pages의 Clinic `index.html`을 `CARESTEP_v9.3.2_HOTFIX34_index.html`로 교체
3. 브라우저에서 강력 새로고침(Ctrl+Shift+R)
4. Owner/Admin 계정으로 로그인

## 배포 직후 Smoke Test
### 새 환자
- 환자명/보호자명 입력
- `+ 새 환자 / 초기화` 클릭
- `새 환자로 초기화` 선택
- 환자명/보호자명/개별 지시/Journey가 비워지는지 확인
- 병원명/SOLAPI/Google Calendar 설정이 유지되는지 확인

### SOLAPI 문자
- 시작 설정 또는 후속관리에서 `SOLAPI 계정 연결` 클릭
- SOLAPI 승인 화면에 기본 3 scope만 요청되는지 확인
- 돌아온 뒤 `OAuth + senderid:read 확인` 또는 `발신번호 없음` 상태 확인
- 승인 발신번호 저장 후 테스트 문자 1건 확인

### 카카오 알림톡
- 문자 SOLAPI 연결이 정상인 상태에서 카카오 영역 확인
- `kakao:read`가 없으면 문자 연결은 유지되고 `카카오 권한 추가 승인`만 표시되어야 함
- 알림톡을 실제 사용할 때만 별도 승인 진행

## D1 / Secret
- D1 migration 없음
- 기존 Secrets 유지
- `SOLAPI_OAUTH_CLIENT_ID`, `SOLAPI_OAUTH_CLIENT_SECRET`, `CARESTEP_INTEGRATION_ENCRYPTION_KEY` 값은 변경하지 않음
