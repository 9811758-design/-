# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-08-31
- Primary product surfaces: 대시보드, 매출·지출 기록, 거래 내역, 월간 캘린더 통계, 설정
- Evidence reviewed: README.md, docs/00-product-brief.md부터 docs/07-test-strategy.md, 기존 React 화면과 CSS 토큰, Playwright 모바일·태블릿·데스크톱 캡처

## Brand

- Personality: 조용하지만 바쁜 카페 카운터를 위한 따뜻하고 신뢰할 수 있는 지출 장부
- Trust signals: 로컬 우선 저장 상태, 명시적인 동기화 대기·실패 안내, 쿠크봉 로고
- Avoid: 메뉴별 POS처럼 보이는 표현, 과도한 그래프 장식, 색만으로 전달하는 상태

## Product goals

- Goals: 날짜별 총매출, 재료 구매와 운영비를 빠르게 기록하고 월간 매출·지출·재료 구매비율을 한눈에 이해하게 한다.
- Non-goals: 메뉴 관리, 메뉴별 판매·수량·단가, 실제 재고 원가율, 여러 기기의 동시 수정 병합, Sheet에서 자동 복원
- Success signals: 모바일에서 세 기록 유형을 저장할 수 있고 일매출 중복이 방지되며 재시작 후 수정·삭제·집계·동기화가 일관된다.

## Personas and jobs

- Primary personas: 카페 운영자와 비용 기록을 담당하는 직원
- User jobs: 영업 마감 후 일매출 입력, 구매 직후 금액 기록, 월별 매출·지출 비교, 운영비 분류 확인, 외부 Sheet 백업
- Key contexts of use: 한 손 모바일 입력, 불안정한 네트워크, 카운터 업무 중 짧은 조작

## Information architecture

- Primary navigation: 대시보드, 기록, 내역, 통계, 설정
- Core routes/screens: /, /record, /history, /analytics, /settings
- Content hierarchy: 현재 저장 상태 → 핵심 매출·지출 지표 → 빠른 기록 → 월간 캘린더 → 세부 내역과 분석

## Design principles

- 로컬 저장 완료 전에는 성공으로 표시하지 않는다.
- 한 화면의 주 행동은 하나만 강하게 강조한다.
- 금액과 기간 문맥을 항상 함께 보여 준다.
- 같은 영업일의 총매출은 한 건으로 유지하고 재입력은 수정으로 처리한다.
- 기존 판매·메뉴 데이터는 UI에 노출하지 않되 파괴적으로 삭제하지 않는다.
- Tradeoffs: 복잡한 차트보다 작은 화면에서 읽기 쉬운 지표·목록·막대 표현을 우선한다.

## Visual language

- Color: 오트 캔버스 #F5F0E8, 브랜드 녹색 #315C4F, 진한 녹색 #1E4037, 지출 강조 코퍼 #A65E2E
- Typography: system-ui, Segoe UI 계열; 제목 24px 이상, 본문 16px, 보조 14px
- Spacing/layout rhythm: 4px 기준 토큰, 모바일 16px·태블릿 이상 24px 외부 여백
- Shape/radius/elevation: 12px 카드, 16px 히어로, warm glass 표면과 낮은 그림자
- Motion: 150ms ease-out, transform·opacity 중심, reduced motion 존중
- Imagery/iconography: 제공된 쿠크봉 로고와 lucide 아이콘을 사용한다.

## Components

- Existing components to reuse: App shell, bottom navigation, action card, entry form, period picker, metric card, ledger row, feedback banner
- New/changed components: 날짜별 총매출 입력, 매출 지표 카드, 월 탐색기, 7열 월간 캘린더, 선택 날짜 상세, 매출·지출 추이
- Variants and states: 기본, 로딩, 비어 있음, 성공, 동기화 대기, 동기화 실패, 오프라인
- Token/component ownership: src/styles.css와 src/styles/*.css가 토큰과 컴포넌트 표현을 소유한다.

## Accessibility

- Target standard: WCAG 2.2 AA
- Keyboard/focus behavior: 라우트 전환 후 main에 포커스, skip link 제공, 모든 조작 키보드 접근
- Contrast/readability: 본문 4.5:1 이상, 포커스 링 상시 표시
- Screen-reader semantics: landmark, heading, status, alert, aria-current와 날짜별 전체 금액을 포함한 캘린더 버튼 이름을 사용한다.
- Reduced motion and sensory considerations: prefers-reduced-motion을 존중하고 색 외 텍스트로 상태를 설명한다.

## Responsive behavior

- Supported breakpoints/devices: 375px 모바일, 768px 태블릿, 1280px 데스크톱 검증
- Layout adaptations: 모바일 단일 열, 태블릿 이상 2열, 지표는 auto-fit 그리드, 캘린더는 모든 화면에서 가로 스크롤 없는 7열
- Touch/hover differences: 주요 컨트롤 최소 44px, hover 없이도 모든 기능 이해 가능

## Interaction states

- Loading: 저장소·집계·동기화 준비 상태를 문장으로 표시
- Empty: 거래 없음, 매출 없음, 운영비 없음, 캘린더 기록 없음, 추이 없음 상태를 구분
- Error: 입력값을 유지하고 연결된 alert에 포커스
- Success: IndexedDB 커밋 뒤에만 로컬 저장 완료 안내
- Disabled: 저장·Google 작업 중 중복 실행 방지
- Offline/slow network: 로컬 저장은 계속 허용하고 원격 실패는 큐에 유지

## Content voice

- Tone: 짧고 직접적이며 안심을 주는 한국어
- Terminology: 날짜별 총매출, 재료 구매, 운영비, 총지출, 매출 대비 재료 구매비율, 동기화 대기
- Microcopy rules: 신규 총매출은 ‘매출’, 과거 메뉴 기반 거래는 ‘레거시 판매’로 구분하고 ‘원가율’이라고 축약하지 않는다.

## Implementation constraints

- Framework/styling system: React, TypeScript, Vite, repo-local CSS
- Design-token constraints: 기존 색·간격 토큰을 확장하고 새 디자인 계층을 만들지 않는다.
- Performance constraints: 추가 차트 라이브러리 없이 목록과 CSS로 지출 추이를 표현한다.
- Compatibility constraints: 신규 revenue와 기존 IndexedDB sale/menu를 구분하고 기존 Google Sheet 탭·헤더를 변경하지 않아야 한다.
- Test/screenshot expectations: 단위 테스트와 375/768/1280 Playwright 캡처를 유지한다.

## Open questions

- [ ] 기존 판매·메뉴 데이터를 사용자가 직접 내보내거나 영구 삭제하는 관리 기능이 필요한가 / 사용자 / 데이터 보존 정책
