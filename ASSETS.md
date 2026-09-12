# 이미지 자산 추가/교체 가이드

이 프로젝트는 `assets/` 아래 폴더에 파일을 넣기만 하면 게임에 자동으로 반영됩니다.
코드(`js/game.js`)를 직접 고칠 필요가 없습니다.

## 사용법

1. 아래 폴더 이름 규칙에 맞춰 이미지 파일을 넣거나 교체합니다.
2. 다음 명령을 한 번 실행합니다.

   ```bash
   node scripts/gen-asset-manifest.js
   ```

3. `index.html`을 새로고침(또는 다시 열기)하면 반영됩니다.

지원 확장자: `.webp` `.png` `.jpg` `.jpeg` `.gif` `.svg`

## 폴더별 파일명 규칙

| 폴더 | 파일명 = | 예시 | 비고 |
|---|---|---|---|
| `assets/enemies/` | 적 정의의 `art` 키 | `guardian.webp`, `boss.webp` | 없으면 SVG 실루엣으로 자동 대체 |
| `assets/props/` | 장소(`PROP_SCENE_MAP`) 키 | `camp.webp`, `shop.webp` | 없으면 소품 이미지 없이 배경만 표시 |
| `assets/heroes/` | 캐릭터 id | `ember.webp`, `frost.webp`, `ash.webp` | 캐릭터 선택 화면 대형 초상화 + 전투 중 영웅 아트. 없으면 SVG 실루엣 사용 |
| `assets/npc/` | 항상 `shopkeeper` | `shopkeeper.webp` | 상점 상인 초상화 |
| `assets/bg/` | 항상 `title` | `title.jpg` | 타이틀 화면 배경 |
| `assets/cards/` | `card_{type}_{element}_{tier}` | `card_atk_fire_2.webp` | 아래 카드 아트 규칙 참고 |

파일이 없으면 게임이 깨지지 않고 기존 SVG/배경 폴백으로 자연스럽게 대체됩니다.

## 카드 아트 (`assets/cards/`)

파일명: `card_{type}_{element}_{tier}.webp`

- `type`: `atk`(공격) 또는 `skl`(술식) — 카드 정의의 `t` 값(attack/skill)을 줄인 것
- `element`: `fire`(불) / `ice`(서리) / `neu`(무속성) — 카드 정의의 `el` 값과 동일 (`el:null`이면 `neu`)
- `tier`: `1` / `2` / `3` — 카드 합성으로 도달한 티어

총 2×3×3 = 18개 파일로 모든 카드 조합을 커버합니다. 예: 무속성 공격 카드가 티어2로 합성됐을 때
`card_atk_neu_2.webp`가 있으면 그 아트가 카드 전체 배경으로 쓰이고(이름·유형·효과 설명은 이미지
하단의 어두운 밴드 위에 표시), 없으면 카드 고유의 인라인 SVG 아이콘 + 기존 프레임으로 대체됩니다.
같은 (type, element, tier) 조합을 쓰는 모든 카드가 파일 하나를 공유합니다 (카드마다 개별 파일이 아님).

## 새 키(새 몬스터·새 장소 등) 추가 시

파일명 규칙은 코드에서 참조하는 키와 반드시 일치해야 합니다. 예를 들어 새 몬스터를 추가한다면
`js/game.js`의 몬스터 정의에서 쓰는 `art: 'newmonster'` 값과 `assets/enemies/newmonster.webp`
파일명이 같아야 합니다. 새 키를 코드에 추가하는 작업 자체는 여전히 필요하지만, 이미지 파일
연결은 스크립트가 자동으로 처리합니다.
