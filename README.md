# zzuring

[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

AION 2 실시간 DPS 미터 오버레이. 게임 네트워크 패킷을 캡처해 데미지·스킬·전투 통계를 표시합니다.

[taengu/A2Tools-DPS-Meter](https://github.com/taengu/A2Tools-DPS-Meter) (GPL-3.0)를 기반으로, 본인 개인 사용 목적에 맞게 커스터마이징한 버전입니다. **재배포하지 않고 본인만 사용하는 용도**이며, 재배포 시 원본 라이선스 조건을 따라야 합니다.

## 주요 기능

- 실시간 DPS 추적 — 이름 / 전투력 / 총딜량 / DPS / 기여도 5개 항목만 항상 표시
- [캐릭터 비교](docs/character-comparison.md): 전투 성과 요약, 공식 장비·스탯 및 상세 옵션 차이
- DOT(지속 피해) 추적, 소환수 데미지 주인에게 합산
- 다양한 타겟 선택 모드 (보스 / 타겟 / 전체 / 훈련)
- 핑 모니터링
- 항상 위 투명 오버레이, 테마 커스터마이징
- 한국어 고정 (다국어 지원 없음), 외부 서버 접속 없음 (자동 업데이트 기능 없음)

## 원본 대비 바뀐 점

- 미터기 행에 랭크 번호·직업 아이콘 대신 컬럼 헤더(이름/전투력/총딜량/DPS/기여도)를 추가하고, 각 컬럼을 고정폭으로 세로 정렬
- DPS/총딜량 토글 없이 항상 같이 표시, 기여도 낮은(3%/5% 미만) 행은 경고색으로 강조
- 자동 업데이트 확인/다운로드/설치 기능 완전 삭제 — 이 앱은 어떤 외부 서버에도 접속하지 않음
- 전투 기록(History), 후원(Support/Discord/A2Tools.app) 버튼·모달 완전 삭제
- 다국어 지원 제거, 한국어 고정
- 상세 스킬 분석(Details) 패널·DPS 차트·타임라인은 화면에서 숨김 (Rust 백엔드 코드는 남아있으나 호출되지 않음)

핵심 엔진(패킷 캡처, DPS/전투력/기여도 계산 — Rust, `src-tauri/`의 capture/combat/entity 모듈)은 원본 그대로입니다.

## 요구 사항

- **Windows 10/11** (x86_64)
- **[Npcap](https://npcap.com)** — 패킷 캡처에 필요
  - 설치 시 **"Install Npcap in WinPcap API-compatible Mode"** 체크
- **관리자 권한** — 패킷 캡처에 필요

## 빌드 (Windows에서만 가능)

패킷 캡처(Npcap)가 필요해서 Windows에서만 빌드/실행할 수 있습니다.

### 필수 구성 요소

- [Rust](https://rustup.rs/) (최신 안정 버전)
- [Node.js](https://nodejs.org/) (v18+)
- [Npcap](https://npcap.com) 설치 — 설치 중 **"Install Npcap in WinPcap API-compatible Mode"** 체크 필수

### 빌드

```bash
npm install
npm run tauri build
```

빌드 완료 후 `src-tauri/target/release/bundle/msi/`에 생긴 설치 파일을 관리자 권한으로 실행하세요 (원시 패킷 캡처 때문).

### 개발

```bash
npm run tauri dev
```

## 참고

- 캐릭터 이름 자동 인식이 안 되면 설정(Settings)에서 캐릭터 이름을 직접 입력하세요.
- 전투력은 파티(팀) 로스터 패킷에서만 오기 때문에, 같은 파티에 있는 팀원만 표시됩니다.
- 이 버전은 개인 사용 목적으로만 만들었으며, 재배포용이 아닙니다.

## 라이선스

[GPL-3.0](LICENSE)
