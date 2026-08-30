# 데이터 모델

## 활성 거래

### 날짜별 총매출

- id: 같은 영업일을 수정할 때 유지되는 UUID
- transactionType: revenue
- businessDate: YYYY-MM-DD 영업일
- amountWon: 0원보다 큰 원 단위 정수
- occurredAt: Asia/Seoul 영업일 시작 시각
- memo: 선택 메모
- updatedAt, syncStatus, syncVersion, deletedAt: 동기화 및 soft delete 메타데이터

### 재료 구매

- id: UUID
- transactionType: purchase
- itemName: 품목명
- quantity: 양수
- unit: 단위
- unitPriceWon: 원 단위 정수
- totalAmountWon: 수량과 단가로 계산한 원 단위 정수
- occurredAt: 거래 시각
- note: 선택 메모
- updatedAt, syncStatus, syncVersion, deletedAt: 동기화 및 soft delete 메타데이터

### 운영비

- id: UUID
- transactionType: expense
- category: 운영비 카테고리
- amountWon: 원 단위 정수
- totalAmountWon: amountWon과 동일
- occurredAt: 거래 시각
- note: 선택 메모
- updatedAt, syncStatus, syncVersion, deletedAt: 동기화 및 soft delete 메타데이터

## 집계 규칙

- 삭제되지 않은 revenue, purchase와 expense만 집계한다.
- 총지출 = 재료 구매비 + 운영비
- 매출 대비 재료 구매비율 = 재료 구매비 ÷ 총매출 × 100
- 총매출이 0원이면 비율은 unavailable로 처리한다.
- 기록 건수 = revenue, purchase와 expense의 집계 대상 수
- 카테고리 비중은 운영비 합계가 0원이면 0으로 처리한다.
- 날짜 구간은 Asia/Seoul 기준으로 해석한다.

## 동기화 작업

- entityType과 entityId로 대상을 식별한다.
- operation은 upsert 또는 delete다.
- queuedVersion, attemptCount, nextAttemptAt으로 중복과 재시도를 관리한다.
- 로컬 엔터티와 큐 상태 변경은 하나의 IndexedDB 트랜잭션으로 수행한다.

## 레거시 호환 모델

이전 버전의 sale 거래, menu 레코드와 관련 식별자·스키마는 기존 IndexedDB를 열기 위한 호환 경계로만 유지한다. 신규 날짜별 총매출은 revenue로 저장해 sale과 구분한다. 앱은 레거시 데이터를 자동 삭제하지 않으며 신규 생성, 화면 표시, 집계, Google Sheets 신규 쓰기에 사용하지 않는다.
