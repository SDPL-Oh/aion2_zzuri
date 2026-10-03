# 릴리스(자동 업데이트) 배포

## 자동 배포 (권장)

`.github/workflows/release.yml`이 태그 푸시 시 Windows 러너에서 서명 빌드 → GitHub Release 생성 → `.msi`와 `latest.json` 첨부까지 전부 처리한다 (Npcap은 런타임에 `wpcap.dll`을 로드하므로 빌드에 불필요).

**최초 1회 설정** — GitHub 저장소 Settings → Secrets and variables → Actions에 등록:

- `TAURI_SIGNING_PRIVATE_KEY`: `src-tauri/updater.key` 파일 내용 전체
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: 키 비밀번호 (없으면 빈 값으로 등록)

**릴리스할 때:** 아래 1번(버전 올리기) 후 커밋·푸시하고 태그를 푸시한다.

```bash
git tag v1.0.6 && git push origin main v1.0.6
```

태그는 반드시 `v` + `tauri.conf.json`의 버전과 같아야 한다. 이후 2~4번은 자동이며, 아래는 수동으로 해야 할 때의 절차다.

---

이미 설치된 앱이 새 버전을 자동으로 감지하게 하려면, 아래 순서를 **빠짐없이** 따라야 한다. 서명 없이 빌드하거나 GitHub Release를 만들지 않으면 업데이트 확인은 조용히 아무 일도 하지 않는다 (에러도 안 뜸).

## 1. 버전 올리기

다음 4곳의 버전 번호를 전부 동일하게 올린다 (예: `1.0.3` → `1.0.4`):

- `src-tauri/tauri.conf.json`의 `"version"` — **업데이터가 실제로 비교하는 값**
- `src-tauri/Cargo.toml`의 `version`
- `src-tauri/Cargo.lock`의 `[[package]] name = "a2tools-dps-meter"` 블록 안 `version` — **이 한 줄만**. Cargo.lock에는 같은 버전 번호(예: "1.0.2")를 쓰는 무관한 라이브러리가 여러 개 있을 수 있어서, 텍스트 치환으로 한 번에 바꾸면 안 된다. 바꾼 뒤 `git diff src-tauri/Cargo.lock`으로 이 블록만 바뀌었는지 확인할 것.
- `package.json`의 `"version"` (`package-lock.json`도 같이)

## 2. 서명해서 빌드 (Windows에서만 가능)

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw src-tauri\updater.key
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npm run tauri build
```

`src-tauri/updater.key`(서명 개인키)는 git에 안 올라간다 — 빌드하는 PC에 미리 직접 복사해둬야 한다. 잃어버리면 이미 설치된 앱들과 호환되는 서명을 다시 만들 수 없다.

## 3. 업데이트 매니페스트 생성

```bash
npm run release:manifest
```

`src-tauri/target/release/bundle/msi/`에 `latest.json`이 생성된다. 이 폴더에는 예전 버전 빌드도 계속 쌓이는데, 스크립트가 **현재 버전과 파일명이 일치하는 msi**만 자동으로 골라낸다.

## 4. GitHub Release 발행

- 태그: 정확히 `v` + 버전 (예: `v1.0.4`) — 다르면 다운로드 링크가 깨진다
- 첨부 파일 2개: `bundle/msi/`의 `.msi`, `latest.json`

이 순간부터 이미 설치된 구버전 앱이 다음 실행 시 이 릴리스를 감지해서 설치를 제안한다.
