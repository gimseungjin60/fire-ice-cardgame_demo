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
| `assets/heroes/` | 캐릭터 id | `ember.webp`, `frost.webp`, `ash.webp` | 캐릭터 선택 화면 전용 대형 초상화. 없으면 SVG 실루엣 사용 (전투 중에는 항상 SVG) |
| `assets/npc/` | 항상 `shopkeeper` | `shopkeeper.webp` | 상점 상인 초상화 |
| `assets/bg/` | 항상 `title` | `title.jpg` | 타이틀 화면 배경 |
| `assets/cards/` | 카드 아트 (Phase B) | `card_공격_불_1.webp` 등 | 규칙은 카드 합성 기능 구현 시 확정 |

파일이 없으면 게임이 깨지지 않고 기존 SVG/배경 폴백으로 자연스럽게 대체됩니다.

## 새 키(새 몬스터·새 장소 등) 추가 시

파일명 규칙은 코드에서 참조하는 키와 반드시 일치해야 합니다. 예를 들어 새 몬스터를 추가한다면
`js/game.js`의 몬스터 정의에서 쓰는 `art: 'newmonster'` 값과 `assets/enemies/newmonster.webp`
파일명이 같아야 합니다. 새 키를 코드에 추가하는 작업 자체는 여전히 필요하지만, 이미지 파일
연결은 스크립트가 자동으로 처리합니다.
