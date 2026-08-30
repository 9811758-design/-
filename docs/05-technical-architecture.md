# 기술 아키텍처

## 구성

- React와 TypeScript: 화면과 상호작용
- Vite와 PWA 플러그인: 빌드, 서비스 워커, 설치 가능성
- Dexie/IndexedDB: 오프라인 우선 데이터와 동기화 큐
- Zod: 런타임 입력 및 저장 데이터 검증
- Google Sheets 어댑터: 원격 백업 경계
- Vitest와 Playwright: 단위·통합·E2E·PWA 검증

## 계층 경계

- domain: 거래 스키마, 입력 검증, 지출 집계
- data: IndexedDB repository, migration, sync queue/coordinator
- features: 기록, 내역, 대시보드, 통계, 설정
- services: Google 인증·Sheets 어댑터와 sync runner
- app: 라우팅, 서비스 조립, 내비게이션

UI는 repository나 Google API를 직접 호출하지 않고 기능 서비스와 포트를 사용한다. 원격 동기화는 로컬 저장 성공 이후 독립적으로 실행한다.

## 호환 경계

sale과 menu 도메인 스키마, IndexedDB menus 테이블, 레거시 큐 판독 로직은 데이터 마이그레이션 호환을 위해 남긴다. 이 경계는 활성 제품 기능이 아니며 화면, 신규 입력 타입, 지출 집계, Google 원격 쓰기로 연결하지 않는다.

데이터베이스 버전 업그레이드는 기존 테이블이나 레코드를 제거하지 않는다. Google Sheets 계약도 기존 탭과 헤더를 인식하되 활성 쓰기 포트는 지출 거래로 제한한다.

## 오류와 복구

- 사용자 입력 오류: 저장하지 않고 한국어 필드 오류를 표시한다.
- IndexedDB 오류: 실패를 명시하고 성공 메시지를 표시하지 않는다.
- 동기화 오류: 로컬 기록을 유지하고 큐를 재시도 가능하게 둔다.
- 렌더링 오류: 오류 경계가 앱 전체의 흰 화면을 방지한다.

