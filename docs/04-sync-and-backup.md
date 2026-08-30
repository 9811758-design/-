# Google Sheets 동기화와 백업

## 기본 원칙

IndexedDB가 원본이며 Google Sheets는 선택적 백업 대상이다. 저장 성공 여부는 원격 응답이 아니라 로컬 트랜잭션 완료로 결정한다.

## 신규 동기화 범위

- 날짜별 총매출 추가·수정·soft delete
- 재료 구매 추가·수정·soft delete
- 운영비 추가·수정·soft delete
- UUID 기반 upsert와 로컬 버전 기반 중복 방지
- 실패 큐, 지수형 재시도, 수동 재시도

revenue, purchase와 expense만 신규 원격 쓰기 대상이다. 기존 큐에 남아 있는 레거시 sale·menu 작업은 원격 행을 변경하지 않고 로컬 큐에서 안전하게 종료한다.

## Spreadsheet 호환성

- 기존 다섯 개 탭과 헤더 검증 규약은 이전 Spreadsheet 연결을 위해 유지한다.
- 이전 판매·메뉴 행은 삭제하거나 덮어쓰지 않는다.
- 새 템플릿도 기존 구조와 연결 가능해야 한다.
- 신규 revenue는 기존 Transactions 헤더를 변경하지 않고 transactionType=revenue, itemName=일일 총매출, totalAmountWon=매출액으로 기록한다.
- 같은 영업일을 재입력해도 안정적인 UUID를 유지하므로 원격에서 같은 행이 수정된다.

## 실패 처리

1. 로컬 기록과 큐 생성을 원자적으로 완료한다.
2. 인증, 네트워크 또는 API 오류가 나면 작업을 pending 또는 failed 상태로 유지한다.
3. 사용자에게 한국어 상태 메시지와 재시도 수단을 제공한다.
4. 재시도 성공 후에만 해당 로컬 엔터티를 synced로 표시한다.

## 보안과 운영

- OAuth client id는 환경 변수로 주입하고 secret은 저장소에 넣지 않는다.
- Spreadsheet 권한은 필요한 최소 범위만 요청한다.
- 출시 전 실제 Google 계정에서 신규 파일 생성, 기존 파일 연결, 실패 후 재시도를 수동 확인한다.
