# BBL Pitcher Integrated Report — 통합 분석 리포트 빌더

국민대학교 **BioMotion Baseball Lab (BBL)** 투수 통합 분석 리포트 자동 생성 사이트입니다.

* **분석 대상** · 투수 1명
* **입력 데이터** · 선수 프로필 + 구속 + Uplift CSV 10개 + ForceDecks CSV 1개
* **출력** · Report 7 형식의 인터랙티브 대시보드 (인쇄/PDF 지원)

## 📋 설계

이 사이트는 두 시스템을 통합한 결과입니다:

| 데이터 | 분석 로직 출처 |
|--------|----------------|
| Uplift CSV → 바이오메카닉스 (구속·제구) | `files` (BBLAnalysis) |
| ForceDecks CSV → 체력 5대 변수 | 신규 (BBLFitness) |
| 기대 구속 모델 (체력 vs 메카닉스) | Report 7 |
| Archetype · CoreIssue · 강점·약점·플래그·훈련 | Report 7 + 신규 룰 |
| 대시보드 UI | Report 7 |

## 🚀 사용법

### 로컬에서 실행

1. 이 폴더 전체를 다운로드합니다.
2. `index.html`을 더블클릭하거나, 간단한 정적 서버를 띄워 엽니다:
   ```bash
   # 옵션 1: Python 내장 서버
   python3 -m http.server 8000
   # 옵션 2: Node http-server
   npx http-server .
   ```
3. 브라우저에서 `http://localhost:8000` 접속.

### GitHub Pages 배포

1. 이 폴더 전체를 GitHub 저장소에 **Public**으로 업로드.
2. **Settings → Pages → Source: `main` branch / root** → Save.
3. 약 1–2분 후 `https://<사용자명>.github.io/<저장소명>/`에서 접속 가능.

## 📊 입력 데이터

### 1. 선수 프로필 (직접 입력)

* 이름, 영문 이름, 나이, 신장(cm), 체중(kg), 투구손
* **최고 구속 (km/h)**, **평균 구속 (km/h)**
* 측정 영상 URL (선택사항 — YouTube · Vimeo · mp4 직접 링크)

### 2. Uplift CSV (10개 권장)

Uplift Labs 마커리스 모션캡처 export 파일입니다. 각 파일이 1개의 투구 시행을 나타냅니다.
`files`의 `BBLAnalysis` 모듈이 다음을 자동 추출:

* 분절 회전 속도 (peak pelvis · trunk · arm)
* 분절 시퀀싱 (P→T lag, T→A lag, FC→BR)
* 에너지 전달 (ETI P→T, ETI T→A)
* Max ER (layback)
* X-factor, stride length, knee flex, trunk tilt, arm slot
* 기타 13개 fault flags

10개의 trial은 시행간 SD/CV로 제구 일관성(5 Domain) 평가에 활용됩니다.

### 3. ForceDecks CSV (1개)

VALD ForceDecks (또는 동등한 포스플레이트) export 파일. 본 파서는 다음 두 형식을 모두 지원합니다:

#### Long format (각 행 = 1개 시행)

| Test Type | Concentric Peak Power (W) | Concentric Peak Power / BM (W/kg) | Jump Height (cm) | RSI Modified (m/s) | Peak Force (N) | Peak Force / BM (N/kg) |
|-----------|---|---|---|---|---|---|
| CMJ | 3816 | 48.3 | 38.2 | 0.49 | | |
| CMJ | 3850 | 48.7 | 38.5 | 0.50 | | |
| SJ  | 2299 | 29.1 | 35.0 | 0.27 | | |
| IMTP | | | | | 1700 | 21.5 |
| Grip | | | | | 50 | |

* `Test Type` 컬럼으로 CMJ / SJ / IMTP / Grip을 식별합니다.
* 컬럼명은 부분 일치로 인식 (예: "Peak Power", "PowerW", "concentric peak power" 모두 가능).
* 단위는 컬럼명에서 자동 인식 (W vs W/kg, N vs N/kg, cm).

#### Wide format (각 행이 한 세션의 종합 요약)

| CMJ Peak Power | SJ Peak Power | IMTP Peak Force | ... |
|----------------|---------------|-----------------|-----|
| 3816 | 2299 | 1700 | ... |

* 컬럼 prefix(`CMJ`, `SJ`, `IMTP`, `Grip`)로 테스트를 식별합니다.

#### 수동 입력 모드

CSV가 없거나 형식이 다른 경우, 입력 폼에서 **"수동 입력"** 토글을 선택하여 다음 값을 직접 입력할 수 있습니다:

* CMJ · SJ 단위파워 (W/kg) 또는 절대파워 (W)
* CMJ · SJ RSI-mod (m/s)
* IMTP 절대 (N) 또는 단위 (N/kg)
* EUR · 악력 (kg)

비워둔 항목은 "미측정"으로 표시되며, 단위파워와 절대파워 중 하나만 입력해도 체중이 있으면 자동 변환됩니다.

## 🧠 분석 결과

리포트 대시보드는 다음 섹션으로 구성됩니다:

1. **Overview** — Peak velocity · Max layback · ETI · CMJ 단위파워 KPI 카드
2. **Core Issue** — 핵심 진단 한 줄 요약 + 강점/약점/체크포인트 카운트
3. **Expected Velocity** — 체력 vs 메카닉스 기반 기대 구속 (Driveline 차용 모델, ±10 km/h cap)
4. **구속 관련 체력** — 6축 레이더 차트 + 5대 측정값
5. **구속 관련 메카닉스** — 에너지 전달 (ETI) · 시퀀싱 · 분절 회전 속도 · Max layback
6. **제구 관련 메카닉스** — 5 Domain 등급 + 7대 요인 + 일관성 측정값
7. **강점·약점** — 자동 도출 텍스트 리스트
8. **체크 포인트** — HIGH/MEDIUM/LOW 등급 플래그
9. **피지컬 트레이닝** — 진단 기반 4–12주 블록 처방
10. **동작 교정 드릴** — D등급 요인별 셀프 드릴

## 🛠 파일 구조

```
index.html              ← 메인 진입점
input.css               ← 입력 페이지 스타일
colors_and_type.css     ← 대시보드 색상·타이포 토큰
dashboard.css           ← 대시보드 메인 스타일
report.css              ← 리포트 인쇄 스타일

analysis.js             ← BBLAnalysis (files에서 가져옴, 무수정)
fitness.js              ← BBLFitness (신규: ForceDecks CSV 파서)
data_builder.js         ← BBLDataBuilder (신규: 분석 결과 → 리포트 데이터)
charts.jsx              ← Radar / Sequence / Angular / Energy 차트 컴포넌트
dashboard.jsx           ← Report 7 대시보드 (window.BBLDashboardApp으로 export)
app.jsx                 ← 입력 폼 + 라우터 (메인 앱)

assets/
  ├ logo-bbl.png
  ├ logo-bbl.svg
  └ max-layback.png
```

## ⚠️ 알려진 제한사항

* **소표본 baseline**: 기대 구속 모델은 BBL 4명 평균(134.7 km/h)을 baseline으로 사용합니다. 약 600명 데이터셋 기반 v1.0 회귀 모델로 업그레이드 예정 (Report 7 v0.1 prototype 기준).
* **strikePct·plateSdCm**: 직접 측정 불가 (Rapsodo 미연동) — 5 Domain 종합 등급 기반 추정값입니다 (DEMO 배지 표시).
* **Head displacement (F6)**: Uplift export에서 직접 추출이 어려워 sway/getting-out fault rate로 대체 평가됩니다.
* **단일 선수 모드**: 본 빌드는 1명의 선수 분석만 지원합니다. 비교 모드는 미사용.

## 📚 출처

* 측정 시스템: Uplift Labs · VALD ForceDecks · Rapsodo
* 바이오메카닉스 분석: BBLAnalysis v2 (자체 구현, Ae 1992 / Yanai 2023 / Naito 2011 등 차용)
* 기대 구속 모델: Driveline Baseball (2021) — *"Predicted Velocity Through Jump and Strength Testing"*
* Elite reference: Fleisig 1999 · Crotin & Ramsey 2014 · Driveline 2024 · Stodden 2005

---

© 2026 BioMotion Baseball Lab · Kookmin University · biomotion.kr
