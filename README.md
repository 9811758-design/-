# 쿠크봉 지출 장부 PWA

카페 운영자가 날짜별 총매출, 재료 구매와 운영비를 모바일에서 빠르게 기록하고 월간 매출·지출을 비교하는 오프라인 우선 장부다. 모든 입력은 IndexedDB에 먼저 저장되며 Google Sheets 연결은 사용자 소유 문서에 백업하는 선택 기능이다.

## 구현 상태

- 날짜별 총매출 한 건 upsert, 재료 구매와 운영비 로컬 입력 및 재시작 후 보존
- 기간·거래 종류 필터, 수정, soft delete
- 오늘·이번 달 매출·지출 및 매출 대비 재료 구매비율 대시보드
- 월간 매출·지출 캘린더, 날짜 상세, 운영비 분류와 일별 추이 통계
- UUID 기반 Google Sheets 추가·동일 행 수정·soft delete 동기화
- 실패 큐, 재시도, 앱 시작·온라인 복귀·수동 재시도
- 모바일·태블릿·데스크톱 반응형 UI와 키보드·스크린 리더 안내
- 설치 가능한 PWA, 승인형 업데이트, 첫 온라인 실행 후 오프라인 시작
- 쿠크봉 로고가 적용된 앱 헤더와 대시보드

메뉴 관리와 메뉴별 판매 기록 기능은 제공하지 않는다. 신규 매출은 `revenue`, 이전 메뉴 기반 판매는 `sale`로 구분한다. 과거 판매·메뉴 데이터는 자동 삭제하지 않고 IndexedDB 호환성을 위해 보존하지만 활성 화면·집계·신규 Google Sheets 쓰기에서는 제외한다.

## 개발 환경

검증 환경은 Node.js 24.18.0과 pnpm 11.19.0이다.

~~~powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
~~~

Google 연결을 시험하려면 .env.local의 VITE_GOOGLE_CLIENT_ID에 Google OAuth 웹 클라이언트 ID를 넣는다. OAuth client secret, access token, refresh token은 파일이나 코드에 저장하지 않는다. 이 값이 없어도 로컬 매출·지출 장부는 정상 동작한다.

## 품질 명령

~~~powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm test:pwa
~~~

## 데이터와 복구

- 브라우저 사이트 데이터를 지우면 IndexedDB 장부가 삭제된다.
- 삭제 전 설정에서 동기화 대기 0건을 확인하고 Google Spreadsheet 사본을 보관한다.
- Google 연결을 해제해도 로컬 기록은 유지된다.
- 현재 버전은 Google Sheets에서 새 기기의 IndexedDB로 자동 복구하지 않는다.
- 기존 메뉴 기반 판매·메뉴 데이터는 호환 목적으로 남지만 앱에서 조회하거나 수정할 수 없다.

출시 전 전체 확인은 docs/release-checklist.md를 따른다.
