CARESTEP Clinic v9.3.5 · HOTFIX 37 · REGRESSION RECOVERY
=========================================================

목적
----
Hotfix 36에서 확인된 중대 회귀를 복구합니다.

복구 항목
---------
1. 새로고침 시 로그인 화면으로 돌아가는 문제
   - 로그인 세션 토큰을 sessionStorage + localStorage에서 복원
   - 유효한 서버 세션이면 새로고침 후 앱 화면으로 복귀
   - 로그아웃/실제 401·403에서는 양쪽 저장소 모두 제거

2. 새 환자 / 초기화 무반응
   - 새환자 강제 초기화 경로 보강
   - 환자/보호자/퇴원지시/약/현재 Journey/메시지 케이스 상태만 초기화
   - 병원정보/프리셋/Google·Outlook/SOLAPI/요금제·직원 설정은 유지
   - 전역 복구 클릭 경로 추가

3. 자료실 '이 자료로 만들기' 무반응
   - 자료실 → 새 환자 초기화 → 선택 템플릿 → Builder 1단계 이동 경로 복구
   - 이벤트 바인딩이 일부 실패하더라도 전역 복구 클릭 경로로 동작

4. 자료 누락
   - 기존 20종 유지
   - 고양이 요도폐색 입원·퇴원관리 복원
   - 고양이 특발성 방광염(FIC)·FLUTD 장기관리 복원
   - 총 내장 질환/수술 자료 22종

5. 공통 부팅 회귀
   - 누락된 messagingFailureOpen / messagingFailuresForWorkboard / messagingFailureCardHtml /
     bindMessagingFailureActions / linkMessagingTimelineToWorkItems 등 메시지 실패처리 helper 복원
   - renderAll 각 단계를 격리하여 한 렌더 오류가 앱 전체 부팅을 중단시키지 않도록 방어

6. SOLAPI OAuth
   - 기본 문자 OAuth scope: message:write message:read senderid:read
   - kakao:read는 알림톡 사용 시 별도 추가 승인
   - OAuth 시작 요청 scopeMode=core / scopeMode=kakao 분리
   - refresh token 교환에 SOLAPI OAuth client_id/client_secret 포함 복원
   - 발신번호 조회 /senderid/v1/numbers 유지

배포 순서
---------
1. Cloudflare Worker
   - worker.txt 전체 복사
   - 기존 Worker 코드를 전체 교체
   - Deploy

2. GitHub Pages
   - 저장소 루트의 기존 index.html을 이 패키지의 index.html로 완전히 교체
   - 다른 이름의 HTML 파일을 추가하는 방식이 아니라 반드시 루트 index.html 교체

3. 강력 새로고침
   - Ctrl + Shift + R
   - 로그인 화면 또는 앱 상단에서 v9.3.5 · HOTFIX 37 · REGRESSION RECOVERY 확인

4. 권장 스모크 테스트
   A. 로그인 → F5 → 로그인 유지
   B. 환자명 입력 → + 새 환자 / 초기화 → 환자명 초기화
   C. 자료실 → 이 자료로 만들기 → Builder 1단계 이동
   D. 자료실에서 '고양이 요도폐색', 'FIC' 검색 확인
   E. SOLAPI 계정 연결 → SOLAPI 승인 화면 이동 → 복귀 후 발신번호 조회

변경 불필요
-----------
- D1 migration: 없음
- HQ 파일: 변경 없음
- 기존 Cloudflare Secrets: 변경하지 않음
- CARESTEP_INTEGRATION_ENCRYPTION_KEY: 절대 변경하지 않음

QA
--
- Frontend inline JavaScript syntax: PASS
- Worker JavaScript syntax: PASS
- Browser boot exceptions: 0
- CARESTEP runtime issues after render: 0
- 새환자 실제 클릭 초기화: PASS
- 자료실 실제 클릭 → Builder: PASS
- 내장 자료 22종 및 feline_uo/feline_fic 존재: PASS
- localStorage → sessionStorage 세션 복원 + saasBootstrap 앱 복귀: PASS
- SOLAPI OAuth core/kakao scopeMode 요청: PASS

주의
----
실제 SOLAPI 승인 자체는 SOLAPI 계정/OAuth 앱/Redirect URI/Secrets 상태에 의존합니다.
코드 경로는 검증했지만, 배포 후 실제 계정으로 1회 OAuth 승인 + 발신번호 조회 스모크 테스트를 진행하세요.
