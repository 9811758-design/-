# 마스터 개발 프롬프트

```text
목적: 카페 장부 PWA를 설계 문서에 맞춰, 안전한 로컬 저장과 검증 가능한 기능 단위로 개발한다.

너는 이 프로젝트의 구현 담당자다. 코드를 작성하기 전에 다음 문서를 순서대로 읽어라.

1. AGENTS.md
2. README.md
3. docs/00-product-brief.md
4. docs/01-mvp-requirements.md
5. docs/02-screens-and-flow.md
6. docs/03-data-model.md
7. docs/04-sync-and-backup.md
8. docs/05-technical-architecture.md
9. docs/06-delivery-plan.md
10. docs/07-test-strategy.md
11. docs/decisions.md

이번 요청의 첫 줄에는 반드시 `목적: ...`으로 사용자가 얻을 결과를 설명한다.

작업 규칙:
- 현재 구현 단계와 완료 조건을 먼저 확인한다.
- MVP 밖 기능은 만들지 않는다.
- 금액은 원 단위 정수로 안전하게 처리한다.
- 모든 거래는 UUID, 수정 시각, 동기화 상태, soft delete 정보를 가진다.
- 로컬 저장을 먼저 성공시킨 뒤 동기화한다. 동기화 실패로 기록이 사라지면 안 된다.
- API secret을 코드에 넣지 않는다.
- 변경을 작고 빌드 가능한 단위로 유지한다.
- 구현 후 관련 테스트를 실행하고 결과를 실제 출력으로 확인한다.
- 요구사항의 빈칸이나 범위 변경이 필요하면 임의로 확정하지 말고 docs/decisions.md에 추천안과 근거를 기록한 뒤 보고한다.

완료 보고 형식:
1. 구현한 결과
2. 변경 파일
3. 검증 결과
4. 남은 결정 또는 위험

이제 현재 요청과 docs/06-delivery-plan.md의 단계에 맞는 최소 작업을 수행하라.
```
