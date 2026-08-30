# 출시 체크리스트

## 기능

- [ ] 재료 구매 추가·수정·soft delete
- [ ] 운영비 추가·수정·soft delete
- [ ] 재실행 후 로컬 데이터 보존
- [ ] 기간 및 거래 유형 필터
- [ ] 오늘·이번 달 지출 지표
- [ ] 운영비 카테고리 및 일별 지출 통계
- [ ] 메뉴 관리와 판매 진입점이 없음
- [ ] 신규 sale 입력이 런타임 검증에서 거부됨

## 호환성과 동기화

- [ ] 기존 IndexedDB를 오류 없이 개방
- [ ] 기존 판매·메뉴 레코드가 물리 삭제되지 않음
- [ ] 기존 판매가 지출 통계에 포함되지 않음
- [ ] 구매·운영비 Google Sheets 추가·수정·soft delete
- [ ] 기존 Spreadsheet 탭·헤더와 행 보존
- [ ] 동기화 실패 후 로컬 데이터 유지 및 재시도 성공

## 접근성 및 PWA

- [ ] 모바일 44px 터치 영역
- [ ] 키보드 탐색과 스크린 리더 이름
- [ ] 한국어 오류 및 빈 상태
- [ ] manifest, 서비스 워커, 오프라인 재방문
- [ ] 앱 로고 표시

## 자동 검증

- [ ] pnpm lint
- [ ] pnpm typecheck
- [ ] pnpm test
- [ ] pnpm test:e2e
- [ ] pnpm build
- [ ] pnpm test:pwa

## 운영

- [ ] Google OAuth client id와 승인된 origin 확인
- [ ] 실제 Google 계정으로 신규 Sheet와 기존 Sheet 연결 확인
- [ ] 빌드 산출물과 소스에서 secret 누출 검사

