# zzuring

[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

AION 2 실시간 DPS 미터 오버레이. 게임 네트워크 패킷을 캡처해 데미지·스킬·전투 통계를 표시합니다.

[taengu/A2Tools-DPS-Meter](https://github.com/taengu/A2Tools-DPS-Meter) (GPL-3.0)를 기반으로, 본인 개인 사용 목적에 맞게 커스터마이징한 버전입니다. **재배포하지 않고 본인만 사용하는 용도**이며, 재배포 시 원본 라이선스 조건을 따라야 합니다.

## 주요 기능

- 실시간 DPS 추적 — **보스 대상 전투만** 추적 (다른 모드 선택 없음)
- 이름 / 총딜량 / DPS / 기여도 + 이름 옆에 전투력·장비점수(파티원만), 직업 아이콘
- 설정에서 포지션별 색상, 글자 크기, 대상 이름 크기, 테마 조절
- [캐릭터 비교](docs/character-comparison.md): 전투 성과·장비·스탯 비교
- DOT(지속 피해) 추적, 소환수 데미지 주인에게 합산
- 핑 모니터링, 항상 위 투명 오버레이
- 한국어 고정 (다국어 지원 없음)
- GitHub Releases 기반 자동 업데이트 확인

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

빌드 완료 후 `src-tauri/target/release/bundle/msi/`에 생긴 설치 파일을 관리자 권한으로 실행하세요.

### 개발

```bash
npm run tauri dev
```

## 참고

- 캐릭터 이름 자동 인식이 안 되면 설정에서 직접 입력하세요.
- 전투력·장비점수는 파티(팀) 로스터 패킷에서만 오기 때문에, 같은 파티에 있는 팀원만 표시됩니다.
- 새 버전 배포 방법은 [docs/release.md](docs/release.md) 참고.

## 라이선스

[GPL-3.0](LICENSE)
