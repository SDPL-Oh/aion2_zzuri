# 캐릭터 비교

미터기의 캐릭터 행 오른쪽 **비교** 링크를 누르면 별도 창에 비교 페이지가 열립니다. 기존 행 클릭은 전투 상세 화면을 계속 엽니다.

- 01 전투 성과: 한 박스 안에서 상대(왼쪽)와 나(오른쪽)의 캐릭터/장비 레벨, 전투력, DPS, 총 피해량, 강타율, 치명타율을 비교합니다.
- 02 장비 · 스킬 · 스탯: 공식 정보실의 현재 장비, 습득 스킬 레벨, 기본/주신 스탯과 효과를 비교합니다. 스탯은 화면 맨 아래에 표시합니다.
- 장비명 옆에 강화 수치와 방패 모양의 돌파 수치를 표시하고, 각 부위의 추가 옵션만 자동으로 조회합니다.
- 부위별 장비는 **전체 / 무기·방어구 / 장신구** 버튼으로 나누어 볼 수 있습니다.
- **차이 있는 항목만**: 같은 스탯을 숨깁니다. 장비는 기본 구성과 조회된 상세 옵션이 모두 같아야 숨깁니다. 아직 조회하지 않은 옵션을 같다고 추정하지 않습니다.

## 캐릭터와 전투 식별

내 캐릭터는 미터기의 `localPlayerId`를 우선 사용하며, 피해 기록에 없더라도 설정된 캐릭터명을 선택 항목에 보존합니다. 인식되지 않았다면 비교 창에서 전투 참가자를 선택합니다. 서버는 파티 명단의 서버 정보를 이용합니다. 서버 정보가 없으면 사용자가 서버를 선택하고 조회합니다. 검색 결과의 이름·서버가 일치하는 캐릭터만 전투 기록에 연결합니다.

전투는 클릭 시점에 고정됩니다. 단일 타겟의 상세 기록이 있으면 두 캐릭터 모두 같은 상세 응답과 전투 시간으로 계산합니다. 지속 피해는 총 피해에 포함하지만 강타율과 치명타율의 분모에서는 제외합니다. 전체 타겟 모드 등 상세 기록을 가져올 수 없는 경우 DPS/피해량은 미터기 스냅샷을 사용하고 타격 비율은 확인 불가로 표시합니다. 내 수치가 0일 때 증감률은 계산하지 않습니다.

장비·스탯은 공식 정보실 조회 시점의 데이터입니다. 전투 당시 장비를 복원하지 않으며 DPS 차이의 원인을 자동으로 단정하지 않습니다. 날개처럼 슬롯 번호가 제공되지 않는 부위는 기본 장비 정보만 표시하고 상세 옵션 조회 제한을 안내합니다.

## 실행과 검증

```sh
npm run dev
# http://localhost:1420/compare.html : 장비·스탯 직접 비교
# http://localhost:1420/tests/comparison-fixture.html : 예시 전투로 실제 미터기 링크 검증
node --test tests/comparison.test.mjs
npm run build
npm run tauri dev
```

`tests/comparison-fixture.html`의 전투는 명확히 표시된 예시이며 빌드 결과에는 포함하지 않습니다. `public/compare.html`과 관련 JS/CSS는 Vite의 public 복사로 앱 배포에 포함됩니다.

네이티브 앱은 `comparison_api` Rust 명령으로 공식 정보실에 GET 요청합니다. 개발/미리보기 브라우저는 Vite의 `/comparison-api/` 프록시를 사용합니다. 정적 파일만 외부 호스팅하려면 같은 경로의 서버 프록시를 별도로 구성해야 합니다. 별도 호스팅이나 배포는 이 변경에 포함하지 않습니다.

## 공식 데이터 경로

[공식 캐릭터 정보실](https://aion2.plaync.com/ko-kr/characters)과 [공식 프런트엔드](https://assets.playnccdn.com/static-aion2/characters/js/index.js)에서 확인한 읽기 전용 경로입니다.

- `/api/gameinfo/servers?lang=ko`
- `/api/search/character` : keyword, race, serverId, page, size
- `/api/character/info` : lang, serverId, characterId
- `/api/character/equipment` : lang, serverId, characterId
- `/api/character/equipment/item` : id, enchantLevel, serverId, characterId, slotPos

공식 웹사이트 내부 조회 경로이므로 형식과 제공 범위가 변경될 수 있습니다. 검색 결과의 URL 인코딩된 ID는 한 번 디코딩한 뒤 쿼리 직렬화합니다. 모든 화면 문자열은 텍스트로 렌더링합니다. 실패 시 재조회가 가능하며 누락 정보를 0으로 대체하지 않습니다.
