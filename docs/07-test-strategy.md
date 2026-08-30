# 테스트 전략

## 우선순위

1. 로컬 데이터 보존과 마이그레이션
2. 금액 계산과 지출 집계
3. 입력 검증 및 신규 판매 차단
4. 수정·soft delete·필터
5. 동기화 실패·재시도·중복 방지
6. 모바일 접근성과 PWA 동작

## 단위 및 통합 테스트

- 구매와 운영비 입력 스키마 및 금액 계산
- sale 입력 거부
- 삭제·레거시 판매 제외 집계
- 총지출, 비용 구분, 카테고리 비중, 일별 추이
- repository 재개방 후 데이터 보존
- 기존 menus 테이블과 레코드가 유지되는 migration
- sync queue 상태 전이와 원자성
- 레거시 판매·메뉴 큐가 Google 원격 쓰기 없이 종료되는지 검증

## E2E

- 모바일에서 구매와 운영비 저장
- 새 페이지 로드 후 기록 보존
- 내역 수정과 soft delete 후 통계 갱신
- 판매·메뉴 UI와 관리 라우트 부재
- 네트워크 단절 상태의 로컬 저장
- 동기화 실패 표시와 재시도 성공
- 키보드 탐색, 접근 가능한 이름, 최소 터치 영역

## PWA 검증

- production build의 manifest와 아이콘
- 서비스 워커 등록과 핵심 정적 자산 캐시
- 오프라인 재방문 시 앱 셸과 로컬 데이터 접근

## 필수 명령

~~~powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm test:pwa
~~~

