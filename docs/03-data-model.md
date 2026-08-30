# 데이터 모델

## 활성 거래

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

## 지출 집계 규칙

- 삭제되지 않은 purchase와 expense만 집계한다.
- 총지출 = 재료 구매비 + 운영비
- 거래 건수 = 집계 대상 거래 수
- 카테고리 비중은 운영비 합계가 0원이면 0으로 처리한다.
- 날짜 구간은 Asia/Seoul 기준으로 해석한다.

## 동기화 작업

- entityType과 entityId로 대상을 식별한다.
- operation은 upsert 또는 delete다.
- queuedVersion, attemptCount, nextAttemptAt으로 중복과 재시도를 관리한다.
- 로컬 엔터티와 큐 상태 변경은 하나의 IndexedDB 트랜잭션으로 수행한다.

## 레거시 호환 모델

이전 버전의 sale 거래, menu 레코드와 관련 식별자·스키마는 기존 IndexedDB를 열기 위한 호환 경계로만 유지한다. 앱은 이 데이터를 자동 삭제하지 않으며 신규 생성, 화면 표시, 지출 집계, Google Sheets 신규 쓰기에 사용하지 않는다.

