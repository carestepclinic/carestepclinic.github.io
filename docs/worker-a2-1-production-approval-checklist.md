# A.2.3 수동 승인 체크리스트 — 후속 실행 미승인

[Runbook](worker-a2-1-production-runbook.md)의 실행 gate용이다. 체크리스트 생성이나 CI PASS는
운영 승인으로 간주하지 않는다. 실제 ID·credential·개인정보는 기록하지 않고 제한된 티켓 참조만 사용한다.

현재 Worker: `10.7-A.2.3`, SHA-256
`57c1076d2026e2d5d3a2632690d873041533d229847c3d3afc26bf850ca3076a`.
미배포 A.2.2는 commit `c3ca52b186e5075fd712b233cf935b064a46e75c`, SHA-256
`677e602440017e1ff781524e8da04b00044939ade6d66a4065cdfa0dbbdcc3c9`로 보존한다.
이전 승인은 현재 후보에 적용되지 않는다. [새 trigger 계약](worker-a2-3-preventive-trigger-contract.md)을 검토한다.

이전 별도 승인 조회에서 담당자 계약 26/1/1/1/1 및 preventive cleanup 정의가 확인됐다.
trigger 정의 조회는 read-only 1건·쓰기 0건이었고 Git 생성 출처는 미확인이다.
이번 A.2.3 코드 작업에서는 Production에 접속하거나 기존 도구·로그를 수정하지 않았다.

## R: 다음 단계인 read-only preflight 승인

- [ ] 새 A.2.3 Phase 1C 도구의 기대 목록을 index 16개·trigger 8개로 검토하고 해시·SQL을 별도 승인했다.
- [ ] 기존 도구·로그를 보존하고 v2 부재 이후 schema 변경 여부를 재확인했다. SQL 07–32 자동 재개는 없다.
- [ ] 확인된 preventive trigger는 no-op, 누락만 생성, 불일치는 PREVENTIVE_PUSH_DELETE_TRIGGER_CONTRACT_MISMATCH로 BLOCK함을 확인했다.
- [ ] 26-column 계약을 이름 기준으로 비교하고, 기존 정의 불일치 시 자동 재정의 없이 BLOCK한다.
- [ ] 두 운영자가 계정/Worker/환경/D1 연결을 대조했다: `[TARGET_RECORD]`
- [ ] 쓰기를 기술적으로 막는 조회 경로·권한 증거를 비운영/정책으로 검증했다: `[READ_ONLY_EVIDENCE]`
- [ ] 새 Phase 1C의 SQL 07/조건부 11/C1/12–14 중 승인 범위, 실행 주체, 유효기간, 부하/시간 한도를 확정했다: `[R_APPROVAL]`
- [ ] 출력은 schema metadata·boolean·aggregate만이며 식별값/row payload 필터를 확인했다.
- [ ] health 조회는 별도 URL/응답 필터 범위 승인이고 status/UI GET은 포함하지 않는다.
- [ ] R 승인만으로 백업·migration·deploy·smoke가 허용되지 않음을 확인했다.

## B/M/D/S: 후속 단계 — R 결과 이후 별도 승인

- [ ] 실제 drift와 bootstrap DML 영향을 검토했다. 정확한 DDL artifact는 비운영에서 검증했다.
- [ ] v1 보존·자동 backfill 없음·초기 ledgerLastSeen 빈 값을 수용했다.
- [ ] 기존 A.2 및 모든 writer의 안전한 통제 수단을 검증했다. Agent/Cron 임의 변경은 없다.
- [ ] 백업 저장소·암호화·접근정책·시점·무결성·복구시험·복구권한이 확인됐다: `[B_EVIDENCE]`
- [ ] RTO/RPO, storage 여유, 관찰 시간과 수치 임계치가 확정됐다.
- [ ] D1 선행 → schema post-check → A.2.3 배포의 조건이 모두 충족됐다: `[M_APPROVAL]`
- [ ] Worker hash와 설정 diff, 배포 경로·범위를 승인했다: `[D_APPROVAL]`
- [ ] 각 smoke의 대상·쓰기 범위·외부 요청 금지·중단 기준을 별도 승인했다: `[S_APPROVAL]`
- [ ] PR #4/#5 Draft와 base를 유지한다. merge가 필요한 절차는 추가 승인 전 중단한다.

## F 및 완료

- [ ] A.2 단순 코드 rollback이 안전하지 않음을 확인했다.
- [ ] A.2.3 유지·영향 경로 제한·증거 보존·forward-fix의 책임자를 지정했다: `[F_OWNER]`
- [ ] 전체 DB 복구 시 백업 이후 데이터 보존/재적용 계획 없이는 실행하지 않는다.
- [ ] 최신 commit의 CI, 90 PASS / 0 FAIL (19+13+14+40+4), Worker hash를 재확인했다.
- [ ] 실제 관찰 결과와 미해결 WARN을 검토하고 완료/중단에 서명했다: `[FINAL_DECISION]`

현재 후보에서 완료된 것은 코드·문서·격리 검증이다. 새 R/B/M/D/S/F 실행은 모두 대기 상태다.
