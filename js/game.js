"use strict";
(function(){

/* ═══════════════════════════════════════════════════════════
   0. 유틸 / 결정론적 난수
   ═══════════════════════════════════════════════════════════ */
const $  = (s, r) => (r||document).querySelector(s);
const $$ = (s, r) => Array.from((r||document).querySelectorAll(s));
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// mulberry32 — 시드 고정으로 모든 테스터가 동일한 런을 플레이
function makeRng(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// ── 난수 스트림 분리 ──
// 셔플은 플레이 방식에 따라 소비량이 달라진다. 보상·전리품·상점이 같은
// 스트림을 쓰면 "누가 어떻게 플레이했느냐"가 뒤의 모든 결과를 밀어버려
// 시드를 고정해도 테스터마다 다른 런이 된다. 그래서 용도별로 끊어 쓴다.
function subSeed(tag, idx){
  let h = (SEED ^ Math.imul(tag, 0x9E3779B1)) >>> 0;
  h = (h + Math.imul(idx + 1, 0x85EBCA6B)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h;
}
const riR    = (r, n) => Math.floor(r() * n);
const pickR  = (r, a) => a[riR(r, a.length)];
function shuffleWith(r, arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = riR(r, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const RNG = {
  shuffle: makeRng(1),                       // 연속 스트림 (셔플 전용)
  reward:  n => makeRng(subSeed(1, n)),      // 전투 번호로만 결정
  loot:    n => makeRng(subSeed(2, n)),
  shop:    () => makeRng(subSeed(3, 0)),
  reset(){ this.shuffle = makeRng((SEED ^ 0x5F356495) >>> 0); }
};
const shuffle = arr => shuffleWith(RNG.shuffle, arr);

const DEFAULT_SEED = 20260905;
const urlSeed = new URLSearchParams(location.search).get('seed');
const SEED = urlSeed && /^\d+$/.test(urlSeed) ? parseInt(urlSeed, 10) : DEFAULT_SEED;

/* ═══════════════════════════════════════════════════════════
   1. 아트 — 인라인 SVG
   ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   카드별 고유 아트 — 20종
   ═══════════════════════════════════════════════════════════ */
const CA = {
strike:`<path d="M62 16 L84 38 L38 84 L22 84 L22 68z" fill="#3A2028" stroke="#E4899A" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M58 22 L78 42" stroke="#FFD9E0" stroke-width="2.6" stroke-linecap="round"/>
<path d="M22 68 L36 82" stroke="#8A4A58" stroke-width="3"/>
<path d="M70 8 L74 20 L86 24 L74 28 L70 40 L66 28 L54 24 L66 20z" fill="#FFE3EA" opacity=".85"/>`,

defend:`<path d="M50 12 L82 24 v26c0 20-13 32-32 38C31 82 18 70 18 50V24z" fill="#152438" stroke="#9CC4E8" stroke-width="2.6" stroke-linejoin="round"/>
<path d="M50 22 L72 30v20c0 14-9 22-22 27-13-5-22-13-22-27V30z" fill="none" stroke="#5C86AE" stroke-width="1.6"/>
<path d="M50 34 v30 M38 46 h24" stroke="#BFE0FF" stroke-width="3" stroke-linecap="round" opacity=".9"/>`,

ember_toss:`<circle cx="52" cy="56" r="24" fill="#5C1F0C"/>
<path d="M52 32c4 14-6 18-11 26-4 7-6 12-6 17 0 10 8 17 17 17s17-7 17-17c0-9-7-14-11-21-4-7-6-13-6-22z" fill="#F0562D"/>
<path d="M52 52c2 7-4 9-6 13-2 3-3 6-3 9 0 5 4 9 9 9s9-4 9-9c0-4-3-7-5-11-2-4-3-7-4-11z" fill="#FFD9A8"/>
<g stroke="#FF9B52" stroke-width="2.4" stroke-linecap="round"><path d="M18 30 L32 40M86 26 L74 38M14 66 L26 66"/></g>`,

frost_shard:`<path d="M50 10 L66 44 L50 92 L34 44z" fill="#0F2C3A" stroke="#7FD8F2" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M50 22 L58 45 L50 74 L42 45z" fill="#4FC4E8" opacity=".45"/>
<g stroke="#BEEEFF" stroke-width="2" stroke-linecap="round"><path d="M20 26 L30 40M80 26 L70 40M16 62 L28 56M84 62 L72 56"/></g>
<circle cx="50" cy="44" r="4" fill="#EAFBFF"/>`,

mark:`<path d="M10 50c8-16 22-26 40-26s32 10 40 26c-8 16-22 26-40 26S18 66 10 50z" fill="#2A0F16" stroke="#FF7C97" stroke-width="2.4"/>
<circle cx="50" cy="50" r="15" fill="#C4384B" opacity=".5"/><circle cx="50" cy="50" r="15" fill="none" stroke="#FF9FB2" stroke-width="2"/>
<circle cx="50" cy="50" r="5.5" fill="#FFE6EB"/>
<path d="M50 12 v10 M50 78 v10 M14 84 l10-8 M86 84 l-10-8" stroke="#FF7C97" stroke-width="2.2" stroke-linecap="round"/>`,

regroup:`<rect x="14" y="26" width="30" height="44" rx="4" fill="#1B2436" stroke="#8FB6DC" stroke-width="2.2" transform="rotate(-11 29 48)"/>
<rect x="34" y="22" width="30" height="46" rx="4" fill="#22304A" stroke="#A8CCEE" stroke-width="2.2"/>
<rect x="56" y="26" width="30" height="44" rx="4" fill="#1B2436" stroke="#8FB6DC" stroke-width="2.2" transform="rotate(11 71 48)"/>
<path d="M49 34 v22 M40 47 l9 9 9-9" stroke="#DDEEFF" stroke-width="2.6" stroke-linecap="round" fill="none"/>`,

sigil:`<circle cx="50" cy="50" r="32" fill="none" stroke="#F0562D" stroke-width="2" stroke-dasharray="4 7"/>
<path d="M50 22 L74 64 H26z" fill="#5C1F0C" stroke="#FF9B52" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M50 38 L64 60 H36z" fill="#F0562D" opacity=".6"/>
<circle cx="50" cy="54" r="5" fill="#FFDCB8"/>
<g stroke="#FFB27A" stroke-width="2" stroke-linecap="round"><path d="M50 10v8M18 76l6-6M82 76l-6-6"/></g>`,

frost_ward:`<path d="M50 12 L82 24 v26c0 20-13 32-32 38C31 82 18 70 18 50V24z" fill="#0E2735" stroke="#7FD8F2" stroke-width="2.6" stroke-linejoin="round"/>
<g stroke="#BEEEFF" stroke-width="2.4" stroke-linecap="round"><path d="M50 28 v40 M32 40 l36 22 M68 40 L32 62"/></g>
<circle cx="50" cy="50" r="6" fill="#4FC4E8" opacity=".55"/><circle cx="50" cy="50" r="2.6" fill="#EAFBFF"/>`,

flurry:`<path d="M56 14 L74 32 L34 72 H20 V58z" fill="#3A2028" stroke="#E4899A" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M78 26 L90 38 L52 76 H40" fill="none" stroke="#E4899A" stroke-width="2.2" stroke-linejoin="round" opacity=".65"/>
<path d="M52 20 L68 36" stroke="#FFD9E0" stroke-width="2.4" stroke-linecap="round"/>
<path d="M18 84 h20 M46 84 h16" stroke="#8A4A58" stroke-width="2.4" stroke-linecap="round"/>`,

sleet:`<path d="M14 24 q12 -8 22 0 q11 -8 22 0 q11 -8 22 0" fill="none" stroke="#7FD8F2" stroke-width="2.6" stroke-linecap="round"/>
<g stroke="#BEEEFF" stroke-width="2.6" stroke-linecap="round">
<path d="M26 40 L18 62M42 38 L34 66M58 40 L50 62M74 38 L66 66"/></g>
<g fill="#4FC4E8"><circle cx="30" cy="76" r="3.4"/><circle cx="52" cy="82" r="3"/><circle cx="70" cy="76" r="3.4"/></g>
<path d="M84 52 l6 10 -6 10 -6 -10z" fill="#B79BE0" opacity=".8"/>`,

kindle:`<path d="M56 8 L32 50 h16 L40 92 L70 46 H52z" fill="#F0562D" stroke="#FFC98A" stroke-width="2" stroke-linejoin="round"/>
<path d="M52 20 L42 46 h12 L48 72" fill="none" stroke="#FFE3C2" stroke-width="2" stroke-linecap="round"/>
<g fill="#FFB27A"><circle cx="20" cy="28" r="3"/><circle cx="80" cy="66" r="3"/><circle cx="24" cy="72" r="2.4"/></g>`,

glacier:`<path d="M8 78 L30 30 L46 56 L60 22 L92 78z" fill="#12384A" stroke="#7FD8F2" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M30 30 L38 46 L46 56 L52 40 L60 22" fill="none" stroke="#BEEEFF" stroke-width="2"/>
<path d="M8 78 h84" stroke="#4FC4E8" stroke-width="3" stroke-linecap="round"/>
<g fill="#EAFBFF" opacity=".9"><path d="M30 30 L36 42 L24 42z"/><path d="M60 22 L68 38 L52 38z"/></g>`,

detonate:`<circle cx="50" cy="50" r="18" fill="#F0562D" opacity=".55"/>
<path d="M50 4 L58 32 L86 20 L68 44 L96 52 L68 58 L82 84 L56 68 L50 96 L44 68 L18 84 L32 58 L4 52 L32 44 L14 20 L42 32z" fill="none" stroke="#FF9B52" stroke-width="2.4" stroke-linejoin="round"/>
<circle cx="50" cy="50" r="8" fill="#FFE9C2"/>`,

coldsnap:`<g stroke="#7FD8F2" stroke-width="3" stroke-linecap="round"><path d="M50 8 v84 M13 29 l74 42 M87 29 L13 71"/></g>
<g stroke="#BEEEFF" stroke-width="2.2" stroke-linecap="round">
<path d="M50 22 l-9-9 M50 22 l9-9 M50 78 l-9 9 M50 78 l9 9
M30 38 l-12-2 M30 38 l-2-12 M70 62 l12 2 M70 62 l2 12
M30 62 l-12 2 M30 62 l-2 12 M70 38 l12-2 M70 38 l2-12"/></g>
<circle cx="50" cy="50" r="7" fill="#4FC4E8" opacity=".5"/><circle cx="50" cy="50" r="3.4" fill="#EAFBFF"/>`,

forge:`<path d="M56 10 L90 44 L76 58 L42 24z" fill="#3A2A1C" stroke="#F2CE7C" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M44 28 L20 52 v30 h14 L62 50" fill="none" stroke="#B98F4A" stroke-width="4" stroke-linejoin="round"/>
<g stroke="#FF9B52" stroke-width="2.4" stroke-linecap="round"><path d="M14 20 l8 8M84 74 l-8-8M20 78 l-6 6"/></g>
<circle cx="66" cy="34" r="5" fill="#FFD9A8" opacity=".9"/>`,

firewall:`<rect x="12" y="30" width="76" height="54" rx="3" fill="#241512" stroke="#F0562D" stroke-width="2.4"/>
<g stroke="#8A4426" stroke-width="2"><path d="M12 48h76M12 66h76M34 30v18M62 30v18M24 48v18M50 48v18M76 48v18M40 66v18M68 66v18"/></g>
<path d="M50 6c3 11-5 14-9 21-3 5-4 9-4 12 0 8 6 13 13 13s13-5 13-13c0-7-5-11-8-17-3-5-4-10-5-16z" fill="#F0562D"/>
<path d="M50 24c1 6-3 7-4 11-1 2-2 4-2 6 0 4 3 7 6 7s6-3 6-7c0-3-2-5-3-8z" fill="#FFD9A8"/>`,

heavy:`<path d="M50 6 L72 30 L62 40 L58 34 v42 h-16 V34 l-4 6 L28 30z" fill="#2A2432" stroke="#C9CDDC" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M34 78 h32 l6 12 H28z" fill="#3A3446" stroke="#C9CDDC" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M50 16 v50" stroke="#F2F4FA" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>
<g stroke="#8E93A6" stroke-width="2" stroke-linecap="round"><path d="M14 46 l10 6M86 46 l-10 6"/></g>`,

ashstorm:`<path d="M8 26 q18 -10 34 0 q18 -10 34 0M6 44 q20 -10 40 0 q20 -10 40 0" fill="none" stroke="#8A4426" stroke-width="2.6" stroke-linecap="round"/>
<path d="M50 32c4 16-8 20-13 30-5 8-7 14-7 20 0 11 9 18 20 18s20-7 20-18c0-10-8-16-13-24-4-8-6-15-7-26z" fill="#F0562D"/>
<path d="M50 56c2 8-4 10-6 15-2 4-3 7-3 10 0 5 4 9 9 9s9-4 9-9c0-4-2-7-4-11z" fill="#FFD9A8"/>
<g fill="#FFB27A"><circle cx="16" cy="66" r="3.2"/><circle cx="86" cy="60" r="2.8"/><circle cx="24" cy="86" r="2.4"/><circle cx="80" cy="86" r="3"/></g>`,

abszero:`<path d="M50 8 L84 26 v30c0 22-14 34-34 40C30 90 16 78 16 56V26z" fill="#0C2432" stroke="#7FD8F2" stroke-width="2.6" stroke-linejoin="round"/>
<g stroke="#BEEEFF" stroke-width="2.6" stroke-linecap="round"><path d="M50 22 v50 M28 34 l44 26 M72 34 L28 60"/></g>
<g stroke="#EAFBFF" stroke-width="1.8" stroke-linecap="round"><path d="M50 32 l-7-7M50 32 l7-7M50 62 l-7 7M50 62 l7 7"/></g>
<circle cx="50" cy="47" r="7" fill="#4FC4E8" opacity=".5"/><circle cx="50" cy="47" r="3" fill="#fff"/>`,

rekindle:`<path d="M50 86C36 74 18 60 18 42 18 30 27 22 38 22c6 0 10 3 12 6 2-3 6-6 12-6 11 0 20 8 20 20 0 18-18 32-32 44z" fill="#2A1A20" stroke="#E4899A" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M50 40c2 9-4 11-6 15-2 4-3 6-3 9 0 6 4 10 9 10s9-4 9-10c0-4-3-7-5-11-2-4-3-7-4-13z" fill="#F0562D" opacity=".9"/>
<circle cx="50" cy="62" r="3.4" fill="#FFE3C2"/>
<g stroke="#FF9FB2" stroke-width="2" stroke-linecap="round"><path d="M16 22 l6 6M84 22 l-6 6"/></g>`
};

const ICON = {
  sword:'<path d="M14.5 3.5 20.5 9.5 9 21H3v-6L14.5 3.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/><path d="M12.5 5.5 18.5 11.5" stroke="currentColor" stroke-width="1.6"/>',
  shield:'<path d="M12 3 20 6.2v5.4c0 5-3.4 8.6-8 9.9-4.6-1.3-8-4.9-8-9.9V6.2L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>',
  flame:'<path d="M12 3c.6 3.4-1.4 4.6-2.9 6.4C7.4 11.5 6 13 6 15.2 6 18.7 8.7 21 12 21s6-2.3 6-5.8c0-3.4-2.6-5.3-4-7.4-1-1.5-1.5-3-2-4.8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/><path d="M12 21c-1.9 0-3.2-1.3-3.2-3 0-2 1.9-2.7 2.6-4.6.9 1.5 3.8 2.6 3.8 4.7 0 1.7-1.3 2.9-3.2 2.9z" fill="currentColor" opacity=".45"/>',
  snow:'<path d="M12 2v20M3.4 7l17.2 10M20.6 7 3.4 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 6.4 9.6 4M12 6.4 14.4 4M12 17.6 9.6 20M12 17.6l2.4 2.4M6.9 9.4 3.6 9.9M6.9 9.4 6.3 6.1M17.1 14.6l3.3-.5M17.1 14.6l.6 3.3M6.9 14.6l-3.3.5M6.9 14.6l-.6 3.3M17.1 9.4l3.3.5M17.1 9.4l.6-3.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  down:'<path d="M12 4v14M6.5 12.5 12 18.5l5.5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  up:'<path d="M12 20V6M6.5 11.5 12 5.5l5.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  cards:'<rect x="3" y="6" width="11" height="15" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M7.5 3.6 17.8 5.4a2 2 0 0 1 1.6 2.3l-2 11.3" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  burst:'<path d="M12 2.5 14.3 9l6.7.3-5.2 4.2 1.8 6.5L12 16.3 6.4 20l1.8-6.5L3 9.3 9.7 9 12 2.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>',
  heart:'<path d="M12 20.5s-7.4-4.7-7.4-10.1A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.4 3c0 5.4-7.4 10.1-7.4 10.1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>',
  hammer:'<path d="M13.5 3.5 21 11l-3 3-7.5-7.5 3-3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/><path d="M11 8.5 3.5 16v4.5H8L15.5 13" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>',
  wall:'<path d="M3 6h18M3 12h18M3 18h18M8 6v6M16 6v6M12 12v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="3" y="6" width="18" height="12" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  camp:'<path d="M12 21 6 8M12 21l6-13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M4 21h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="5" r="2.6" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  shop:'<path d="M4 9h16l-1.3 11.2a1 1 0 0 1-1 .8H6.3a1 1 0 0 1-1-.8L4 9z" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  skull:'<path d="M12 2.5c5 0 8 3.4 8 7.8 0 2.7-1.2 4.2-2.4 5.2-.6.5-.9 1-.9 1.8v1.4a1.3 1.3 0 0 1-1.3 1.3H8.6a1.3 1.3 0 0 1-1.3-1.3v-1.4c0-.8-.3-1.3-.9-1.8C5.2 14.5 4 13 4 10.3c0-4.4 3-7.8 8-7.8z" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="9" cy="11" r="1.9" fill="currentColor"/><circle cx="15" cy="11" r="1.9" fill="currentColor"/>',
  trash:'<path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l1 13.2h9L17.5 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  bolt:'<path d="M13.5 2 5 13.5h5.5L9.5 22 19 10.5h-5.5L13.5 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>',
};
const ico = (k, cls) => `<svg viewBox="0 0 24 24" fill="none" class="${cls||''}" aria-hidden="true">${ICON[k]||''}</svg>`;

/* ═══════════════════════════════════════════════════════════
   구간별 배경 씬 — 원경 / 중경 / 근경 조합
   ═══════════════════════════════════════════════════════════ */
const SV = (inner, ratio) =>
  `<svg viewBox="0 0 1200 700" preserveAspectRatio="${ratio||'xMidYMax slice'}">${inner}</svg>`;

const STARFIELD = (()=>{ const r=makeRng(7); let o='';
  for(let i=0;i<110;i++){ o+=`<circle cx="${(r()*1200).toFixed(1)}" cy="${(r()*440).toFixed(1)}" r="${(r()*1.35+.25).toFixed(2)}" opacity="${(r()*.5+.1).toFixed(2)}"/>`; }
  return o; })();

/* ── 원경 ── */
const FAR = {
towers: SV(`<g fill="#080B12" opacity=".95">
<path d="M0 700V430l52-16 14-92 22 88 46 12 8-140 26 138 60 20V700z"/>
<path d="M150 700V470l40-14 18-118 20 116 52 18 10-96 22 94 44 16V700z"/>
<path d="M1200 700V440l-58-18-16-104-20 100-50 16-12-124-24 122-56 20V700z"/>
<path d="M1040 700V486l-44-16-14-88-18 86-48 16V700z"/>
<path d="M420 700V520l34-12 12-70 16 68 40 14V700z"/>
<path d="M700 700V512l38-14 14-80 16 78 42 16V700z"/></g>
<g stroke="#161C2C" stroke-width="1" opacity=".45" fill="none"><path d="M96 322v378M232 356v344M1126 318v382M978 398v302"/></g>`),

peaks: SV(`<g fill="#070A11" opacity=".95">
<path d="M0 700V520l120-140 90 96 70-64 110 128 90-70 130 150 100-90 120 112 90-76 140 148 140-120V700z"/></g>
<g fill="#0C1220" opacity=".8">
<path d="M0 700V600l150-90 110 74 130-58 160 96 140-70 180 108 170-90 160 96V700z"/></g>
<g stroke="#1A2536" stroke-width="1" opacity=".5" fill="none"><path d="M210 476l40 40M480 512l50 42M810 468l52 46M1060 502l44 40"/></g>`),

chasm: SV(`<g fill="#06070E"><path d="M0 700V400h1200v300z"/></g>
<g fill="#0A0D18" opacity=".9">
<path d="M0 400h1200v40l-120 26-140-18-160 30-150-24-160 26-150-20-120 22z"/></g>
<g fill="#0B0E1A" opacity=".85">
<path d="M180 700V470l60-26 40 34-20 54 34 30-24 138z"/>
<path d="M960 700V440l70 34-26 46 40 34-30 146z"/>
<path d="M560 700V520l50-18 26 30-18 40 26 26-20 102z"/></g>
<g stroke="#7B3BC4" stroke-width="1.2" opacity=".22" fill="none"><path d="M0 400h1200"/></g>`),

vault: SV(`<g fill="#080B12" opacity=".95">
<path d="M0 700V300h1200v400z"/></g>
<g fill="none" stroke="#141A28" stroke-width="3" opacity=".8">
<path d="M150 700V330q0-70 70-70t70 70v370M450 700V330q0-70 70-70t70 70v370M750 700V330q0-70 70-70t70 70v370M1050 700V330q0-70 70-70t70 70v370"/></g>
<g fill="#0B0F1B"><path d="M0 300h1200v34H0z"/></g>`)
};

/* ── 중경: 구간의 정체성 ── */
const MID = {
// 무너진 대계단
stairs: SV(`<g fill="#0D111C">
<path d="M240 700V560h120v-42h120v-42h120v-44h120v-42h120v-40h120v250z"/></g>
<g fill="#11161F" opacity=".9">
<path d="M240 560h120v-8H240zM360 518h120v-8H360zM480 476h120v-8H480zM600 432h120v-8H600zM720 390h120v-8H720zM840 350h120v-8H840z"/></g>
<g fill="#090C14"><path d="M600 432l-46 44 62 6-30 44 74-10-40 62 96-26-52 62 130-52" opacity=".85"/></g>
<g stroke="var(--tint)" stroke-width="1.4" opacity=".3" fill="none"><path d="M240 560h720M240 700h720"/></g>
<g fill="var(--tint)" opacity=".45"><circle cx="368" cy="546" r="3.4"/><circle cx="608" cy="418" r="3"/><circle cx="848" cy="336" r="3.4"/></g>`),

// 얼어붙은 통로
icefall: SV(`<g fill="#0C1A26" opacity=".95">
<path d="M0 700V180l80 30 40-60 60 80 50-40 60 90V700zM1200 700V160l-90 40-40-70-60 90-50-46-70 100V700z"/></g>
<g fill="#123246" opacity=".75">
<path d="M300 120l24 190-24 40-24-40zM420 90l20 150-20 34-20-34zM780 100l22 170-22 36-22-36zM900 130l18 140-18 30-18-30z"/></g>
<g fill="#1B4E68" opacity=".6">
<path d="M180 0l30 230-30 44-30-44zM1020 0l28 210-28 40-28-40z"/></g>
<g fill="#7FD8F2" opacity=".28">
<path d="M300 120l10 190-10 40-10-40zM780 100l9 170-9 36-9-36z"/></g>
<g fill="#0E2536"><path d="M0 700V520l160-40 140 46 180-56 190 60 170-52 180 48 180-40V700z"/></g>
<g stroke="#4FC4E8" stroke-width="1.2" opacity=".3" fill="none"><path d="M0 520h1200"/></g>`),

// 잿불 안뜰
brazier: SV(`<g fill="#100C10" opacity=".95">
<path d="M0 700V260h150v440zM1200 700V240h-150v460z"/></g>
<g fill="#150F10"><path d="M150 700V420h120v280zM930 700V400h120v300z"/></g>
<g fill="#0D0A0D"><path d="M0 240h180l-14-30H14zM1020 220h180l-14-30h-152z"/></g>
<!-- 화로 -->
<g transform="translate(340 520)">
  <path d="M-40 60h80l-12-46h-56z" fill="#1C1512" stroke="#5C3A22" stroke-width="2"/>
  <path d="M-26 14h52l-8-14h-36z" fill="#241A14"/>
  <path d="M0 -70c6 26-12 32-20 48-7 13-10 22-10 30 0 17 13 28 30 28s30-11 30-28c0-16-12-25-18-38-7-13-10-22-12-40z" fill="var(--tint)" opacity=".7" class="flick"/>
  <path d="M-16 78h32l4 22h-40z" fill="#100B0A"/>
</g>
<g transform="translate(860 500)">
  <path d="M-40 60h80l-12-46h-56z" fill="#1C1512" stroke="#5C3A22" stroke-width="2"/>
  <path d="M-26 14h52l-8-14h-36z" fill="#241A14"/>
  <path d="M0 -62c5 24-11 30-18 44-6 12-9 20-9 28 0 16 12 26 27 26s27-10 27-26c0-15-11-23-16-35-6-12-9-20-11-37z" fill="var(--tint)" opacity=".62" class="flick"/>
  <path d="M-16 78h32l4 22h-40z" fill="#100B0A"/>
</g>
<g fill="#0B0810"><path d="M0 700V600h1200v100z"/></g>`),

// 봉인된 문
gate: SV(`<g fill="#0B0810" opacity=".96"><path d="M0 700V200h1200v500z"/></g>
<g transform="translate(600 400)">
  <path d="M-230 300V-40q0-160 230-160T230 -40v340z" fill="#120A12" stroke="#3A1C28" stroke-width="4"/>
  <path d="M-170 300V-30q0-120 170-120T170 -30v330z" fill="#0A060B" stroke="#2E1620" stroke-width="3"/>
  <path d="M0 -150V300" stroke="#2E1620" stroke-width="5"/>
  <g stroke="var(--tint)" stroke-width="2.4" fill="none" opacity=".55" class="flick">
    <circle cx="0" cy="-20" r="66"/><circle cx="0" cy="-20" r="40" stroke-dasharray="10 14"/>
    <path d="M0 -86 L57 13 H-57z"/><path d="M0 46 L-57 -53 H57z"/></g>
  <circle cx="0" cy="-20" r="13" fill="var(--tint)" opacity=".7"/>
  <g stroke="#3A1C28" stroke-width="2.4" fill="none" opacity=".8">
    <path d="M-170 90h340M-170 170h340M-170 250h340"/></g>
  <g fill="#3A1C28"><circle cx="-120" cy="130" r="7"/><circle cx="120" cy="130" r="7"/>
  <circle cx="-120" cy="210" r="7"/><circle cx="120" cy="210" r="7"/></g>
</g>
<g fill="#080610"><path d="M0 700V640h1200v60z"/></g>`),

// 붕괴한 관측대
obsdeck: SV(`<g fill="#0C0A14" opacity=".95"><path d="M0 700V420h1200v280z"/></g>
<!-- 부서진 망원경 -->
<g transform="translate(620 300) rotate(-16)">
  <rect x="-30" y="-160" width="60" height="250" rx="14" fill="#141020" stroke="#3E2E4A" stroke-width="3"/>
  <rect x="-40" y="-176" width="80" height="26" rx="8" fill="#1B1526" stroke="#523C60" stroke-width="2.5"/>
  <path d="M-30 -60h60M-30 0h60M-30 60h60" stroke="#33253E" stroke-width="3"/>
  <circle cx="0" cy="-160" r="16" fill="var(--tint)" opacity=".4" class="flick"/>
</g>
<g fill="#100C18" stroke="#2C2136" stroke-width="3">
<path d="M540 300 L470 480 L560 480z"/><path d="M700 300 L780 480 L690 480z"/></g>
<g fill="#0A0812"><path d="M300 700V470l90-30 60 40-20 60 40 30-30 130z"/>
<path d="M880 700V450l86 40-30 50 40 32-24 128z"/></g>
<g stroke="var(--tint)" stroke-width="1.4" opacity=".3" fill="none"><path d="M0 480h1200"/></g>
<g fill="#0A0812"><path d="M0 700V560l180 30 200-40 220 44 200-40 200 36 200-30V700z"/></g>`),

// 심연의 계단
abyss: SV(`<g fill="#080511" opacity=".96"><path d="M0 700V240h1200v460z"/></g>
<g fill="#0E0A1E" class="floaty" style="animation-duration:9s">
<path d="M420 470h150l24 26h-198z"/><path d="M660 380h130l20 24H642z"/>
<path d="M300 560h160l26 26H276z"/><path d="M760 540h150l24 26H738z"/></g>
<g fill="#120C26" class="floaty" style="animation-duration:12s;animation-delay:-3s">
<path d="M520 300h120l18 22H504z"/><path d="M860 460h120l18 22H844z"/></g>
<g stroke="#7B3BC4" stroke-width="1.2" opacity=".26" fill="none">
<path d="M495 496v70M725 404v66M380 586v60M835 566v58"/></g>
<g class="spin-slow" style="transform-origin:600px 300px" opacity=".3">
<circle cx="600" cy="300" r="180" fill="none" stroke="#7B3BC4" stroke-width="1.4" stroke-dasharray="6 18"/>
<circle cx="600" cy="300" r="120" fill="none" stroke="#4FC4E8" stroke-width="1" stroke-dasharray="3 14"/></g>
<circle cx="600" cy="300" r="52" fill="#05030C"/>
<circle cx="600" cy="300" r="52" fill="none" stroke="#9B5BE0" stroke-width="2" opacity=".7"/>`),

// 잿불 야영지
camp: SV(`<g fill="#0F0B0C" opacity=".95"><path d="M0 700V340h1200v360z"/></g>
<g fill="#141011"><path d="M0 340h1200v26H0z"/></g>
<!-- 천막 -->
<g transform="translate(300 430)">
  <path d="M0 -60 L110 130 H-110z" fill="#1A1416" stroke="#4A3830" stroke-width="3" stroke-linejoin="round"/>
  <path d="M0 -60 L0 130" stroke="#33262A" stroke-width="3"/>
  <path d="M-40 130 q40 -80 80 0z" fill="#0A0708"/>
</g>
<!-- 모닥불 -->
<g transform="translate(760 520)">
  <g stroke="#3E2C1E" stroke-width="9" stroke-linecap="round">
    <path d="M-52 60 L36 24M52 60 L-36 24M-30 66 L34 60"/></g>
  <path d="M0 -66c7 30-14 36-23 55-8 15-12 25-12 34 0 20 15 33 35 33s35-13 35-33c0-19-14-29-21-44-8-15-11-25-14-45z" fill="var(--tint)" opacity=".8" class="flick"/>
  <path d="M0 -14c3 14-7 17-11 26-4 7-6 12-6 17 0 9 7 15 17 15s17-6 17-15c0-8-6-13-9-21z" fill="#FFE0B0" opacity=".9" class="flick"/>
  <ellipse cx="0" cy="66" rx="80" ry="16" fill="var(--tint)" opacity=".14"/>
</g>
<g fill="#0C0809"><path d="M0 700V580l200 26 240-34 250 40 250-34 260 28V700z"/></g>`),

// 떠도는 세공사
stall: SV(`<g fill="#0A0E14" opacity=".95"><path d="M0 700V300h1200v400z"/></g>
<g transform="translate(600 400)">
  <path d="M-250 -60h500l-30 -50h-440z" fill="#16202C" stroke="#2E4A5E" stroke-width="3"/>
  <g fill="#1B2C3A"><path d="M-250 -60h100v34h-100zM-50 -60h100v34h-100zM150 -60h100v34h-100z"/></g>
  <g fill="#24414F"><path d="M-150 -60h100v34h-100zM50 -60h100v34h-100z"/></g>
  <path d="M-220 -26v170h440V-26z" fill="#0E1620" stroke="#2E4A5E" stroke-width="2.5"/>
  <g fill="#152230" stroke="#2E4A5E" stroke-width="1.6"><rect x="-190" y="10" width="80" height="60" rx="5"/>
  <rect x="-60" y="10" width="120" height="60" rx="5"/><rect x="110" y="10" width="80" height="60" rx="5"/></g>
  <g fill="var(--tint)" opacity=".55" class="flick"><circle cx="-150" cy="40" r="9"/><circle cx="0" cy="40" r="11"/><circle cx="150" cy="40" r="9"/></g>
  <!-- 등롱 -->
  <g stroke="#2E4A5E" stroke-width="2"><path d="M-300 -110v80M300 -110v80"/></g>
  <g><rect x="-322" y="-30" width="44" height="56" rx="8" fill="#1B2C3A" stroke="var(--tint2)" stroke-width="2"/>
  <circle cx="-300" cy="-2" r="13" fill="var(--tint2)" opacity=".55" class="flick"/></g>
  <g><rect x="278" y="-30" width="44" height="56" rx="8" fill="#1B2C3A" stroke="var(--tint2)" stroke-width="2"/>
  <circle cx="300" cy="-2" r="13" fill="var(--tint2)" opacity=".55" class="flick"/></g>
</g>
<g fill="#080C12"><path d="M0 700V600h1200v100z"/></g>`),

// 회랑의 끝 — 일식 제단
eclipse: SV(`<g fill="#080610" opacity=".96"><path d="M0 700V180h1200v520z"/></g>
<g class="spin-slow" style="transform-origin:600px 270px" opacity=".55">
<circle cx="600" cy="270" r="250" fill="none" stroke="#D9B463" stroke-width="1.4" stroke-dasharray="5 16"/></g>
<g class="spin-rev" style="transform-origin:600px 270px" opacity=".4">
<circle cx="600" cy="270" r="200" fill="none" stroke="#F0562D" stroke-width="1.2" stroke-dasharray="30 46"/></g>
<circle cx="600" cy="270" r="150" fill="#05040B"/>
<circle cx="600" cy="270" r="150" fill="none" stroke="#D9B463" stroke-width="3" opacity=".8"/>
<path d="M600 120a150 150 0 0 0 0 300 112 112 0 0 1 0-300z" fill="var(--tint)" opacity=".2"/>
<g fill="#0C0912" stroke="#4A3820" stroke-width="3">
<path d="M120 700V330l70-26v396zM1080 700V310l-70-26v416z"/>
<path d="M280 700V400l60-22v322zM920 700V380l-60-22v342z"/></g>
<g fill="var(--gold)" opacity=".5" class="flick">
<circle cx="155" cy="318" r="5"/><circle cx="1045" cy="298" r="5"/>
<circle cx="310" cy="390" r="4"/><circle cx="890" cy="370" r="4"/></g>
<g fill="#090710"><path d="M0 700V560h1200v140z"/></g>
<g stroke="var(--gold)" stroke-width="1.4" opacity=".3" fill="none"><path d="M0 560h1200"/></g>`),

// 회랑 전경 (지도)
hall: SV(`<g fill="#090C15" opacity=".95"><path d="M0 700V220h1200v480z"/></g>
<g fill="none" stroke="#141B2A" stroke-width="4" opacity=".9">
<path d="M300 700V300q0-100 300-100t300 100v400"/>
<path d="M420 700V340q0-180 180-180t180 180v360"/></g>
<g fill="#0C1120"><path d="M540 700V400q0-60 60-60t60 60v300z"/></g>
<g stroke="var(--tint)" stroke-width="1.2" opacity=".22" fill="none">
<path d="M600 160v540M300 300h600M420 340h360"/></g>
<g fill="var(--tint)" opacity=".4" class="flick">
<circle cx="600" cy="200" r="6"/><circle cx="360" cy="330" r="4"/><circle cx="840" cy="330" r="4"/></g>`),

// 관측소 입구 (타이틀)
gateway: SV(`<g fill="#090C15" opacity=".92"><path d="M0 700V260h1200v440z"/></g>
<g transform="translate(600 340)">
  <path d="M-290 360V-10q0-200 290-200T290 -10v370z" fill="#0B0F1A" stroke="#1A2334" stroke-width="5"/>
  <path d="M-210 360V-4q0-150 210-150T210 -4v364z" fill="#06080F" stroke="#141B2A" stroke-width="4"/>
  <g class="spin-slow" style="transform-origin:0px 30px" opacity=".5">
    <ellipse rx="150" ry="52" cy="30" fill="none" stroke="var(--tint)" stroke-width="1.6" stroke-dasharray="200 70"/>
    <ellipse rx="108" ry="108" cy="30" fill="none" stroke="var(--tint2)" stroke-width="1.2" stroke-dasharray="220 90" transform="rotate(22)"/></g>
  <circle cx="0" cy="30" r="20" fill="#05070C" stroke="var(--tint)" stroke-width="2"/>
  <circle cx="0" cy="30" r="6" fill="var(--tint)" opacity=".8" class="flick"/>
</g>
<g fill="#070A11"><path d="M0 700V620l200 20 220-26 180 30 200-24 200 26 200-20V700z"/></g>`)
};

/* ── 근경 프레임 ── */
const NEAR = {
pillars: SV(`<defs><linearGradient id="np" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#04060B"/><stop offset="48%" stop-color="#121724"/><stop offset="100%" stop-color="#04060B"/></linearGradient></defs>
<g fill="url(#np)"><path d="M6 700V140h88v560zM-8 122h116l-14-32H6z"/>
<path d="M1106 700V140h88v560zM1092 122h116l-14-32h-88z"/>
<path d="M144 700V262h54v438zM136 248h70l-10-24h-50z"/>
<path d="M1002 700V262h54v438zM994 248h70l-10-24h-50z"/></g>
<path d="M94 140q116-108 222-58M1106 140q-116-108-222-58" fill="none" stroke="#0D1420" stroke-width="30" stroke-linecap="round"/>
<g stroke="var(--tint)" stroke-width="1.2" opacity=".26" fill="none"><path d="M50 200v420M1150 200v420"/></g>
<g fill="var(--tint)" opacity=".5"><circle cx="50" cy="186" r="5"/><circle cx="1150" cy="186" r="5"/>
<circle cx="171" cy="280" r="3.4"/><circle cx="1029" cy="280" r="3.4"/></g>`),

icicles: SV(`<g fill="#0A1723"><path d="M0 0h1200v70H0z"/></g>
<g fill="#0D2231" opacity=".95">
<path d="M40 60l14 130-14 34-14-34zM130 60l11 96-11 26-11-26zM220 60l16 150-16 36-16-36z
M330 60l10 80-10 22-10-22zM980 60l13 118-13 30-13-30zM1080 60l17 156-17 36-17-36zM1160 60l11 92-11 24-11-24z"/></g>
<g fill="#7FD8F2" opacity=".22">
<path d="M40 60l5 130-5 34-5-34zM220 60l6 150-6 36-6-36zM1080 60l6 156-6 36-6-36z"/></g>
<g fill="#08131D"><path d="M0 700V656l120 16 160-22 200 26 220-24 200 22 180-18 120 14V700z"/></g>
<g fill="#0D2231"><path d="M60 700l-26-70 60 12 20-40 30 62 40-30 18 66z" opacity=".8"/>
<path d="M1140 700l26-64-58 10-22-38-28 58-40-28-16 62z" opacity=".8"/></g>`),

drape: SV(`<g fill="#0A0710"><path d="M0 0h1200v46H0z"/></g>
<g fill="#100A14" opacity=".95">
<path d="M0 40h300v90q-75 40-150 0T0 130z"/><path d="M900 40h300v92q-75 40-150 0t-150 0z"/></g>
<g fill="#160E1C" opacity=".8"><path d="M0 40h150v70q-40 26-75 0T0 108z"/><path d="M1050 40h150v70q-40 26-75 0t-75-2z"/></g>
<g fill="#0A0710"><path d="M0 700V640l180 22 220-26 200 30 200-26 200 22 200-20V700z"/></g>
<g stroke="var(--tint)" stroke-width="1.2" opacity=".22" fill="none"><path d="M0 46h1200"/></g>`),

rubble: SV(`<g fill="#080B12"><path d="M0 700V620l90 16 70-32 90 40 80-24 70 34 100-40 90 44 80-30 90 36 80-26 90 30 90-24 80 30V700z"/></g>
<g fill="#0B0F18" opacity=".9">
<path d="M60 660l50-16 30 24-40 22zM380 674l60-20 34 28-46 24zM760 664l54-18 30 26-42 22zM1050 672l58-20 32 28-44 24z"/></g>
<g stroke="var(--tint)" stroke-width="1" opacity=".18" fill="none"><path d="M0 624h1200"/></g>`),

none: SV(`<g></g>`)
};

/* ── 씬 정의 ── */
const SCENES = {
  title:   { far:'towers', mid:'gateway', near:'pillars',  floor:0, tint:['#F0562D','#4FC4E8'], mote:'warm', vault:'open', frame:'stone' },
  deck:    { far:'vault',  mid:'gateway', near:'drape',    floor:0, tint:['#D9B463','#F0562D'], mote:'gold', vault:'arch', frame:'stone' },
  map:     { far:'towers', mid:'hall',    near:'pillars',  floor:0, tint:['#5C6BA8','#4FC4E8'], mote:'cool', vault:'arch', frame:'stone' },
  rest:    { far:'towers', mid:'camp',    near:'rubble',   floor:1, tint:['#E8973C','#6FA678'], mote:'warm', vault:'cave', frame:'cave' },
  shop:    { far:'vault',  mid:'stall',   near:'drape',    floor:1, tint:['#4FC4E8','#D9B463'], mote:'cool', vault:'arch', frame:'stone' },
  win:     { far:'peaks',  mid:'eclipse', near:'pillars',  floor:0, tint:['#D9B463','#F0562D'], mote:'gold', vault:'open', frame:'stone' },
  lose:    { far:'chasm',  mid:'abyss',   near:'rubble',   floor:0, tint:['#6B5F74','#3A4460'], mote:'cool', vault:'none', frame:'cave' },
  // 전투 구간
  guardian:  { far:'towers', mid:'stairs',  near:'pillars', floor:1, tint:['#F0562D','#6B7BAE'], mote:'warm', vault:'arch', frame:'stone' },
  wolf:      { far:'peaks',  mid:'icefall', near:'icicles', floor:1, tint:['#4FC4E8','#7FA8D8'], mote:'snow', vault:'none', frame:'ice' },
  wisp:      { far:'towers', mid:'brazier', near:'rubble',  floor:1, tint:['#FF8B3D','#E8A33C'], mote:'ember', vault:'arch', frame:'cave' },
  warden:    { far:'vault',  mid:'gate',    near:'drape',   floor:1, tint:['#C4384B','#9B5BE0'], mote:'blood', vault:'arch', frame:'stone' },
  guardian2: { far:'towers', mid:'obsdeck', near:'rubble',  floor:1, tint:['#B03A6E','#F0562D'], mote:'warm', vault:'open', frame:'stone' },
  warden2:   { far:'chasm',  mid:'abyss',   near:'drape',   floor:1, tint:['#7B3BC4','#4FC4E8'], mote:'violet', vault:'none', frame:'cave' },
  boss:      { far:'peaks',  mid:'eclipse', near:'pillars', floor:1, tint:['#D9B463','#F0562D'], mote:'gold', vault:'open', frame:'stone' },
};

// 씬 키 → 실제 소품 그림 매핑 (없는 장소는 벡터 배경만 유지)
const PROP_SCENE_MAP = {
  guardian:'stair', wolf:'frostpass', warden:'gate', rest:'camp',
  wisp:'court', guardian2:'observ', warden2:'abyss', shop:'shop', boss:'end',
};

const MOTE = {
  warm:  { a:'rgba(240,140,80,.55)',  b:'rgba(120,190,230,.35)', n:26, up:1 },
  ember: { a:'rgba(255,150,60,.7)',   b:'rgba(255,200,120,.5)',  n:34, up:1 },
  snow:  { a:'rgba(190,238,255,.75)', b:'rgba(140,200,235,.5)',  n:40, up:0 },
  cool:  { a:'rgba(120,190,230,.5)',  b:'rgba(160,180,220,.35)', n:22, up:1 },
  gold:  { a:'rgba(217,180,99,.6)',   b:'rgba(240,140,80,.45)',  n:26, up:1 },
  blood: { a:'rgba(228,90,110,.55)',  b:'rgba(155,91,224,.4)',   n:24, up:1 },
  violet:{ a:'rgba(155,91,224,.6)',   b:'rgba(79,196,232,.4)',   n:28, up:1 },
};

const VAULTS = {};
VAULTS.arch = `<svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMin slice">
<defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#0A0D16"/><stop offset="70%" stop-color="#0C1019"/><stop offset="100%" stop-color="#0C1019" stop-opacity="0"/></linearGradient>
<linearGradient id="vg2" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#05070C"/><stop offset="50%" stop-color="#151B29"/><stop offset="100%" stop-color="#05070C"/></linearGradient></defs>
<!-- 천장 궁륭 -->
<path d="M0 0h1200v112q-300 -84 -600 -84T0 112z" fill="url(#vg)"/>
<path d="M0 112q300 -84 600 -84t600 84" fill="none" stroke="#1C2438" stroke-width="4"/>
<path d="M0 150q300 -84 600 -84t600 84" fill="none" stroke="#141B2B" stroke-width="2" opacity=".8"/>
<!-- 늑재 -->
<g stroke="#1A2234" stroke-width="3" fill="none" opacity=".9">
<path d="M180 0v78M420 0v46M600 0v34M780 0v46M1020 0v78"/></g>
<!-- 측면 부벽 -->
<g fill="url(#vg2)">
<path d="M0 0h120v300l-40 34-40-16-40 22z"/><path d="M1200 0h-120v300l40 34 40-16 40 22z"/></g>
<g stroke="#1E2740" stroke-width="2" fill="none" opacity=".85">
<path d="M0 96h120M0 178h120M0 258h120M1080 96h120M1080 178h120M1080 258h120"/></g>
<!-- 매달린 사슬과 등 -->
<g stroke="#20293E" stroke-width="2.4" fill="none">
<path d="M170 24v46M410 8v40M790 8v40M1030 24v46"/></g>
<g fill="#0D131F" stroke="#33405E" stroke-width="2">
<path d="M154 70h32l9 28h-50zM394 48h32l9 28h-50zM774 48h32l9 28h-50zM1014 70h32l9 28h-50z"/></g>
<g fill="var(--tint)" opacity=".5" class="flick">
<ellipse cx="170" cy="86" rx="13" ry="9"/><ellipse cx="410" cy="64" rx="13" ry="9"/>
<ellipse cx="790" cy="64" rx="13" ry="9"/><ellipse cx="1030" cy="86" rx="13" ry="9"/></g>
<g fill="#FFE0B8" opacity=".65" class="flick">
<ellipse cx="170" cy="83" rx="6" ry="4"/><ellipse cx="410" cy="61" rx="6" ry="4"/>
<ellipse cx="790" cy="61" rx="6" ry="4"/><ellipse cx="1030" cy="83" rx="6" ry="4"/></g>
<path d="M0 0h1200v40H0z" fill="#05070C" opacity=".7"/>
</svg>`;

// 동굴 천장 — 야영지처럼 자연 지형인 곳
VAULTS.cave = `<svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMin slice">
<defs><linearGradient id="cvg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#0B0906"/><stop offset="72%" stop-color="#100C08"/><stop offset="100%" stop-color="#100C08" stop-opacity="0"/></linearGradient></defs>
<path d="M0 0h1200v92q-70 46 -140 18t-130 34 -120 -30 -140 26 -130 -34 -120 30 -140 -22 -80 26z" fill="url(#cvg)"/>
<path d="M0 92q70 46 140 18t130 34 120 -30 140 26 130 -34 120 30 140 -22 80 26" fill="none" stroke="#241A0F" stroke-width="3"/>
<g fill="#0C0906">
<path d="M120 96l14 56 -14 18 -12 -18z"/><path d="M310 110l10 42 -10 14 -9 -14z"/>
<path d="M540 86l15 64 -15 20 -13 -20z"/><path d="M760 116l12 44 -12 16 -10 -16z"/>
<path d="M990 94l14 58 -14 18 -12 -18z"/></g>
<g fill="url(#cvg)"><path d="M0 0h150v250l-50 30-50-18-50 24z"/><path d="M1200 0h-150v250l50 30 50-18 50 24z"/></g>
<g fill="var(--tint)" opacity=".07"><ellipse cx="600" cy="150" rx="420" ry="120"/></g>
<path d="M0 0h1200v46H0z" fill="#05040A" opacity=".65"/></svg>`;

// 열린 천장 — 관측대·보스처럼 하늘이 보이는 곳
VAULTS.open = `<svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMin slice">
<defs><linearGradient id="ovg" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#05070C"/><stop offset="50%" stop-color="#141A28"/><stop offset="100%" stop-color="#05070C"/></linearGradient></defs>
<g fill="none" stroke="#1A2234" stroke-width="7" opacity=".9">
<path d="M-40 210 Q300 -30 600 -20 Q900 -30 1240 210"/>
<path d="M-40 300 Q300 60 600 70 Q900 60 1240 300"/></g>
<g fill="none" stroke="#131A29" stroke-width="4" opacity=".85">
<path d="M120 0 Q180 120 250 236M1080 0 Q1020 120 950 236M380 0 Q400 90 430 170M820 0 Q800 90 770 170"/></g>
<g fill="url(#ovg)"><path d="M0 0h108v268l-36 26-36-14-36 20z"/><path d="M1200 0h-108v268l36 26 36-14 36 20z"/></g>
<g fill="#0A0E18"><path d="M0 0h1200v34H0z" opacity=".8"/></g>
<g fill="var(--tint)" opacity=".45" class="flick"><circle cx="252" cy="240" r="6"/><circle cx="948" cy="240" r="6"/></g></svg>`;

VAULTS.none = '';

/* ═══ 최전경 프레임 — 무대를 감싸는 검은 실루엣 ═══ */
const FRAMES = {};
// 석조 회랑: 좌우 거대 기둥 + 상단 아치 + 하단 단
FRAMES.stone = `<svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="fr1" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#010203"/><stop offset="72%" stop-color="#04060B"/><stop offset="100%" stop-color="#080C14"/></linearGradient>
<linearGradient id="fr2" x1="1" y1="0" x2="0" y2="0">
<stop offset="0%" stop-color="#010203"/><stop offset="72%" stop-color="#04060B"/><stop offset="100%" stop-color="#080C14"/></linearGradient></defs>
<path d="M0 0h214l-16 62 24 54-18 68 20 96-14 110 16 128-22 96 18 86H0z" fill="url(#fr1)"/>
<path d="M1200 0h-214l16 62-24 54 18 68-20 96 14 110-16 128 22 96-18 86h222z" fill="url(#fr2)"/>
<path d="M182 0q120 34 178 132 46 78 44 168l-26 4q6-96-44-168Q290 62 172 34z" fill="#02040A" opacity=".95"/>
<path d="M1018 0q-120 34-178 132-46 78-44 168l26 4q-6-96 44-168Q910 62 1028 34z" fill="#02040A" opacity=".95"/>
<path d="M0 700v-96l96 22 74-30 96 34 82-22 104 30 96-24 108 28 92-26 100 24 84-30 90 24 78-26v92z" fill="#010204"/>
<path d="M0 620l96 22 74-30 96 34 82-22 104 30 96-24 108 28 92-26 100 24 84-30 90 24 78-26"
  fill="none" stroke="var(--tint)" stroke-width="1.4" opacity=".16"/>
<g fill="#02040A"><path d="M172 700v-72l52-14 30 26-14 60zM1028 700v-78l-56-12-28 28 16 62z"/></g></svg>`;

// 얼음 동굴: 좌우 빙벽 + 상단 고드름
FRAMES.ice = `<svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="fi1" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#01060A"/><stop offset="100%" stop-color="#05131C"/></linearGradient>
<linearGradient id="fi2" x1="1" y1="0" x2="0" y2="0">
<stop offset="0%" stop-color="#01060A"/><stop offset="100%" stop-color="#05131C"/></linearGradient></defs>
<path d="M0 0h196l-30 74 44 62-36 84 30 104-24 118 34 116-30 90 24 52H0z" fill="url(#fi1)"/>
<path d="M1200 0h-196l30 74-44 62 36 84-30 104 24 118-34 116 30 90-24 52h208z" fill="url(#fi2)"/>
<g fill="#04121B"><path d="M240 0l22 112-22 34-20-34zM330 0l16 78-16 24-15-24zM420 0l24 132-24 38-22-38z
M780 0l22 132-22 38-21-38zM880 0l16 86-16 26-15-26zM960 0l24 118-24 36-22-36z"/></g>
<g fill="#7FD8F2" opacity=".1"><path d="M240 0l8 112-8 34-6-34zM420 0l9 132-9 38-8-38zM780 0l8 132-8 38-8-38z"/></g>
<path d="M0 700v-84l110 18 84-26 104 30 92-20 110 26 96-22 106 24 96-24 104 22 88-28 100 22 110-20v82z" fill="#010507"/>
<path d="M0 616l110 18 84-26 104 30 92-20 110 26 96-22 106 24 96-24 104 22 88-28 100 22 110-20"
  fill="none" stroke="#7FD8F2" stroke-width="1.4" opacity=".2"/></svg>`;

// 자연 동굴 / 공허: 불규칙한 암반
FRAMES.cave = `<svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="fc1" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#010203"/><stop offset="100%" stop-color="#0A0806"/></linearGradient>
<linearGradient id="fc2" x1="1" y1="0" x2="0" y2="0">
<stop offset="0%" stop-color="#010203"/><stop offset="100%" stop-color="#0A0806"/></linearGradient></defs>
<path d="M0 0h230q-40 60-14 110 30 58-6 106 34 70-4 128 30 76-10 140 26 82-14 122 22 50 10 94H0z" fill="url(#fc1)"/>
<path d="M1200 0h-230q40 60 14 110-30 58 6 106-34 70 4 128-30 76 10 140-26 82 14 122-22 50-10 94h202z" fill="url(#fc2)"/>
<path d="M0 0h1200v70q-90 52-190 20t-180 30-170-34-180 26-166-30-160 34-154-20z" fill="#040503"/>
<path d="M0 700v-102l120 26 90-32 112 36 100-24 118 30 104-26 114 28 102-28 112 26 96-34 132 24v76z" fill="#010202"/>
<path d="M0 598l120 26 90-32 112 36 100-24 118 30 104-26 114 28 102-28 112 26 96-34 132 24"
  fill="none" stroke="var(--tint)" stroke-width="1.4" opacity=".18"/></svg>`;

const RAYS = `<svg viewBox="0 0 1200 700" preserveAspectRatio="none">
<defs><linearGradient id="ryg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="var(--tint)" stop-opacity=".34"/>
<stop offset="55%" stop-color="var(--tint)" stop-opacity=".12"/>
<stop offset="100%" stop-color="var(--tint)" stop-opacity="0"/></linearGradient>
<linearGradient id="ryg2" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="var(--tint2)" stop-opacity=".26"/>
<stop offset="100%" stop-color="var(--tint2)" stop-opacity="0"/></linearGradient></defs>
<g fill="url(#ryg)"><path d="M300 -30 L372 -30 L470 700 L180 700z"/>
<path d="M640 -30 L690 -30 L742 700 L566 700z"/>
<path d="M900 -30 L982 -30 L1090 700 L800 700z"/></g>
<g fill="url(#ryg2)"><path d="M470 -30 L510 -30 L556 700 L410 700z"/>
<path d="M1050 -30 L1110 -30 L1190 700 L980 700z"/></g></svg>`;

let curScene = null;
function applyScene(key){
  if(!SCENES[key] || curScene === key) return;
  curScene = key;
  const s = SCENES[key];
  const r = document.documentElement;
  r.style.setProperty('--tint', s.tint[0]);
  r.style.setProperty('--tint2', s.tint[1]);
  const layers = $('#scene');
  layers.classList.add('swap');
  setTimeout(() => {
    $('#stars').innerHTML = SV(`<g fill="#fff">${STARFIELD}</g>`, 'xMidYMid slice');
    $('#far').innerHTML   = FAR[s.far]   || '';
    $('#mid').innerHTML   = MID[s.mid]   || '';
    $('#near').innerHTML  = NEAR[s.near] || '';
    const rayEl = $('#rays'); if(rayEl && !rayEl.innerHTML) rayEl.innerHTML = RAYS;
    const vEl = $('#vault'); if(vEl) vEl.innerHTML = VAULTS[s.vault || 'arch'] || '';
    const frEl = $('#frame'); if(frEl) frEl.innerHTML = FRAMES[s.frame || 'stone'] || '';
    document.body.classList.toggle('has-floor', !!s.floor);
    const propKey = PROP_SCENE_MAP[key];
    const propEl = $('#propimg');
    if(propEl){
      const img = propKey && PROP_ART[propKey];
      propEl.classList.toggle('on', !!img);
      propEl.innerHTML = img ? `<div class="photo-wrap"><img class="prop-photo" src="${img}" alt=""></div>` : '';
    }
    spawnMotes(s.mote);
    layers.classList.remove('swap');
    refreshParallaxLayers();
  }, 260);
}
// 씬 이름을 구간에서 얻기
function sceneForNode(node){
  if(!node) return 'map';
  if(node.t === 'rest') return 'rest';
  if(node.t === 'shop') return 'shop';
  return node.e || 'guardian';
}

/* 잿가루 / 눈 / 불티 */
let moteEls = [];
function spawnMotes(kind){
  moteEls.forEach(e => e.remove());
  moteEls = [];
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cfg = MOTE[kind] || MOTE.warm;
  const N = Math.round(cfg.n * (window.innerWidth < 700 ? 0.5 : 1));
  for(let i = 0; i < N; i++){
    const d = document.createElement('div');
    d.className = 'mote';
    const sz = 1 + Math.random() * (cfg.up ? 2.6 : 3.2);
    const warm = Math.random() > .45;
    const col = warm ? cfg.a : cfg.b;
    d.style.width = d.style.height = sz + 'px';
    d.style.background = col;
    d.style.boxShadow = `0 0 ${sz * 3}px ${col}`;
    d.style.left = Math.random() * 100 + 'vw';
    d.style.top  = Math.random() * 100 + 'vh';
    const dur = cfg.up ? (15 + Math.random() * 20) : (9 + Math.random() * 12);
    const dy = cfg.up ? -(110 + Math.random() * 150) : (120 + Math.random() * 160);
    d.animate([
      { transform:'translate(0,0)', opacity:0 },
      { opacity:.85, offset:.16 },
      { opacity:.7, offset:.8 },
      { transform:`translate(${Math.random() * 90 - 45}px, ${dy}px)`, opacity:0 }
    ], { duration:dur * 1000, delay:-Math.random() * dur * 1000, iterations:Infinity, easing:'linear' });
    document.body.appendChild(d);
    moteEls.push(d);
  }
}

// 마우스 패럴랙스 + 은은한 표류
// 성능 노트: 예전엔 매 프레임 querySelectorAll + 9개 레이어(사진 포함) 전부 갱신 → 극심한 렉.
// 1) 레이어 목록은 씬이 바뀔 때만 다시 캐시한다.
// 2) 사진이 들어가는 무거운 레이어(propimg/vault/frame)는 패럴랙스 대상에서 뺀다 — 시각적 손실은 미미하고 비용은 크다.
// 3) 마우스가 거의 안 움직이면 쓰기 자체를 건너뛴다.
// 실행 중 실제 프레임 속도를 재서 느리면 장식 레이어를 자동으로 줄인다
let perfLite = false;
(function perfWatch(){
  let last = performance.now(), slow = 0, n = 0;
  function tick(){
    const now = performance.now(), dt = now - last; last = now;
    if(++n > 6){
      if(dt > 40) slow++; else slow = Math.max(0, slow - 1);
      if(slow > 20 && !perfLite){
        perfLite = true;
        document.body.classList.add('perf-lite');
      }
    }
    if(n < 400) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

let px = 0, py = 0, tx = 0, ty = 0;
let parallaxLayers = null;
// far/mid는 filter(blur·brightness·saturate)가 걸려 있다 — 필터 걸린 레이어를
// 매 프레임 움직이면 브라우저가 필터를 계속 다시 계산해야 해서 매우 비싸다.
// 움직이지 않는 배경 깊이감은 stars/near/floor만으로 충분히 난다.
const PARALLAX_SKIP = new Set(['propimg', 'vault', 'frame', 'far', 'mid']);
function refreshParallaxLayers(){
  parallaxLayers = $$('#scene .lyr[data-depth]').filter(l => !PARALLAX_SKIP.has(l.id));
}
function parallaxTick(){
  if(!parallaxLayers) refreshParallaxLayers();
  px += (tx - px) * 0.055; py += (ty - py) * 0.055;
  if(Math.abs(tx - px) > 0.02 || Math.abs(ty - py) > 0.02 || parallaxDirty){
    const t = Date.now() / 1000;
    for(const l of parallaxLayers){
      const d = parseFloat(l.dataset.depth);
      const drift = Math.sin(t / (6 + d * 0.4)) * (d * 0.18);
      l.style.transform = `translate3d(${(px * d).toFixed(2)}px, ${(py * d * .5 + drift).toFixed(2)}px, 0)`;
    }
  }
  requestAnimationFrame(parallaxTick);
}
let parallaxDirty = true;
setInterval(() => { parallaxDirty = true; }, 700); // 표류감 유지를 위해 이따금 강제 갱신
window.addEventListener('pointermove', e => {
  tx = (e.clientX / window.innerWidth - .5) * -1.7;
  ty = (e.clientY / window.innerHeight - .5) * -1.2;
}, { passive:true });

/* ═══════════════════════════════════════════════════════════
   B. 각인사 (플레이어) — 후드 망토 + 낙인 지팡이
   ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   플레이어 캐릭터 3종
   ═══════════════════════════════════════════════════════════ */
// 캐릭터 선택 화면 전용 고해상도 초상화.
// 값이 있으면 선택 화면 대형 아트에 쓰이고, 없으면 HEROES의 SVG 실루엣으로 대체된다.
// 인게임 전투 중에는 항상 SVG 실루엣을 쓴다 (연출·색조 시스템과 맞춰야 하므로).
const PORTRAITS = {
  ember: 'assets/heroes/ember.webp',
  frost: null,
  ash: null,
};

const HEROES = {

/* ────── 잿불 기사 : 중갑 전사 ────── */
ember:`<svg viewBox="0 0 200 280" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
<defs>
<linearGradient id="k_pl" x1=".18" y1="0" x2=".82" y2="1">
<stop offset="0%" stop-color="#F5D79E"/><stop offset="30%" stop-color="#D0A458"/>
<stop offset="66%" stop-color="#96702F"/><stop offset="100%" stop-color="#59401A"/></linearGradient>
<linearGradient id="k_pl2" x1=".2" y1="0" x2=".8" y2="1">
<stop offset="0%" stop-color="#E0B96F"/><stop offset="55%" stop-color="#A87C34"/><stop offset="100%" stop-color="#5C4319"/></linearGradient>
<linearGradient id="k_cape" x1=".25" y1="0" x2=".8" y2="1">
<stop offset="0%" stop-color="#A03328"/><stop offset="52%" stop-color="#6B1B14"/><stop offset="100%" stop-color="#2C0907"/></linearGradient>
<linearGradient id="k_steel" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#5E6674"/><stop offset="34%" stop-color="#EAF0FA"/>
<stop offset="58%" stop-color="#A9B3C3"/><stop offset="100%" stop-color="#4E5664"/></linearGradient>
</defs>
<ellipse cx="100" cy="270" rx="54" ry="8" fill="rgba(0,0,0,.5)"/>
<g class="idle" stroke="#241708" stroke-width="2.4" stroke-linejoin="round">
  <!-- 망토 -->
  <path d="M76 84 C44 100 32 142 38 186 C41 214 33 240 25 260 L60 252 L72 186 L80 112z" fill="url(#k_cape)"/>
  <path d="M132 86 C158 102 166 138 160 178 L152 236 L130 230 L126 152z" fill="url(#k_cape)" opacity=".8"/>
  <!-- 다리 -->
  <path d="M80 176 L104 178 L101 216 L96 250 L76 248 L81 214z" fill="#2A1D12"/>
  <path d="M112 178 L136 182 L135 216 L142 250 L122 254 L114 216z" fill="#221709"/>
  <path d="M79 190 h26 l2 30 H77z" fill="url(#k_pl2)"/>
  <path d="M114 194 h26 l3 30 h-28z" fill="url(#k_pl2)"/>
  <path d="M71 244 h32 l5 18 H67z" fill="url(#k_pl)"/>
  <path d="M117 248 h32 l5 18 h-40z" fill="url(#k_pl)"/>
  <!-- 갑옷 치마 -->
  <path d="M72 152 h56 l6 26 H66z" fill="url(#k_pl2)"/>
  <path d="M86 154 v24M100 154 v24M114 154 v24" stroke="#59401A" stroke-width="1.6"/>
  <!-- 몸통 -->
  <path d="M76 86 C76 74 86 66 100 66 C114 66 124 74 124 86 L129 124 C129 144 116 154 100 154 C84 154 71 144 71 124z" fill="url(#k_pl)"/>
  <path d="M100 68 V152" stroke="#59401A" stroke-width="1.8"/>
  <path d="M78 100 q22 8 44 0M75 120 q25 10 50 0" fill="none" stroke="#F5D79E" stroke-width="1.6" opacity=".45"/>
  <path d="M100 96 l12 14 -12 14 -12-14z" fill="#2A1D12" stroke="#F0562D" stroke-width="2.2"/>
  <circle cx="100" cy="110" r="4" fill="#FF8B3D" stroke="none" class="flick"/>
  <!-- 왼팔 (몸통과 분리) -->
  <path d="M78 96 L64 118 L67 146 L83 141 L84 104z" fill="url(#k_pl2)"/>
  <path d="M63 140 l22 5 -4 18 -22-5z" fill="#2A1D12"/>
  <!-- 견갑 -->
  <path d="M63 84 C56 66 68 54 84 52 L90 84 L82 106 C67 106 60 98 63 84z" fill="url(#k_pl)"/>
  <path d="M137 84 C144 66 132 54 116 52 L110 84 L118 106 C133 106 140 98 137 84z" fill="url(#k_pl)"/>
  <path d="M68 76 q11 -11 20 -13M132 76 q-11 -11 -20 -13" fill="none" stroke="#F5D79E" stroke-width="1.8" opacity=".6"/>
  <!-- 대검 -->
  <path d="M170 24 L184 30 L154 130 L140 124z" fill="url(#k_steel)" stroke-width="2"/>
  <path d="M172 30 L156 112" stroke="#fff" stroke-width="2.6" opacity=".55" stroke-linecap="round"/>
  <path d="M134 120 l26 11 -8 18 -26-11z" fill="#3C2A14"/>
  <circle cx="146" cy="134" r="5" fill="#F0562D" stroke-width="1.8"/>
  <path d="M130 140 l17 7 -11 25 -17-7z" fill="#6B5024"/>
  <!-- 오른팔 + 검 쥔 손 -->
  <path d="M120 96 L136 116 L133 144 L117 139 L116 104z" fill="url(#k_pl2)"/>
  <path d="M124 136 q14 -6 21 4 q6 10 -5 16 q-14 6 -21 -5z" fill="url(#k_pl)"/>
  <path d="M128 141 l14 6M126 148 l13 6" stroke="#59401A" stroke-width="1.6" stroke-linecap="round"/>
  <!-- 투구 -->
  <path d="M82 36 C82 22 89 12 100 12 C111 12 118 22 118 36 L120 56 C120 66 111 70 100 70 C89 70 80 66 80 56z" fill="url(#k_pl)"/>
  <path d="M100 12 C94 12 90 20 90 30 L92 66 L100 70z" fill="#F5D79E" opacity=".2" stroke="none"/>
  <!-- 뒤로 젖힌 볏 -->
  <path d="M100 12 C104 4 112 0 122 -2 C116 8 110 14 104 18z" fill="url(#k_pl2)"/>
  <!-- T자 면갑 -->
  <path d="M96 30 h8 v34 h-8z" fill="#0C0805" stroke-width="1.8"/>
  <path d="M82 42 h36 v11 H82z" fill="#0C0805" stroke-width="1.8"/>
  <path d="M85 47 h10 M105 47 h10" stroke="#FF7A45" stroke-width="4.6" stroke-linecap="round" class="flick"/>
  <path d="M84 60 h32" stroke="#59401A" stroke-width="1.8"/>
</g></svg>`,

/* ────── 서리 방랑자 : 뼈 가면의 사냥꾼 ────── */
frost:`<svg viewBox="0 0 200 280" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
<defs>
<linearGradient id="s_coat" x1=".2" y1="0" x2=".8" y2="1">
<stop offset="0%" stop-color="#5FA795"/><stop offset="42%" stop-color="#357068"/>
<stop offset="78%" stop-color="#1C4248"/><stop offset="100%" stop-color="#0E262C"/></linearGradient>
<linearGradient id="s_coat2" x1="0" y1="0" x2="1" y2="0">
<stop offset="0%" stop-color="#6FBBA6"/><stop offset="100%" stop-color="#1E4248"/></linearGradient>
<linearGradient id="s_bone" x1="0" y1="0" x2=".3" y2="1">
<stop offset="0%" stop-color="#FBF6E6"/><stop offset="58%" stop-color="#D8CDAE"/>
<stop offset="100%" stop-color="#8C8168"/></linearGradient>
<linearGradient id="s_blade" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#EDFBFF"/><stop offset="55%" stop-color="#8FDCF2"/><stop offset="100%" stop-color="#2E7E9C"/></linearGradient>
</defs>
<ellipse cx="100" cy="270" rx="46" ry="7" fill="rgba(0,0,0,.5)"/>
<g class="idle">
  <!-- 뒤로 흐르는 자락 -->
  <path d="M76 90 C46 108 34 152 40 196 C42 224 34 248 26 264 L56 256 L68 200 L78 122z" fill="url(#s_coat)" opacity=".9"/>
  <path d="M26 264 l9 12 6-13 8 12 7-12" fill="#0E262C"/>
  <path d="M126 92 C150 110 160 148 154 190 L146 246 L126 240 L122 160z" fill="url(#s_coat)" opacity=".62"/>
  <!-- 다리 -->
  <path d="M82 182 L106 184 L102 226 L96 258 L78 256 L84 224z" fill="#173338"/>
  <path d="M110 184 L132 188 L132 226 L138 258 L120 262 L112 224z" fill="#12292E"/>
  <g stroke="#D8CDAE" stroke-width="3.4" opacity=".85" stroke-linecap="round">
    <path d="M80 228 h22M82 240 h22M114 232 h22M116 244 h22"/></g>
  <path d="M74 256 h28 l3 12 H70z" fill="#2C4A44"/>
  <path d="M116 260 h28 l3 12 h-34z" fill="#2C4A44"/>
  <!-- 외투 -->
  <path d="M76 92 C74 78 84 68 100 68 C116 68 126 78 124 92 L136 152 C136 178 120 192 100 192 C80 192 64 178 64 152z" fill="url(#s_coat)"/>
  <path d="M76 92 C74 78 84 68 100 68 L102 192 C82 192 64 178 64 152z" fill="url(#s_coat2)" opacity=".38"/>
  <path d="M64 152 q36 18 72 0 l-3 22 q-33 16 -66 0z" fill="#0B1E24" opacity=".5"/>
  <path d="M100 96 v92" stroke="#0E262C" stroke-width="1.6" opacity=".55"/>
  <!-- 목도리 -->
  <path d="M78 84 q22 16 44 0 l5 16 q-27 18 -54 0z" fill="#6FBBA6"/>
  <path d="M122 100 q20 12 15 42 l-14-5 q5 -20 -7 -30z" fill="#4E8C7E"/>
  <!-- 단검 -->
  <path d="M52 154 C38 166 31 184 34 202 L46 197 C45 182 50 170 60 162z" fill="url(#s_blade)" stroke="#EDFBFF" stroke-width="1.8"/>
  <path d="M54 146 l15 10 -8 13 -15-10z" fill="#26383E" stroke="#8FDCF2" stroke-width="1.5"/>
  <path d="M148 154 C162 166 169 184 166 202 L154 197 C155 182 150 170 140 162z" fill="url(#s_blade)" stroke="#EDFBFF" stroke-width="1.8"/>
  <path d="M146 146 l-15 10 8 13 15-10z" fill="#26383E" stroke="#8FDCF2" stroke-width="1.5"/>
  <!-- 팔 -->
  <path d="M76 100 L58 126 L60 156 L78 150 L82 114z" fill="url(#s_coat2)"/>
  <path d="M124 100 L142 126 L140 156 L122 150 L118 114z" fill="url(#s_coat2)"/>
  <!-- 두건 -->
  <path d="M78 40 C78 26 87 16 100 16 C113 16 122 26 122 40 L124 62 C124 72 113 78 100 78 C87 78 76 72 76 62z" fill="url(#s_coat)"/>
  <path d="M78 40 C78 26 87 16 100 16 L100 78 C87 78 76 72 76 62z" fill="url(#s_coat2)" opacity=".42"/>
  <!-- 뿔 -->
  <path d="M83 28 C72 14 64 8 58 4 C70 4 82 12 88 24z" fill="url(#s_bone)" stroke="#8C8168" stroke-width="1.3"/>
  <path d="M117 28 C128 14 136 8 142 4 C130 4 118 12 112 24z" fill="url(#s_bone)" stroke="#8C8168" stroke-width="1.3"/>
  <!-- 뼈 가면 -->
  <path d="M86 38 C86 30 92 25 100 25 C108 25 114 30 114 38 L116 58 C116 68 109 74 100 74 C91 74 84 68 84 58z" fill="url(#s_bone)" stroke="#8C8168" stroke-width="1.5"/>
  <ellipse cx="93" cy="46" rx="5" ry="5.6" fill="#0B1518"/>
  <ellipse cx="107" cy="46" rx="5" ry="5.6" fill="#0B1518"/>
  <circle cx="93" cy="46" r="2.3" fill="#8FDCF2" class="flick"/>
  <circle cx="107" cy="46" r="2.3" fill="#8FDCF2" class="flick"/>
  <path d="M100 52 l-4 7 h8z" fill="#8C8168"/>
  <g stroke="#8C8168" stroke-width="1.7" stroke-linecap="round"><path d="M94 63 h12M95 68 h10"/></g>
</g></svg>`,

/* ────── 재의 각인사 : 각인을 새기는 자 ────── */
ash:`<svg viewBox="0 0 200 280" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
<defs>
<linearGradient id="a_robe" x1=".2" y1="0" x2=".8" y2="1">
<stop offset="0%" stop-color="#4A4E63"/><stop offset="45%" stop-color="#2C3042"/>
<stop offset="100%" stop-color="#14161F"/></linearGradient>
<linearGradient id="a_mant" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#6B5F45"/><stop offset="100%" stop-color="#332C1E"/></linearGradient>
<linearGradient id="a_mask" x1=".2" y1="0" x2=".8" y2="1">
<stop offset="0%" stop-color="#F2E7CE"/><stop offset="55%" stop-color="#CFC0A0"/>
<stop offset="100%" stop-color="#8A7C60"/></linearGradient>
<radialGradient id="a_flame"><stop offset="0%" stop-color="#FFF6DC"/>
<stop offset="34%" stop-color="#FFC46B"/><stop offset="72%" stop-color="#F0562D"/>
<stop offset="100%" stop-color="#F0562D" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="100" cy="270" rx="50" ry="8" fill="rgba(0,0,0,.5)"/>
<g class="idle">
  <!-- 지팡이 -->
  <path d="M150 40 L138 264" stroke="#3E3222" stroke-width="6" stroke-linecap="round"/>
  <path d="M150 40 L138 264" stroke="#6B5A3C" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>
  <circle cx="151" cy="34" r="26" fill="url(#a_flame)" class="flick"/>
  <path d="M151 12 L162 34 L151 56 L140 34z" fill="none" stroke="#FFC98A" stroke-width="2" opacity=".9"/>
  <circle cx="151" cy="34" r="7" fill="#FFF3DC"/>
  <!-- 겉옷 -->
  <path d="M72 104 C58 122 52 168 56 206 L48 262 L152 262 L146 206 C150 168 142 122 128 104z" fill="url(#a_robe)"/>
  <path d="M72 104 C58 122 52 168 56 206 L48 262 L100 262 L100 104z" fill="#39405A" opacity=".35"/>
  <path d="M48 262 l10 12 8-12 9 12 8-12 9 12 8-12 9 12 8-12 9 12 8-12 8 10" fill="#14161F"/>
  <!-- 속옷 갈라짐 -->
  <path d="M100 118 L92 210 L108 210z" fill="#0E1018" opacity=".7"/>
  <!-- 어깨 망토 -->
  <path d="M66 96 C66 82 80 72 100 72 C120 72 134 82 134 96 L140 124 C126 132 74 132 60 124z" fill="url(#a_mant)"/>
  <path d="M60 124 q40 12 80 0 l-4 14 q-36 12 -72 0z" fill="#241E14"/>
  <path d="M70 92 q30 -10 60 0" fill="none" stroke="#9A8A66" stroke-width="1.8" opacity=".75"/>
  <!-- 허리끈 -->
  <path d="M74 168 h52 l3 14 H71z" fill="#5A4A30" stroke="#8A7650" stroke-width="1.4"/>
  <path d="M100 168 l10 14 -10 26 -10-26z" fill="#3E3222" stroke="#D9B463" stroke-width="1.6"/>
  <circle cx="100" cy="184" r="4.5" fill="#F0562D" class="flick"/>
  <!-- 팔 -->
  <path d="M128 122 L142 146 L138 176 L124 170 L122 132z" fill="#2C3042" stroke="#454B63" stroke-width="1.4"/>
  <path d="M133 168 q12 -4 15 6 q3 10 -8 13 q-12 3 -15 -7z" fill="#C9BFA6" stroke="#8A7C60" stroke-width="1.4"/>
  <path d="M72 122 L58 146 L62 176 L76 170 L78 132z" fill="#2C3042" stroke="#454B63" stroke-width="1.4"/>
  <path d="M56 172 q-12 6 -10 17 q3 10 14 7 q11 -4 8 -14z" fill="#C9BFA6" stroke="#8A7C60" stroke-width="1.4"/>
  <!-- 손에 뜬 각인 -->
  <g class="spin-slow" style="transform-origin:52px 186px">
    <path d="M52 172 L62 186 L52 200 L42 186z" fill="none" stroke="#4FC4E8" stroke-width="2" opacity=".85"/></g>
  <circle cx="52" cy="186" r="4" fill="#9EE8FF" class="flick"/>
  <!-- 두건 -->
  <path d="M76 46 C76 30 86 20 100 20 C114 20 124 30 124 46 L127 72 C127 84 114 90 100 90 C86 90 73 84 73 72z" fill="url(#a_robe)"/>
  <path d="M76 46 C76 30 86 20 100 20 L100 90 C86 90 73 84 73 72z" fill="#39405A" opacity=".4"/>
  <path d="M73 72 q27 12 54 0 l2 12 q-29 12 -58 0z" fill="#0E1018" opacity=".6"/>
  <!-- 가면 -->
  <path d="M86 44 C86 35 92 30 100 30 C108 30 114 35 114 44 L115 64 C115 74 108 80 100 80 C92 80 85 74 85 64z" fill="url(#a_mask)" stroke="#8A7C60" stroke-width="1.5"/>
  <path d="M100 30 V80" stroke="#B5A585" stroke-width="1" opacity=".6"/>
  <path d="M89 50 h9 l-2 7 h-7zM111 50 h-9 l2 7 h7z" fill="#0E1018"/>
  <circle cx="93.5" cy="53" r="2" fill="#F0562D" class="flick"/>
  <circle cx="106.5" cy="53" r="2" fill="#F0562D" class="flick"/>
  <path d="M96 70 h8" stroke="#8A7C60" stroke-width="1.6" stroke-linecap="round"/>
  <!-- 이마 각인 -->
  <path d="M100 36 l6 7 -6 7 -6-7z" fill="none" stroke="#D9B463" stroke-width="1.8"/>
</g></svg>`
};

// 캐릭터 정의
const CHARS = {
  ember:{ id:'ember', name:'잿불 처형자', en:'The Ember Reaver', color:'#F0562D',
    hp:74, tag:'지속 피해',
    line:'수백 번 죽고 다시 일어난 기사. 갑옷 틈으로 흘러나오는 불이 상처보다 먼저 아문다.',
    boon:{ n:'꺼지지 않는 맹세', d:'전투 시작 시 적에게 점화 2를 부여합니다.' } },
  frost:{ id:'frost', name:'서리 사냥꾼', en:'The Frost Reaper', color:'#4FC4E8',
    hp:68, tag:'제어와 방어',
    line:'짐승 두개골을 쓰고 회랑을 배회하는 밀정. 숨통을 끊기 전에 먼저 숨을 얼린다.',
    boon:{ n:'식지 않는 살갗', d:'전투 시작 시 방어도 5를 얻습니다.' } },
  ash:{ id:'ash', name:'재의 심판자', en:'The Ash Judge', color:'#D9B463',
    hp:70, tag:'양쪽 모두',
    line:'가면 뒤에 얼굴을 잃은 마지막 심판자. 불과 서리 둘 다 그의 판결을 거들 뿐이다.',
    boon:{ n:'갈라진 저울', d:'매 전투 첫 턴에 카드를 1장 더 뽑습니다.' } },
};

const HERO_SVG_OLD = `<svg viewBox="0 0 140 190" aria-hidden="true">
<defs>
  <linearGradient id="cloak" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#2B3247"/><stop offset="58%" stop-color="#171C29"/><stop offset="100%" stop-color="#0A0D14"/></linearGradient>
  <linearGradient id="cloak2" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#39415C"/><stop offset="100%" stop-color="#131826"/></linearGradient>
  <radialGradient id="brand"><stop offset="0%" stop-color="#FFE6C4"/>
    <stop offset="38%" stop-color="#F0562D"/><stop offset="100%" stop-color="#F0562D" stop-opacity="0"/></radialGradient>
</defs>
<g class="idle">
  <!-- 지팡이 -->
  <path d="M104 42 L92 178" stroke="#3B3126" stroke-width="4.2" stroke-linecap="round"/>
  <path d="M104 42 L92 178" stroke="#5C4C39" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
  <circle cx="106" cy="36" r="22" fill="url(#brand)" class="flick"/>
  <circle cx="106" cy="36" r="6.5" fill="#FFDCAE"/>
  <path d="M106 24 L113 36 L106 48 L99 36 Z" fill="none" stroke="#FFB27A" stroke-width="1.5" opacity=".9"/>
  <!-- 망토 -->
  <path d="M70 52 C50 52 40 68 37 88 L24 158 C22 170 28 178 39 180 L101 180 C112 178 118 170 116 158 L103 88 C100 68 90 52 70 52 Z" fill="url(#cloak)"/>
  <path d="M70 52 C57 52 49 62 46 78 L33 154 C31 166 36 174 45 176 L70 176 Z" fill="url(#cloak2)" opacity=".5"/>
  <!-- 어깨선 -->
  <path d="M42 84 q28 -16 56 0" fill="none" stroke="#3D4560" stroke-width="2.6" opacity=".8"/>
  <!-- 밑단 찢김 -->
  <path d="M24 158 l9 24 9-18 9 22 9-20 9 22 9-21 9 19 9-22 9 18 6-24z" fill="#0A0D14"/>
  <!-- 어깨 각인 -->
  <path d="M46 84 q24 -12 48 0" fill="none" stroke="#D9B463" stroke-width="1.6" opacity=".55"/>
  <path d="M58 100 l12 -14 12 14 -12 14 z" fill="none" stroke="var(--tint)" stroke-width="1.8" opacity=".8"/>
  <circle cx="70" cy="100" r="3" fill="var(--tint)" opacity=".9"/>
  <!-- 후드 -->
  <path d="M70 22 C56 22 46 33 46 48 L48 66 C54 57 62 53 70 53 C78 53 86 57 92 66 L94 48 C94 33 84 22 70 22 Z" fill="#20263A"/>
  <path d="M70 22 C60 22 52 30 50 42 L52 60 C57 53 63 50 70 50 Z" fill="#2C3550" opacity=".7"/>
  <ellipse cx="70" cy="48" rx="15" ry="13" fill="#05070C"/>
  <!-- 눈빛 -->
  <path d="M62 47 h7 M75 47 h7" stroke="var(--tint)" stroke-width="3.2" stroke-linecap="round" class="flick"/>
  <!-- 목 여밈 -->
  <path d="M52 66 q18 10 36 0" fill="none" stroke="#3D4560" stroke-width="2.4"/>
  <circle cx="70" cy="70" r="4" fill="#D9B463" opacity=".75"/>
</g>
<div></div>
</svg>`.replace('<div></div>','');

/* ═══════════════════════════════════════════════════════════
   C. 적 — 실루엣 + 발광 방식 (전부 왼쪽을 향함)
   ═══════════════════════════════════════════════════════════ */
const ENEMY_ART = {
  guardian: "assets/enemies/guardian.webp",
  wolf: "assets/enemies/wolf.webp",
  wisp: "assets/enemies/wisp.webp",
  warden: "assets/enemies/warden.webp",
  guardian2: "assets/enemies/guardian2.webp",
  warden2: "assets/enemies/warden2.webp",
  boss: "assets/enemies/boss.webp"
};
const PROP_ART = {
  stair: "assets/props/stair.webp",
  frostpass: "assets/props/frostpass.webp",
  gate: "assets/props/gate.webp",
  camp: "assets/props/camp.webp",
  court: "assets/props/court.webp",
  observ: "assets/props/observ.webp",
  abyss: "assets/props/abyss.webp",
  shop: "assets/props/shop.webp",
  end: "assets/props/end.webp"
};
const SHOPKEEPER_ART = "assets/npc/shopkeeper.webp";
const TITLE_BG_ART = "assets/bg/title.jpg";

// 적 각인 아트 (실제 자산 없을 때의 대체)
const ART = {
// 잿더미 파수꾼 — 갑주를 두른 석상 전사
guardian:`<svg viewBox="0 0 220 220" aria-hidden="true">
<defs><radialGradient id="g_a"><stop offset="0%" stop-color="#F0562D" stop-opacity=".3"/><stop offset="100%" stop-color="#F0562D" stop-opacity="0"/></radialGradient>
<linearGradient id="g_b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4A4038"/><stop offset="55%" stop-color="#2A241F"/><stop offset="100%" stop-color="#100D0B"/></linearGradient>
<linearGradient id="g_c" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5B4E42"/><stop offset="100%" stop-color="#241E19"/></linearGradient></defs>
<ellipse cx="110" cy="130" rx="102" ry="88" fill="url(#g_a)"/>
<g class="idle">
  <!-- 뒷다리 -->
  <path d="M124 150 q16 4 18 22 l4 34 -26 2 -4 -34z" fill="#100D0B"/>
  <path d="M118 204 h34 l3 8 h-40z" fill="#0A0806"/>
  <!-- 앞다리 -->
  <path d="M78 152 q-14 6 -15 24 l-3 32 26 2 5 -32z" fill="#1A1512"/>
  <path d="M58 206 h34 l3 8 h-40z" fill="#0A0806"/>
  <!-- 몸통 (앞으로 웅크림) -->
  <path d="M62 84 Q110 72 158 86 L152 148 Q110 166 68 150 Z" fill="url(#g_b)"/>
  <path d="M74 100 Q110 92 146 102 L142 140 Q110 152 78 140 Z" fill="none" stroke="#5B4E42" stroke-width="1.4" opacity=".55"/>
  <!-- 균열 발광 -->
  <g stroke="#FF6A32" stroke-width="2.6" stroke-linecap="round" class="flick">
    <path d="M96 100 l-8 18 12 6 -6 20"/><path d="M130 98 l8 20 -10 8 5 16"/></g>
  <circle cx="110" cy="120" r="9" fill="#F0562D" opacity=".45"/>
  <circle cx="110" cy="120" r="3.6" fill="#FFD9AE"/>
  <!-- 견갑 -->
  <path d="M44 92 Q42 62 72 54 L96 52 L100 92 Z" fill="url(#g_c)" stroke="#6B5B4C" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M176 94 Q178 64 148 56 L124 54 L120 94 Z" fill="url(#g_c)" stroke="#6B5B4C" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M50 76 q18 -10 40 -12M170 78 q-18 -10 -40 -12" fill="none" stroke="#83705C" stroke-width="1.8" opacity=".8"/>
  <!-- 왼팔: 땅에 짚은 거대한 주먹 -->
  <path d="M52 92 q-18 20 -18 46 l4 26 26 2 -2 -28 q0 -20 12 -34z" fill="#241E19" stroke="#4A3E33" stroke-width="1.4"/>
  <path d="M32 158 q-8 12 2 22 q12 12 28 4 q8 -6 4 -18z" fill="#31281F" stroke="#6B5B4C" stroke-width="1.6"/>
  <path d="M36 172 h24 M38 182 h20" stroke="#4A3E33" stroke-width="2" stroke-linecap="round"/>
  <!-- 오른팔: 석판 무기 -->
  <path d="M166 94 q16 16 18 38 l-2 22 -22 -2 2 -22 q0 -14 -10 -24z" fill="#241E19" stroke="#4A3E33" stroke-width="1.4"/>
  <path d="M158 46 l40 -12 16 52 -40 12z" fill="#221D18" stroke="#6B5B4C" stroke-width="2" stroke-linejoin="round"/>
  <path d="M170 58 l24 -7 8 26 -24 7z" fill="none" stroke="#F0562D" stroke-width="1.6" opacity=".6"/>
  <path d="M176 96 L172 132" stroke="#3A302A" stroke-width="7" stroke-linecap="round"/>
  <!-- 머리 (어깨 사이로 낮게) -->
  <path d="M88 34 Q110 24 132 34 L136 62 Q110 72 84 62 Z" fill="#3A322B" stroke="#6B5B4C" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M110 22 L110 34" stroke="#6B5B4C" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M104 18 l6 -8 6 8" fill="none" stroke="#83705C" stroke-width="2"/>
  <path d="M86 50 h48" stroke="#05060A" stroke-width="11" stroke-linecap="round"/>
  <path d="M90 50 h15 M116 50 h13" stroke="#FF7A45" stroke-width="5" stroke-linecap="round" class="flick"/>
</g></svg>`,

// 서리 늑대 — 네 발 짐승
wolf:`<svg viewBox="0 0 220 220" aria-hidden="true">
<defs><radialGradient id="w_a"><stop offset="0%" stop-color="#4FC4E8" stop-opacity=".3"/><stop offset="100%" stop-color="#4FC4E8" stop-opacity="0"/></radialGradient>
<linearGradient id="w_b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#28394A"/><stop offset="100%" stop-color="#0D141C"/></linearGradient></defs>
<ellipse cx="110" cy="130" rx="106" ry="82" fill="url(#w_a)"/>
<g class="idle">
  <!-- 꼬리 -->
  <path d="M182 118 q28 -6 26 -34 q-4 26 -22 26z" fill="#16202B"/>
  <path d="M178 116 q26 -2 28 -28" fill="none" stroke="#2C4256" stroke-width="9" stroke-linecap="round"/>
  <!-- 뒷다리 -->
  <path d="M164 138 q10 22 4 46 l-14 2 q4 -26 -4 -44z" fill="#101821"/>
  <path d="M74 140 q-10 22 -4 46 l14 2 q-4 -26 4 -44z" fill="#101821"/>
  <!-- 몸통 -->
  <path d="M66 128 Q86 96 122 98 L166 104 Q190 110 188 132 L180 154 Q120 168 72 156 Z" fill="url(#w_b)"/>
  <!-- 앞다리 -->
  <path d="M92 146 q-6 24 -2 42 l16 1 q-4 -22 2 -40z" fill="#141E28"/>
  <path d="M126 150 q-4 22 0 38 l16 0 q-4 -20 0 -36z" fill="#0E161E"/>
  <!-- 등 서리 가시 -->
  <g fill="#7FD8F2" opacity=".85">
    <path d="M96 100 l8 -30 8 28z"/><path d="M122 98 l10 -36 8 34z"/><path d="M150 104 l8 -26 7 26z"/></g>
  <g fill="#BEEEFF" opacity=".55">
    <path d="M100 90 l4 -14 4 13z"/><path d="M128 84 l5 -18 4 17z"/></g>
  <!-- 목/머리 -->
  <path d="M66 128 Q52 122 44 130 L20 138 Q10 142 14 150 L44 158 Q60 158 72 152 Z" fill="#1B2836"/>
  <path d="M44 130 L18 137 Q8 141 13 149 L40 156" fill="#22323F"/>
  <!-- 귀 -->
  <path d="M56 120 l-4 -22 16 16z" fill="#22323F"/><path d="M74 118 l2 -20 12 18z" fill="#1A2734"/>
  <!-- 눈 -->
  <path d="M40 138 l12 -3" stroke="#BEEEFF" stroke-width="4" stroke-linecap="round" class="flick"/>
  <!-- 이빨 -->
  <path d="M16 148 l6 8 3 -8 5 8 3 -8" fill="none" stroke="#DFF6FF" stroke-width="2" stroke-linejoin="round"/>
  <!-- 숨결 -->
  <g fill="#BEEEFF" opacity=".3" class="flick"><circle cx="8" cy="152" r="4"/><circle cx="0" cy="146" r="6"/></g>
</g></svg>`,

// 잿불 도깨비 — 가면 쓴 불꽃 망령
wisp:`<svg viewBox="0 0 220 220" aria-hidden="true">
<defs><radialGradient id="p_a"><stop offset="0%" stop-color="#FF8B3D" stop-opacity=".42"/><stop offset="100%" stop-color="#FF8B3D" stop-opacity="0"/></radialGradient>
<linearGradient id="p_b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFC96B"/><stop offset="42%" stop-color="#F0562D"/><stop offset="100%" stop-color="#6E1D0C"/></linearGradient></defs>
<ellipse cx="110" cy="112" rx="100" ry="102" fill="url(#p_a)"/>
<g class="floaty">
  <!-- 불꽃 몸체 -->
  <path d="M110 22 C118 62 96 76 82 98 C68 120 60 138 60 156 C60 184 82 202 110 202 C138 202 160 184 160 156 C160 134 142 118 132 100 C122 82 116 62 110 22Z" fill="url(#p_b)" opacity=".62"/>
  <path d="M110 60 C114 88 98 98 90 114 C82 130 78 142 78 154 C78 172 92 184 110 184 C128 184 142 172 142 154 C142 140 130 128 124 114 C118 100 113 84 110 60Z" fill="#FFB05A" opacity=".45" class="flick"/>
  <!-- 흩날리는 잿불 -->
  <g fill="#FFCE8A" class="flick"><circle cx="76" cy="60" r="3.6" opacity=".8"/><circle cx="148" cy="48" r="2.8" opacity=".6"/>
  <circle cx="164" cy="88" r="3.2" opacity=".55"/><circle cx="56" cy="96" r="2.6" opacity=".7"/></g>
  <!-- 가면 -->
  <path d="M110 96 C88 96 76 112 76 132 C76 154 92 170 110 170 C128 170 144 154 144 132 C144 112 132 96 110 96Z" fill="#17110E" stroke="#C67A3A" stroke-width="2"/>
  <path d="M84 126 q12 -8 22 -2 M136 126 q-12 -8 -22 -2" fill="none" stroke="#FFD9A0" stroke-width="4.5" stroke-linecap="round" class="flick"/>
  <path d="M96 150 q14 10 28 0" fill="none" stroke="#C67A3A" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M110 96 v-14" stroke="#C67A3A" stroke-width="2.4"/>
  <!-- 뿔 -->
  <path d="M84 104 l-16 -26 24 14z" fill="#17110E" stroke="#C67A3A" stroke-width="1.4"/>
  <path d="M136 104 l16 -26 -24 14z" fill="#17110E" stroke="#C67A3A" stroke-width="1.4"/>
</g></svg>`,

// 균열의 감시자 — 눈을 품은 장포의 존재
warden:`<svg viewBox="0 0 220 220" aria-hidden="true">
<defs><radialGradient id="v_a"><stop offset="0%" stop-color="#C4384B" stop-opacity=".38"/><stop offset="100%" stop-color="#C4384B" stop-opacity="0"/></radialGradient>
<linearGradient id="v_b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3A1C28"/><stop offset="62%" stop-color="#1A0E14"/><stop offset="100%" stop-color="#0A0609"/></linearGradient></defs>
<ellipse cx="110" cy="110" rx="106" ry="106" fill="url(#v_a)"/>
<g class="spin-slow" opacity=".45"><circle cx="110" cy="110" r="100" fill="none" stroke="#8A2536" stroke-width="1.2" stroke-dasharray="3 12"/></g>
<g class="spin-rev" opacity=".35"><circle cx="110" cy="110" r="84" fill="none" stroke="#C4384B" stroke-width="1" stroke-dasharray="22 30"/></g>
<g class="floaty">
  <!-- 장포 -->
  <path d="M110 40 C82 40 66 66 64 100 L50 186 Q110 202 170 186 L156 100 C154 66 138 40 110 40Z" fill="url(#v_b)" stroke="#5C2634" stroke-width="1.6"/>
  <path d="M50 186 l12 16 10 -14 12 16 12 -16 14 16 12 -16 12 14 10 -16 8 14 4 -14" fill="#0A0609"/>
  <!-- 팔 -->
  <path d="M66 104 q-24 22 -22 56 l16 4 q-2 -30 18 -46z" fill="#1E1017"/>
  <path d="M154 104 q24 22 22 56 l-16 4 q2 -30 -18 -46z" fill="#1E1017"/>
  <!-- 후드 -->
  <path d="M110 30 C88 30 74 46 74 70 L78 96 Q94 84 110 84 Q126 84 142 96 L146 70 C146 46 132 30 110 30Z" fill="#2A1520" stroke="#5C2634" stroke-width="1.6"/>
  <path d="M74 62 l-14 -26 20 12M146 62 l14 -26 -20 12" fill="#2A1520" stroke="#5C2634" stroke-width="1.4"/>
  <!-- 대안 -->
  <path d="M70 78 Q110 46 150 78 Q110 116 70 78Z" fill="#0A0509" stroke="#E8556B" stroke-width="2.4"/>
  <circle cx="110" cy="78" r="17" fill="#C4384B" opacity=".55"/>
  <circle cx="110" cy="78" r="17" fill="none" stroke="#FF8B9E" stroke-width="2"/>
  <ellipse cx="110" cy="78" rx="5" ry="14" fill="#0A0509"/>
  <circle cx="110" cy="72" r="3" fill="#FFE0E6" class="flick"/>
  <!-- 가슴 각인 -->
  <path d="M110 122 l18 22 -18 22 -18 -22z" fill="none" stroke="#C4384B" stroke-width="2" opacity=".65"/>
  <circle cx="110" cy="144" r="5" fill="#C4384B" opacity=".6" class="flick"/>
</g></svg>`,

// 무너진 파수꾼 — 파수꾼의 붕괴 변종
guardian2:`<svg viewBox="0 0 220 220" aria-hidden="true">
<defs><radialGradient id="g2_a"><stop offset="0%" stop-color="#B03A6E" stop-opacity=".32"/><stop offset="100%" stop-color="#B03A6E" stop-opacity="0"/></radialGradient>
<linearGradient id="g2_b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4A3540"/><stop offset="55%" stop-color="#291D26"/><stop offset="100%" stop-color="#100B0F"/></linearGradient>
<linearGradient id="g2_c" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5E4152"/><stop offset="100%" stop-color="#231821"/></linearGradient></defs>
<ellipse cx="110" cy="128" rx="106" ry="92" fill="url(#g2_a)"/>
<g class="idle">
  <path d="M126 150 q17 4 19 23 l4 35 -27 2 -4 -35z" fill="#100B0F"/>
  <path d="M120 208 h35 l3 8 h-41z" fill="#080508"/>
  <path d="M76 152 q-15 6 -16 25 l-3 33 27 2 5 -33z" fill="#1B1319"/>
  <path d="M56 210 h35 l3 8 h-41z" fill="#080508"/>
  <path d="M60 82 Q110 68 160 84 L154 148 Q110 168 66 150 Z" fill="url(#g2_b)"/>
  <!-- 결손: 몸통이 뜯겨나감 -->
  <path d="M136 84 l22 18 -20 22 18 18 -12 16 -8 -16 14 -18 -20 -20z" fill="#06040A"/>
  <g stroke="#FF6A32" stroke-width="2.8" stroke-linecap="round" class="flick">
    <path d="M92 98 l-10 20 14 6 -8 22"/><path d="M120 96 l6 18"/></g>
  <circle cx="106" cy="120" r="10" fill="#B03A6E" opacity=".45"/>
  <circle cx="106" cy="120" r="4" fill="#FFD0E4"/>
  <path d="M42 90 Q40 58 70 50 L96 48 L100 90 Z" fill="url(#g2_c)" stroke="#7A5468" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M178 92 Q180 62 150 54 L126 52 L122 92 Z" fill="url(#g2_c)" stroke="#7A5468" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M162 46 l26 -18 -8 26z" fill="#06040A"/>
  <path d="M50 74 q18 -10 40 -12" fill="none" stroke="#9A6B85" stroke-width="1.8" opacity=".75"/>
  <path d="M50 90 q-20 22 -20 50 l4 28 27 2 -2 -30 q0 -22 13 -36z" fill="#231821" stroke="#523649" stroke-width="1.4"/>
  <path d="M30 162 q-9 13 2 24 q13 13 30 4 q9 -6 4 -19z" fill="#31212C" stroke="#7A5468" stroke-width="1.6"/>
  <path d="M34 176 h26 M36 187 h22" stroke="#523649" stroke-width="2" stroke-linecap="round"/>
  <path d="M168 92 q17 17 19 40 l-2 24 -24 -2 2 -24 q0 -15 -11 -26z" fill="#231821" stroke="#523649" stroke-width="1.4"/>
  <path d="M158 40 l42 -13 17 55 -42 13z" fill="#221822" stroke="#7A5468" stroke-width="2" stroke-linejoin="round"/>
  <path d="M171 53 l25 -8 9 28 -25 8z" fill="none" stroke="#F0562D" stroke-width="1.6" opacity=".6"/>
  <path d="M178 94 L174 134" stroke="#3A2833" stroke-width="7" stroke-linecap="round"/>
  <path d="M86 30 Q110 20 134 30 L138 60 Q110 71 82 60 Z" fill="#3B2B36" stroke="#7A5468" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M100 14 L110 24 L120 12" fill="none" stroke="#7A5468" stroke-width="3"/>
  <path d="M84 48 h52" stroke="#05060A" stroke-width="12" stroke-linecap="round"/>
  <path d="M88 48 h17 M118 48 h14" stroke="#FF7A45" stroke-width="5.4" stroke-linecap="round" class="flick"/>
</g></svg>`,

// 심연의 감시자 — 다안(多眼)의 상위 감시자
warden2:`<svg viewBox="0 0 220 220" aria-hidden="true">
<defs><radialGradient id="v2_a"><stop offset="0%" stop-color="#7B3BC4" stop-opacity=".4"/><stop offset="100%" stop-color="#7B3BC4" stop-opacity="0"/></radialGradient>
<linearGradient id="v2_b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2E1A48"/><stop offset="60%" stop-color="#150C22"/><stop offset="100%" stop-color="#080513"/></linearGradient></defs>
<ellipse cx="110" cy="110" rx="110" ry="110" fill="url(#v2_a)"/>
<g class="spin-slow" opacity=".5"><circle cx="110" cy="110" r="104" fill="none" stroke="#5A2A90" stroke-width="1.2" stroke-dasharray="3 10"/></g>
<g class="spin-rev" opacity=".4"><circle cx="110" cy="110" r="88" fill="none" stroke="#9B5BE0" stroke-width="1" stroke-dasharray="18 26"/>
<circle cx="110" cy="110" r="70" fill="none" stroke="#7B3BC4" stroke-width=".9" stroke-dasharray="4 9"/></g>
<g class="floaty">
  <path d="M110 32 C78 32 60 62 58 100 L42 192 Q110 210 178 192 L162 100 C160 62 142 32 110 32Z" fill="url(#v2_b)" stroke="#4A2678" stroke-width="1.6"/>
  <path d="M42 192 l14 18 12 -16 14 18 14 -18 16 18 14 -18 14 16 12 -18 10 16 6 -16" fill="#080513"/>
  <path d="M58 106 q-28 24 -26 62 l18 4 q-2 -34 22 -52z" fill="#1A0F2A"/>
  <path d="M162 106 q28 24 26 62 l-18 4 q2 -34 -22 -52z" fill="#1A0F2A"/>
  <path d="M110 20 C86 20 70 38 70 64 L74 94 Q92 80 110 80 Q128 80 146 94 L150 64 C150 38 134 20 110 20Z" fill="#221338" stroke="#4A2678" stroke-width="1.6"/>
  <path d="M70 54 l-18 -30 24 14M150 54 l18 -30 -24 14" fill="#221338" stroke="#4A2678" stroke-width="1.4"/>
  <path d="M64 72 Q110 34 156 72 Q110 118 64 72Z" fill="#07040E" stroke="#B482F0" stroke-width="2.4"/>
  <circle cx="110" cy="72" r="19" fill="#7B3BC4" opacity=".55"/>
  <circle cx="110" cy="72" r="19" fill="none" stroke="#D3B0FF" stroke-width="2.2"/>
  <ellipse cx="110" cy="72" rx="6" ry="16" fill="#07040E"/>
  <circle cx="110" cy="65" r="3.4" fill="#F2E6FF" class="flick"/>
  <!-- 보조 눈 -->
  <g class="flick"><circle cx="80" cy="122" r="7" fill="#07040E" stroke="#B482F0" stroke-width="1.6"/>
  <circle cx="80" cy="122" r="2.6" fill="#D3B0FF"/>
  <circle cx="140" cy="122" r="7" fill="#07040E" stroke="#B482F0" stroke-width="1.6"/>
  <circle cx="140" cy="122" r="2.6" fill="#D3B0FF"/>
  <circle cx="110" cy="146" r="8.5" fill="#07040E" stroke="#B482F0" stroke-width="1.6"/>
  <circle cx="110" cy="146" r="3" fill="#D3B0FF"/></g>
</g></svg>`,

// 소멸의 화신 — 일식 고리를 등진 거대한 존재
boss:`<svg viewBox="0 0 220 220" aria-hidden="true">
<defs><radialGradient id="b_a"><stop offset="0%" stop-color="#F0562D" stop-opacity=".48"/><stop offset="52%" stop-color="#D9B463" stop-opacity=".14"/><stop offset="100%" stop-color="#D9B463" stop-opacity="0"/></radialGradient>
<linearGradient id="b_g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F0562D"/><stop offset="50%" stop-color="#D9B463"/><stop offset="100%" stop-color="#4FC4E8"/></linearGradient>
<linearGradient id="b_b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3A2A1C"/><stop offset="58%" stop-color="#170F0C"/><stop offset="100%" stop-color="#080605"/></linearGradient></defs>
<ellipse cx="110" cy="108" rx="112" ry="112" fill="url(#b_a)"/>
<!-- 일식 -->
<circle cx="110" cy="86" r="66" fill="#0A0710"/>
<circle cx="110" cy="86" r="66" fill="none" stroke="url(#b_g)" stroke-width="2.4" opacity=".85"/>
<g class="spin-slow"><circle cx="110" cy="86" r="82" fill="none" stroke="url(#b_g)" stroke-width="1.3" stroke-dasharray="4 12" opacity=".7"/></g>
<g class="spin-rev"><circle cx="110" cy="86" r="98" fill="none" stroke="#D9B463" stroke-width="1" stroke-dasharray="26 34" opacity=".45"/></g>
<g class="floaty">
  <!-- 날개형 파편 -->
  <g fill="#120C0A" stroke="#6A4A2A" stroke-width="1.4" opacity=".95">
    <path d="M74 96 L14 58 L30 104 L4 100 L36 132 L74 124z"/>
    <path d="M146 96 L206 58 L190 104 L216 100 L184 132 L146 124z"/></g>
  <!-- 몸통 -->
  <path d="M110 40 C84 40 68 66 66 100 L52 190 Q110 208 168 190 L154 100 C152 66 136 40 110 40Z" fill="url(#b_b)" stroke="#7A5730" stroke-width="1.8"/>
  <path d="M52 190 l14 18 12 -16 14 18 14 -18 16 18 14 -18 14 16 12 -18 10 16" fill="#080605"/>
  <!-- 관 -->
  <path d="M110 26 C90 26 76 42 76 64 L80 92 Q95 80 110 80 Q125 80 140 92 L144 64 C144 42 130 26 110 26Z" fill="#221710" stroke="#7A5730" stroke-width="1.6"/>
  <path d="M76 56 L58 22 L84 40 M144 56 L162 22 L136 40" fill="#221710" stroke="#7A5730" stroke-width="1.5"/>
  <path d="M110 18 v10" stroke="#D9B463" stroke-width="2.6"/>
  <!-- 얼굴: 공허 -->
  <ellipse cx="110" cy="66" rx="22" ry="18" fill="#05040A"/>
  <path d="M96 62 h11 M113 62 h11" stroke="#FFB27A" stroke-width="4.5" stroke-linecap="round" class="flick"/>
  <!-- 핵 -->
  <circle cx="110" cy="132" r="26" fill="#07050B" stroke="#D9B463" stroke-width="2"/>
  <path d="M110 108 a24 24 0 0 0 0 48 18 18 0 0 1 0 -48z" fill="#F0562D" opacity=".7" class="flick"/>
  <circle cx="110" cy="132" r="8" fill="#FFE9C2"/>
  <circle cx="110" cy="132" r="26" fill="none" stroke="#FFD9A8" stroke-width="1" opacity=".55"/>
</g></svg>`
};

// 시작 덱 문양
const STARTER_SIGIL = {
ember:`<svg viewBox="0 0 100 100" aria-hidden="true">
<circle cx="50" cy="50" r="44" fill="none" stroke="#F0562D" stroke-width=".9" stroke-dasharray="3 8" opacity=".5" class="spin-slow"/>
<path d="M50 14c5 22-9 27-17 39-6 9-9 16-9 23 0 15 12 25 26 25s26-10 26-25c0-13-11-20-17-30-5-9-8-17-9-32z" fill="rgba(240,86,45,.16)" stroke="#F0562D" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M50 56c-4 8-10 11-10 18 0 6 4 11 10 11s10-5 10-11c0-7-6-10-10-18z" fill="#F0562D" opacity=".75"/>
<circle cx="50" cy="50" r="3" fill="#FFDCB8"/></svg>`,
frost:`<svg viewBox="0 0 100 100" aria-hidden="true">
<circle cx="50" cy="50" r="44" fill="none" stroke="#4FC4E8" stroke-width=".9" stroke-dasharray="3 8" opacity=".5" class="spin-rev"/>
<g stroke="#4FC4E8" stroke-width="2.6" stroke-linecap="round">
<path d="M50 16v68M22 32l56 36M78 32L22 68"/></g>
<g stroke="#A8E6F8" stroke-width="2" stroke-linecap="round">
<path d="M50 26l-8-8M50 26l8-8M50 74l-8 8M50 74l8 8M32 40l-11-1M32 40l-2-11M68 60l11 1M68 60l2 11M32 60l-11 1M32 60l-2 11M68 40l11-1M68 40l2-11"/></g>
<circle cx="50" cy="50" r="5" fill="rgba(79,196,232,.35)"/><circle cx="50" cy="50" r="2.4" fill="#DFF6FF"/></svg>`,
ash:`<svg viewBox="0 0 100 100" aria-hidden="true">
<circle cx="50" cy="50" r="44" fill="none" stroke="#D9B463" stroke-width=".9" stroke-dasharray="3 8" opacity=".5" class="spin-slow"/>
<path d="M50 18 L74 50 L50 82 L26 50z" fill="none" stroke="#D9B463" stroke-width="2.2"/>
<path d="M50 18 L74 50 L50 50z" fill="rgba(240,86,45,.3)"/>
<path d="M50 82 L26 50 L50 50z" fill="rgba(79,196,232,.3)"/>
<circle cx="50" cy="50" r="7" fill="#0B0D14" stroke="#D9B463" stroke-width="1.8"/>
<circle cx="50" cy="50" r="2.6" fill="#FFE9B8"/></svg>`
};

// 타이틀 씬: 회랑을 내려다보는 각인사
const TITLE_ART = `<svg viewBox="0 0 560 200" aria-hidden="true">
<defs><radialGradient id="t_glow"><stop offset="0%" stop-color="#F0562D" stop-opacity=".5"/><stop offset="100%" stop-color="#F0562D" stop-opacity="0"/></radialGradient>
<linearGradient id="t_ring" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#F0562D"/><stop offset="52%" stop-color="#D9B463"/><stop offset="100%" stop-color="#4FC4E8"/></linearGradient></defs>
<ellipse cx="280" cy="120" rx="230" ry="82" fill="url(#t_glow)" opacity=".5"/>
<g transform="translate(280 104)" opacity=".9">
  <g class="spin-slow" style="animation-duration:60s">
    <ellipse rx="150" ry="52" fill="none" stroke="url(#t_ring)" stroke-width="1.6" stroke-dasharray="200 70" opacity=".7"/>
    <ellipse rx="112" ry="112" fill="none" stroke="url(#t_ring)" stroke-width="1.2" stroke-dasharray="240 90" opacity=".45" transform="rotate(20)"/>
  </g>
  <g class="spin-rev" style="animation-duration:44s">
    <ellipse rx="78" ry="34" fill="none" stroke="#D9B463" stroke-width="1.1" stroke-dasharray="130 44" opacity=".55" transform="rotate(-14)"/>
  </g>
</g>
<g transform="translate(232 52) scale(.62)">
  <path d="M104 42 L92 178" stroke="#3B3126" stroke-width="4.2" stroke-linecap="round"/>
  <circle cx="106" cy="36" r="20" fill="url(#t_glow)" class="flick"/>
  <circle cx="106" cy="36" r="6" fill="#FFDCAE"/>
  <path d="M70 52 C52 52 42 68 40 86 L30 156 C28 168 34 176 44 178 L96 178 C106 176 112 168 110 156 L100 86 C98 68 88 52 70 52 Z" fill="#141926"/>
  <path d="M30 156 l10 22 8-16 9 20 8-18 8 20 8-19 8 17 9-20 8 16 4-22z" fill="#0A0D14"/>
  <path d="M70 22 C56 22 46 33 46 48 L48 66 C54 57 62 53 70 53 C78 53 86 57 92 66 L94 48 C94 33 84 22 70 22 Z" fill="#1D2335"/>
  <ellipse cx="70" cy="48" rx="15" ry="13" fill="#05070C"/>
  <path d="M62 47 h7 M75 47 h7" stroke="#F0562D" stroke-width="3.4" stroke-linecap="round" class="flick"/>
  <circle cx="70" cy="70" r="4" fill="#D9B463" opacity=".8"/>
</g>
<g opacity=".55" fill="#0A0D14">
  <path d="M0 200v-40l40 8 30-14 34 18 26-10v38z"/>
  <path d="M560 200v-44l-46 10-32-16-30 18-24-8v40z"/></g>
</svg>`;

const SLASH_SVG = {
  cut:`<svg viewBox="0 0 100 100"><path d="M14 74 C36 52 58 34 88 20" fill="none" stroke="rgba(255,240,225,.95)" stroke-width="5" stroke-linecap="round"/><path d="M20 84 C42 62 62 46 92 32" fill="none" stroke="rgba(255,160,120,.6)" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  fire:`<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="26" fill="none" stroke="rgba(255,170,90,.9)" stroke-width="5"/><circle cx="50" cy="50" r="38" fill="none" stroke="rgba(240,86,45,.5)" stroke-width="2"/></svg>`,
  ice:`<svg viewBox="0 0 100 100"><g stroke="rgba(190,238,255,.92)" stroke-width="4" stroke-linecap="round"><path d="M50 18v64M24 32l52 36M76 32L24 68"/></g></svg>`
};

/* ═══════════════════════════════════════════════════════════
   D. 사운드 — WebAudio 합성 (외부 파일 없음)
   ═══════════════════════════════════════════════════════════ */
const SFX = (() => {
  let ctx = null, master = null, ambGain = null, on = true, started = false;

  function init(){
    if(ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.34;
      master.connect(ctx.destination);
    } catch(e){ ctx = null; }
  }
  function ready(){
    if(!ctx) init();
    if(!ctx) return false;
    if(ctx.state === 'suspended') ctx.resume();
    return on;
  }
  function env(node, t0, a, d, peak){
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g); g.connect(master);
    return g;
  }
  function tone(freq, t0, dur, type, peak, glideTo){
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    env(o, t0, Math.min(0.02, dur * .25), dur, peak == null ? .3 : peak);
    o.start(t0); o.stop(t0 + dur + .06);
    return o;
  }
  let noiseBuf = null;
  function noise(t0, dur, freq, q, peak, type){
    if(!noiseBuf){
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t0); f.Q.value = q || 1;
    s.connect(f);
    env(f, t0, 0.006, dur, peak == null ? .25 : peak);
    s.start(t0); s.stop(t0 + dur + .06);
    return f;
  }

  const S = {
    ui(){ if(!ready())return; const t=ctx.currentTime; tone(880,t,.05,'triangle',.10); },
    click(){ if(!ready())return; const t=ctx.currentTime; tone(520,t,.07,'triangle',.16,760); },
    card(){ if(!ready())return; const t=ctx.currentTime;
      noise(t,.16,2400,1.2,.12,'bandpass'); tone(360,t,.1,'triangle',.10,540); },
    hit(){ if(!ready())return; const t=ctx.currentTime;
      tone(150,t,.16,'square',.20,60); noise(t,.13,900,.8,.22,'lowpass'); },
    heavy(){ if(!ready())return; const t=ctx.currentTime;
      tone(90,t,.34,'sawtooth',.3,38); noise(t,.24,600,.7,.3,'lowpass'); tone(220,t,.14,'square',.14,90); },
    block(){ if(!ready())return; const t=ctx.currentTime;
      tone(1180,t,.12,'triangle',.16,880); tone(1760,t+.02,.08,'sine',.08); },
    shatter(){ if(!ready())return; const t=ctx.currentTime;
      noise(t,.34,2600,.7,.26,'bandpass'); noise(t+.03,.24,900,.5,.2,'lowpass');
      [1760,1320,990].forEach((f,i)=>tone(f,t+i*.035,.22,'triangle',.11,f*.5)); },
    hurt(){ if(!ready())return; const t=ctx.currentTime;
      tone(200,t,.26,'sawtooth',.24,70); noise(t,.2,420,.6,.22,'lowpass'); },
    ignite(){ if(!ready())return; const t=ctx.currentTime;
      noise(t,.4,1500,.5,.16,'bandpass'); noise(t+.06,.3,2600,.9,.1,'bandpass'); },
    freeze(){ if(!ready())return; const t=ctx.currentTime;
      [1568,2093,2637].forEach((f,i)=>tone(f,t+i*.045,.5,'sine',.13));
      noise(t,.5,5200,2.4,.09,'bandpass'); },
    shock(){ if(!ready())return; const t=ctx.currentTime;
      tone(70,t,.6,'sawtooth',.34,30); noise(t,.42,1800,.4,.32,'lowpass');
      [880,1320,1760].forEach((f,i)=>tone(f,t+.03+i*.03,.34,'triangle',.13,f*.55)); },
    heal(){ if(!ready())return; const t=ctx.currentTime;
      [523,659,784].forEach((f,i)=>tone(f,t+i*.07,.3,'sine',.14)); },
    potion(){ if(!ready())return; const t=ctx.currentTime;
      tone(700,t,.22,'sine',.16,1400); noise(t,.14,3200,1.6,.08,'bandpass'); },
    turn(){ if(!ready())return; const t=ctx.currentTime;
      tone(196,t,.3,'sine',.16); tone(294,t+.05,.28,'sine',.1); },
    reward(){ if(!ready())return; const t=ctx.currentTime;
      [523,659,784,1047].forEach((f,i)=>tone(f,t+i*.075,.42,'triangle',.14)); },
    win(){ if(!ready())return; const t=ctx.currentTime;
      [392,523,659,784,1047].forEach((f,i)=>tone(f,t+i*.13,.9,'triangle',.17)); },
    lose(){ if(!ready())return; const t=ctx.currentTime;
      [392,330,262,196].forEach((f,i)=>tone(f,t+i*.19,1.0,'sine',.17));
      tone(98,t,1.8,'sawtooth',.12,60); },
  };

  // 낮은 앰비언트 드론
  function ambient(){
    if(!ctx || started) return;
    started = true;
    ambGain = ctx.createGain();
    ambGain.gain.value = 0.0001;
    ambGain.connect(master);
    ambGain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 4);
    [55, 82.5, 110, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = f;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045 + i * 0.021;
      const lg = ctx.createGain(); lg.gain.value = f * 0.006;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start();
      const g = ctx.createGain(); g.gain.value = 0.3 / (i + 1.3);
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 420;
      o.connect(g); g.connect(fl); fl.connect(ambGain);
      o.start();
    });
  }

  return {
    play(k){ const f = S[k]; if(f){ try{ f(); }catch(e){} } },
    begin(){ init(); if(ready()) ambient(); },
    toggle(){ on = !on; if(master) master.gain.value = on ? 0.34 : 0; return on; },
    isOn(){ return on; }
  };
})();


const POTION_ART = {
  p_heal:'#6FA678', p_fire:'#F0562D', p_ice:'#4FC4E8', p_str:'#D9B463', p_energy:'#E8A33C'
};
function potionSvg(color){
  return `<svg viewBox="0 0 40 52" aria-hidden="true">
    <path d="M16 4h8v8l7 13a11 11 0 0 1-11 16h0a11 11 0 0 1-11-16l7-13V4z" fill="rgba(255,255,255,.05)" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M11.5 27a11 11 0 0 0 8.5 18 11 11 0 0 0 8.5-18z" fill="${color}" opacity=".55"/>
    <rect x="14" y="1.5" width="12" height="4.5" rx="1.6" fill="${color}" opacity=".8"/>
    <circle cx="17" cy="34" r="1.8" fill="#fff" opacity=".55"/><circle cx="23" cy="38" r="1.2" fill="#fff" opacity=".4"/>
  </svg>`;
}

/* ═══════════════════════════════════════════════════════════
   2. 카드 데이터
   ═══════════════════════════════════════════════════════════ */
// 표시용 헬퍼 (전투 중이면 실제 보정치 반영)
function pAtk(base){
  if(!C) return base;
  let d = base + C.p.str;
  if(C.p.weak > 0) d = Math.floor(d * 0.75);
  return Math.max(0, d);
}
const B  = v => `<b>${v}</b>`;
const KF = t => `<span class="kf">${t}</span>`;
const KI = t => `<span class="ki">${t}</span>`;
const KV = t => `<span class="kv">${t}</span>`;
const KW = t => `<span class="kw">${t}</span>`;
const KS = t => `<span class="ks">${t}</span>`;
const KB = t => `<span class="kb">${t}</span>`;

const CARDS = {
  strike:{ n:'강타', c:1, t:'attack', el:null, art:'sword', basic:true,
    d:()=>`피해 ${B(pAtk(6))}`,
    use:async()=>{ await attack(6); } },

  defend:{ n:'수비', c:1, t:'skill', el:null, art:'shield', basic:true,
    d:()=>`${KB('방어도')} ${B(6)}`,
    use:async()=>{ await gainBlock(6); } },

  ember_toss:{ n:'불씨 던지기', c:1, t:'attack', el:'fire', art:'flame',
    d:()=>`피해 ${B(pAtk(4))}. ${KF('점화')} ${B(2)}`,
    use:async()=>{ await attack(4); await applyE('ignite',2); } },

  frost_shard:{ n:'서리 파편', c:1, t:'attack', el:'ice', art:'snow',
    d:()=>`피해 ${B(pAtk(3))}. ${KI('서리')} ${B(2)}`,
    use:async()=>{ await attack(3); await applyE('frost',2); } },

  mark:{ n:'표식', c:1, t:'skill', el:null, art:'eye',
    d:()=>`${KV('취약')} ${B(2)}`,
    use:async()=>{ await applyE('vuln',2); } },

  regroup:{ n:'재정비', c:1, t:'skill', el:null, art:'cards',
    d:()=>`카드 ${B(2)}장 뽑기`,
    use:async()=>{ draw(2); } },

  sigil:{ n:'화염 각인', c:1, t:'skill', el:'fire', art:'flame',
    d:()=>`${KF('점화')} ${B(3)}`,
    use:async()=>{ await applyE('ignite',3); } },

  frost_ward:{ n:'서리 방벽', c:1, t:'skill', el:'ice', art:'shield',
    d:()=>`${KB('방어도')} ${B(6)}. ${KI('서리')} ${B(2)}`,
    use:async()=>{ await gainBlock(6); await applyE('frost',2); } },

  flurry:{ n:'연타', c:1, t:'attack', el:null, art:'sword',
    d:()=>`피해 ${B(pAtk(3))}을 ${B(2)}회`,
    use:async()=>{ await attack(3); if(C.e.hp>0){ await wait(130); await attack(3);} } },

  sleet:{ n:'진눈깨비', c:1, t:'attack', el:'ice', art:'snow',
    d:()=>`피해 ${B(pAtk(4))}. ${KW('약화')} ${B(2)}`,
    use:async()=>{ await attack(4); await applyE('weak',2); } },

  kindle:{ n:'불티', c:0, t:'skill', el:'fire', art:'bolt',
    d:()=>`${KF('점화')} ${B(1)}. 카드 ${B(1)}장 뽑기`,
    use:async()=>{ await applyE('ignite',1); draw(1); } },

  glacier:{ n:'빙하', c:2, t:'attack', el:'ice', art:'snow',
    d:()=>`피해 ${B(pAtk(10))}. ${KI('서리')} ${B(2)}`,
    use:async()=>{ await attack(10); await applyE('frost',2); } },

  detonate:{ n:'기폭', c:2, t:'attack', el:'fire', art:'burst',
    d:()=>{ const st = C ? C.e.ignite : 0; return `${KF('점화')} 1당 피해 ${B(5)}. 점화를 모두 소모${C? ` <span style="color:#FF9165">(현재 ${st*5})</span>`:''}`; },
    use:async()=>{ const st = C.e.ignite; C.e.ignite = 0; renderEnemyStatus();
      if(st>0){ await attack(st*5, true); } else { toast('점화가 없어 아무 일도 없었다'); } } },

  coldsnap:{ n:'한파', c:2, t:'skill', el:'ice', art:'snow',
    d:()=>`${KI('서리')} ${B(5)}`,
    use:async()=>{ await applyE('frost',5); } },

  forge:{ n:'대장간', c:2, t:'skill', el:'fire', art:'hammer',
    d:()=>`${KS('힘')} ${B(2)} 획득`,
    use:async()=>{ C.p.str += 2; renderPlayerStatus(); float('힘 +2','blk', heroRect()); } },

  firewall:{ n:'방화벽', c:2, t:'skill', el:'fire', art:'wall',
    d:()=>`${KB('방어도')} ${B(12)}. ${KF('점화')} ${B(3)}`,
    use:async()=>{ await gainBlock(12); await applyE('ignite',3); } },

  heavy:{ n:'묵직한 일격', c:2, t:'attack', el:null, art:'hammer',
    d:()=>`피해 ${B(pAtk(15))}`,
    use:async()=>{ await attack(15); } },

  ashstorm:{ n:'잿불 폭풍', c:3, t:'attack', el:'fire', art:'flame',
    d:()=>`피해 ${B(pAtk(16))}. ${KF('점화')} ${B(4)}`,
    use:async()=>{ await attack(16); await applyE('ignite',4); } },

  abszero:{ n:'절대영도', c:3, t:'skill', el:'ice', art:'snow',
    d:()=>`${KB('방어도')} ${B(16)}. ${KI('서리')} ${B(4)}`,
    use:async()=>{ await gainBlock(16); await applyE('frost',4); } },

  rekindle:{ n:'재점화', c:1, t:'skill', el:null, art:'heart',
    d:()=>`체력 ${B(6)} 회복`,
    use:async()=>{ heal(6); } },
};

const CARD_POOL_FIRE = ['ember_toss','sigil','detonate','forge','firewall','ashstorm','kindle'];
const CARD_POOL_ICE  = ['frost_shard','frost_ward','sleet','coldsnap','glacier','abszero'];
const CARD_POOL_NEU  = ['flurry','mark','regroup','heavy','rekindle'];

const TYPE_LABEL = { attack:'공격', skill:'술식' };
const CARD_SKIN = {
  attack:{ c1:'#3A2230', c2:'#191320', cb:'#5C3244', cg:'rgba(196,56,75,.35)', cg2:'rgba(196,56,75,.45)' },
  skill: { c1:'#1F2E3C', c2:'#131A25', cb:'#33506B', cg:'rgba(79,140,200,.3)',  cg2:'rgba(79,160,220,.42)' },
};
const EL_SKIN = {
  fire:{ cb:'#8A4021', cg:'rgba(240,86,45,.4)',  cg2:'rgba(240,86,45,.55)' },
  ice: { cb:'#2A6E8A', cg:'rgba(79,196,232,.36)', cg2:'rgba(79,196,232,.55)' },
};

/* ═══════════════════════════════════════════════════════════
   3. 시작 덱
   ═══════════════════════════════════════════════════════════ */
const STARTERS = [
  Object.assign({}, CHARS.ember, {
    cards:['strike','strike','strike','strike','defend','defend','defend','defend','ember_toss','sigil'] }),
  Object.assign({}, CHARS.frost, {
    cards:['strike','strike','strike','strike','defend','defend','defend','defend','frost_shard','frost_ward'] }),
  Object.assign({}, CHARS.ash, {
    cards:['strike','strike','strike','strike','defend','defend','defend','mark','ember_toss','frost_shard'] }),
];

/* ═══════════════════════════════════════════════════════════
   4. 적 데이터 — 패턴은 완전 결정론적
   ═══════════════════════════════════════════════════════════ */
const ENEMIES = {
  guardian:{ n:'잿더미 파수꾼', hp:46, art:'guardian', pattern:[
    { l:'내려찍기', atk:8 }, { l:'내려찍기', atk:8 }, { l:'옹벽', blk:7, atk:5 } ] },
  wolf:{ n:'서리 늑대', hp:42, art:'wolf', pattern:[
    { l:'연격', multi:[4,2] }, { l:'울부짖음', str:2, blk:4 }, { l:'물어뜯기', atk:9 } ] },
  wisp:{ n:'잿불 도깨비', hp:55, art:'wisp', pattern:[
    { l:'재의 숨결', atk:5, deb:{ weak:2 } }, { l:'불티 세례', atk:10 },
    { l:'움츠리기', blk:9 }, { l:'불티 세례', atk:10 } ] },
  warden:{ n:'균열의 감시자', hp:77, art:'warden', pattern:[
    { l:'가르기', atk:11 }, { l:'균열 응시', atk:6, deb:{ vuln:2 } }, { l:'봉인', blk:11, atk:7 } ] },
  guardian2:{ n:'무너진 파수꾼', hp:66, art:'guardian2', pattern:[
    { l:'분쇄', atk:10 }, { l:'옹벽', blk:9, atk:6 }, { l:'분쇄', atk:10 }, { l:'벼려내기', str:2, blk:6 } ] },
  warden2:{ n:'심연의 감시자', hp:95, art:'warden2', pattern:[
    { l:'심연 가르기', atk:13 }, { l:'공허 응시', atk:7, deb:{ vuln:2 } },
    { l:'봉인', blk:13, atk:8 }, { l:'벼려내기', str:3 } ] },
  boss:{ n:'말라붙은 심판자', hp:154, art:'boss', boss:true, pattern:[
    { l:'여명', str:1, blk:9 },
    { l:'열파', atk:10 },
    { l:'한파', atk:7, deb:{ weak:2 } },
    { l:'소멸', atk:14, big:true } ] },
};

/* ═══════════════════════════════════════════════════════════
   5. 포션
   ═══════════════════════════════════════════════════════════ */
const POTIONS = {
  p_heal:{ n:'재의 물약', d:'체력 10 회복', use:async()=>{ heal(10); } },
  p_fire:{ n:'불꽃 물약', d:'점화 5', use:async()=>{ await applyE('ignite',5); } },
  p_ice:{ n:'서리 물약', d:'서리 4', use:async()=>{ await applyE('frost',4); } },
  p_str:{ n:'강철 물약', d:'힘 3 획득', use:async()=>{ C.p.str+=3; renderPlayerStatus(); float('힘 +3','blk',heroRect()); } },
  p_energy:{ n:'각성 물약', d:'에너지 2, 카드 1장', use:async()=>{ C.energy+=2; draw(1); renderEnergy(); } },
};
const POTION_IDS = Object.keys(POTIONS);

/* ═══════════════════════════════════════════════════════════
   6. 지도 구성
   ═══════════════════════════════════════════════════════════ */
const MAP_LAYERS = [
  [ { t:'battle', e:'guardian', name:'무너진 계단' } ],
  [ { t:'battle', e:'wolf',   name:'서리 통로' },
    { t:'elite',  e:'warden',  name:'봉인된 문' } ],
  [ { t:'rest', name:'잿불 야영지' } ],
  [ { t:'battle', e:'wisp', name:'잿불 안뜰' } ],
  [ { t:'battle', e:'guardian2', name:'붕괴한 관측대' },
    { t:'elite',  e:'warden2',   name:'심연의 계단' } ],
  [ { t:'shop', name:'떠도는 세공사' } ],
  [ { t:'boss', e:'boss', name:'회랑의 끝' } ],
];
const NODE_ICON = { battle:'sword', elite:'skull', rest:'camp', shop:'shop', boss:'burst' };
const NODE_LABEL= { battle:'전투', elite:'정예', rest:'야영지', shop:'세공사', boss:'보스' };

/* ═══════════════════════════════════════════════════════════
   7. 전역 상태
   ═══════════════════════════════════════════════════════════ */
let G = null;   // 런 상태
let C = null;   // 전투 상태
let busy = false;
let t0 = 0;
let timerId = null;
const SID = (()=>{ const s='ACDEFHJKLMNPRTUVWXY3479'; let o=''; for(let i=0;i<4;i++) o += s[Math.floor(Math.random()*s.length)]; return o; })();

function newRun(){
  RNG.reset();
  shopStock = null; shopRemoved = false;
  removeMode = false; removeAfter = null; removeCtx = null;
  G = {
    hp:70, maxHp:70, gold:0,
    deck:[], potions:[null,null],
    layer:0, chosen:[], starter:null,
    fights:0, done:false,
    log:[], stats:{
      dmgDealt:0, dmgTaken:0, cardsPlayed:0, turns:0,
      shocks:0, firstShockFight:0, freezes:0,
      potionsUsed:0, potionsFound:0,
      elitesTaken:0, eliteOffers:0,
      firePicks:0, icePicks:0, neuPicks:0, skips:0,
      bossPatternSeen:0, bossBigBlocked:0, bossBigHits:0,
      cardsAdded:[], deckChoiceMs:0, branchMs:[],
      fightLog:[]
    }
  };
}

/* ── QA 로그 ── */
function ms(){ return t0 ? Date.now() - t0 : 0; }
function tstr(m){
  m = Math.max(0, m|0);
  const s = Math.floor(m/1000);
  return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
}
function log(ev, detail){
  if(!G) return;
  G.log.push({ t:ms(), ev, d:detail||'' });
}

/* ═══════════════════════════════════════════════════════════
   8. 카드 렌더링
   ═══════════════════════════════════════════════════════════ */
function costGem(el){
  if(el === 'fire') return `<svg viewBox="0 0 34 34" aria-hidden="true">
    <path d="M17 1.5 30 8.5v17L17 32.5 4 25.5v-17z" fill="#C33A18"/>
    <path d="M17 1.5 30 8.5v17L17 32.5 4 25.5v-17z" fill="none" stroke="#FFB27A" stroke-width="1.3"/>
    <path d="M17 6 24 12 17 28 10 12z" fill="#F0562D" opacity=".85"/></svg>`;
  if(el === 'ice') return `<svg viewBox="0 0 34 34" aria-hidden="true">
    <path d="M17 1.5 32 17 17 32.5 2 17z" fill="#1D6484"/>
    <path d="M17 1.5 32 17 17 32.5 2 17z" fill="none" stroke="#A8E6F8" stroke-width="1.3"/>
    <path d="M17 6 27 17 17 28 7 17z" fill="#4FC4E8" opacity=".8"/></svg>`;
  return `<svg viewBox="0 0 34 34" aria-hidden="true">
    <circle cx="17" cy="17" r="14.5" fill="#2C3348"/>
    <circle cx="17" cy="17" r="14.5" fill="none" stroke="#9AA3BE" stroke-width="1.3"/>
    <circle cx="17" cy="17" r="9" fill="#3E4864" opacity=".9"/></svg>`;
}

// 카드 상단 금속 리본
const RIBBON = `<svg class="rb" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
<defs><linearGradient id="rbg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#C9CEDC"/><stop offset="42%" stop-color="#8B93A6"/>
<stop offset="58%" stop-color="#6E7688"/><stop offset="100%" stop-color="#3E4557"/></linearGradient></defs>
<path d="M0 8 L18 2 L182 2 L200 8 L200 30 L182 38 L18 38 L0 30z" fill="url(#rbg)"/>
<path d="M0 8 L18 2 L182 2 L200 8" fill="none" stroke="#E4E8F2" stroke-width="1.4" opacity=".8"/>
<path d="M0 30 L18 38 L182 38 L200 30" fill="none" stroke="#2A2F3D" stroke-width="1.4"/>
<path d="M18 2 L22 38 M182 2 L178 38" stroke="#5A6274" stroke-width="1" opacity=".7"/></svg>`;

// 리본 양 끝의 접힌 자락
const RB_TAIL = `<svg class="rb-tail" viewBox="0 0 26 34" aria-hidden="true">
<path d="M26 2 L2 8 L2 26 L26 32z" fill="#4A5266"/>
<path d="M26 2 L2 8" fill="none" stroke="#7E8698" stroke-width="1.2"/></svg>`;

function costGem(el, cost){
  const p = el === 'fire'
    ? { a:'#F0562D', b:'#8A2A0E', s:'#FFC08A', d:'M20 2 L34 10 L38 26 L20 38 L2 26 L6 10z' }
    : el === 'ice'
    ? { a:'#4FC4E8', b:'#155C78', s:'#BEEEFF', d:'M20 1 L38 20 L20 39 L2 20z' }
    : { a:'#8E96AE', b:'#3A4054', s:'#DDE3F2', d:'M20 2 A18 18 0 1 1 19.9 2z' };
  return `<svg viewBox="0 0 40 40" aria-hidden="true">
    <defs><radialGradient id="cg${el||'n'}" cx=".38" cy=".3">
      <stop offset="0%" stop-color="${p.s}"/><stop offset="52%" stop-color="${p.a}"/>
      <stop offset="100%" stop-color="${p.b}"/></radialGradient></defs>
    <path d="${p.d}" fill="url(#cg${el||'n'})" stroke="#EDEFF6" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="${p.d}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1" transform="scale(.86) translate(3.2 3.2)"/></svg>`;
}

function cardHTML(id, opts){
  opts = opts || {};
  const c = CARDS[id];
  const cls = [
    'card', 't-' + c.t,
    c.el ? 'el-' + c.el : '',
    c.basic ? 'basic' : '',
    opts.cls || ''
  ].filter(Boolean).join(' ');
  const tag = TYPE_LABEL[c.t];
  const elTag = c.el === 'fire' ? '불' : c.el === 'ice' ? '서리' : '';
  return `<div class="${cls}" data-card="${id}" ${opts.attrs || ''}>
    <div class="card-inner">
      <div class="card-art"><svg viewBox="0 0 100 100" fill="none" aria-hidden="true">${CA[id] || ''}</svg></div>
      <div class="card-body"><span>${c.d()}</span></div>
      <div class="card-frame"></div>
      <div class="sheen"></div>
    </div>
    <div class="card-ribbon">${RB_TAIL}${RIBBON}${RB_TAIL}<span>${esc(c.n)}</span></div>
    <div class="card-tab">${tag}${elTag ? `<i>${elTag}</i>` : ''}</div>
    <div class="card-cost">${costGem(c.el, c.c)}<b>${c.c}</b></div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   9. 화면 전환
   ═══════════════════════════════════════════════════════════ */
function show(id){
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  document.body.classList.toggle('in-combat', id === 'combat-screen');
}
function ov(id, on){ $('#'+id).classList.toggle('on', !!on); }
function closeAllOv(){ $$('.overlay').forEach(o => o.classList.remove('on')); }

let phaseTimer = null;
function setPhase(who){
  const ar = $('#arena'); if(!ar) return;
  ar.classList.toggle('foe', who === 'foe');
  const el = $('#phase'); if(!el || !C) return;
  el.innerHTML = `<span class="pd"></span><span class="pn">${who === 'foe' ? '적의 턴' : '내 턴'}</span>` +
    `<span class="pt">${C.turn}턴</span>`;
}
function phaseSweep(text, color){
  const a = $('#arena'); if(!a) return;
  const d = document.createElement('div');
  d.className = 'phase-sweep';
  d.style.setProperty('--pcol', color);
  d.innerHTML = `<span>${esc(text)}</span>`;
  a.appendChild(d);
  setTimeout(()=> d.remove(), 1200);
}

function toast(msg){
  const host = $('#toast-host');
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = msg;
  host.appendChild(d);
  setTimeout(()=> d.remove(), 2400);
}

/* ═══════════════════════════════════════════════════════════
   10. QA 스트립
   ═══════════════════════════════════════════════════════════ */
function renderTopHUD(){
  if(!G) return;
  const nm = $('#topbar .tb-id b');
  if(nm && G.starter && CHARS[G.starter]) nm.textContent = CHARS[G.starter].name;
  const hp = $('#tb-hp'), fill = $('#tb-hpfill'), gold = $('#tb-gold'),
        fl = $('#tb-floor'), dn = $('#tb-decknum');
  if(hp) hp.textContent = `${G.hp}/${G.maxHp}`;
  if(fill) fill.style.width = (G.hp / G.maxHp * 100) + '%';
  if(gold) gold.textContent = G.gold;
  if(fl) fl.textContent = `${Math.min(G.layer + 1, MAP_LAYERS.length)}/${MAP_LAYERS.length}`;
  if(dn) dn.textContent = G.deck.length;
  renderPotions();
}

function updateQA(){
  $('#qa-time').textContent = tstr(ms());
  $('#qa-seed').textContent = SEED;
  $('#qa-sid').textContent  = SID;
  if(!G){ return; }
  const lay = MAP_LAYERS[G.layer];
  $('#qa-node').textContent = C ? (C.name||'전투') : (G.layer >= MAP_LAYERS.length ? '종료' : (lay ? `${G.layer+1}/${MAP_LAYERS.length}` : '—'));
  $('#qa-fight').textContent = G.fights;
  $('#qa-turn').textContent = C ? C.turn : '—';
}

/* ═══════════════════════════════════════════════════════════
   11. 전투 — 시작
   ═══════════════════════════════════════════════════════════ */
function startCombat(enemyId, nodeName, isElite, isBoss){
  const E = ENEMIES[enemyId];
  G.fights++;
  C = {
    id:enemyId, name:nodeName, elite:!!isElite, boss:!!isBoss,
    turn:0, energy:3, maxEnergy:3,
    hand:[], draw:[], discard:[],
    p:{ block:0, str:0, weak:0, vuln:0 },
    e:{ hp:E.hp, maxHp:E.hp, block:0, str:0, weak:0, vuln:0, ignite:0, frost:0, frozen:false, pi:0 },
    startedAt: ms(),
    fightNo: G.fights,
    potionUsedThisFight:0,
    shockThisFight:0,
    over:false
  };
  C.draw = shuffle(G.deck.slice());
  // 캐릭터 특전
  if(G.starter === 'frost') C.p.block = 5;
  if(G.starter === 'ember') C.e.ignite = 2;
  C.bonusDraw = (G.starter === 'ash') ? 1 : 0;
  log('FIGHT_START', `${G.fights}·${E.n}`);

  $('#enemy').classList.remove('dying');
  $('#enemy-name').textContent = E.n;
  const eImg = ENEMY_ART[E.art];
  $('#enemy-art').classList.toggle('is-photo', !!eImg);
  $('#enemy-art').innerHTML = (eImg
      ? `<div class="photo-wrap"><img class="enemy-photo" src="${eImg}" alt="${esc(E.n)}"></div>`
      : ART[E.art]) +
    `<div class="unit-shadow"></div><div class="hitflash" id="eflash"></div>`;
  $('#hero-art').innerHTML = (HEROES[G.starter] || HEROES.ash) +
    `<div class="unit-shadow"></div><div id="blockbadge" class="blockbadge" style="display:none"></div>`;
  const hn = $('#hero-unit .unit-name');
  if(hn) hn.textContent = (CHARS[G.starter] || CHARS.ash).name;
  applyScene(enemyId);

  show('combat-screen');
  closeAllOv();
  $('#arena').classList.remove('foe');
  renderAll();
  setIntent();
  renderIntent();
  banner(E.n, isBoss ? '회랑의 끝' : (isElite ? '정예' : `전투 ${G.fights}`), 'turn');
  busy = true;
  setTimeout(()=>{ busy = false; startPlayerTurn(true); }, 700);
}

/* ── 의도 ── */
function setIntent(){
  const E = ENEMIES[C.id];
  C.e.act = E.pattern[C.e.pi % E.pattern.length];
}
function enemyAtkVal(base){
  let d = base + C.e.str;
  if(C.e.weak > 0) d = Math.floor(d * 0.75);
  return Math.max(0, d);
}
function renderIntent(){
  const el = $('#intent');
  if(!C || C.over){ el.innerHTML=''; el.className='intent'; return; }
  const a = C.e.act;
  if(C.e.frozen){
    el.className = 'intent';
    el.innerHTML = `<span style="color:#BEEEFF">${ico('snow')}</span><span class="nm" style="border:none;padding-left:0;color:#BEEEFF">빙결 — 행동 불가</span>`;
    return;
  }
  let cls = 'intent', html = '';
  if(a.atk !== undefined || a.multi){
    cls += ' atk';
    if(a.big) cls += ' big';
    const base = a.multi ? a.multi[0] : a.atk;
    const cnt  = a.multi ? a.multi[1] : 1;
    const v = enemyAtkVal(base);
    html += `<span style="color:#FF7C97">${ico('sword')}</span><b>${v}</b>` + (cnt>1 ? `<span class="x">×${cnt}</span>` : '');
  }
  if(a.blk !== undefined){
    html += `<span style="color:#9CC4E8">${ico('shield')}</span><b>${a.blk}</b>`;
  }
  if(a.str !== undefined){
    html += `<span style="color:#F2CE7C">${ico('up')}</span>`;
  }
  if(a.deb){
    html += `<span style="color:#B79BE0">${ico('down')}</span>`;
  }
  html += `<span class="nm">${esc(a.l)}</span>`;
  const changed = el.dataset.sig !== cls + html;
  el.className = cls;
  el.innerHTML = html;
  el.dataset.sig = cls + html;
  if(changed && !RM()){
    el.animate([{ transform:'scale(.62) translateY(-10px)', opacity:0 },
                { transform:'scale(1.12)', opacity:1, offset:.6 },
                { transform:'scale(1)', opacity:1 }],
      { duration:340, easing:'cubic-bezier(.34,1.4,.64,1)' });
  }
}

/* ═══════════════════════════════════════════════════════════
   12. 전투 — 렌더
   ═══════════════════════════════════════════════════════════ */
function renderAll(){
  renderHP(); renderEnergy(); renderPiles(); renderHand();
  renderEnemyStatus(); renderPlayerStatus();
  renderTopHUD(); updateQA();
}
function renderHP(){
  renderTopHUD();
  if(C && !drag) clearPreviewSafe();
  if(C){
    const ep = C.e.hp / C.e.maxHp;
    $('#ehp-fill').style.transform  = `scaleX(${ep})`;
    $('#ehp-ghost').style.transform = `scaleX(${ep})`;
    $('#ehp-txt').textContent = `${C.e.hp} / ${C.e.maxHp}`;
  }
  const pp = G.hp / G.maxHp;
  $('#php-fill').style.transform  = `scaleX(${pp})`;
  $('#php-ghost').style.transform = `scaleX(${pp})`;
  $('#php-txt').textContent = `${G.hp} / ${G.maxHp}`;
}
function renderEnergy(){
  $('#energy-n').textContent = C ? C.energy : 0;
  $('#energy-max').textContent = '/' + (C ? C.maxEnergy : 3);
  $('#energy').classList.toggle('low', !!C && C.energy === 0);
}
function renderPiles(){
  $('#draw-n').textContent = C ? C.draw.length : 0;
  $('#discard-n').textContent = C ? C.discard.length : 0;
}
function stChip(cls, iconKey, label, val){
  return `<span class="st st-${cls}" data-st="${cls}">${ico(iconKey)}${esc(label)} ${val}</span>`;
}
function renderEnemyStatus(){
  if(!C) return;
  const e = C.e; let h = '';
  setBarrier('#enemy-art', e.block > 0, '#E8A0A8');
  if(e.block > 0)  h += stChip('block','shield','방어', e.block);
  if(e.frozen)     h += stChip('frozen','snow','빙결','');
  if(e.ignite > 0) h += stChip('ignite','flame','점화', e.ignite);
  if(e.frost > 0)  h += stChip('frost','snow','서리', e.frost);
  if(e.vuln > 0)   h += stChip('vuln','eye','취약', e.vuln);
  if(e.weak > 0)   h += stChip('weak','down','약화', e.weak);
  if(e.str > 0)    h += stChip('str','up','힘', e.str);
  $('#enemy-st').innerHTML = h;
}
function renderPlayerStatus(){
  if(!C){ $('#player-st').innerHTML=''; $('#blockbadge').innerHTML=''; return; }
  const p = C.p; let h = '';
  if(p.vuln > 0) h += stChip('vuln','eye','취약', p.vuln);
  if(p.weak > 0) h += stChip('weak','down','약화', p.weak);
  if(p.str > 0)  h += stChip('str','up','힘', p.str);
  $('#player-st').innerHTML = h;
  setBarrier('#hero-art', p.block > 0, '#9CC4E8');
  const bb = $('#blockbadge');
  if(bb){
    if(p.block > 0){
      bb.style.display = 'grid';
      bb.innerHTML = `<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 2 32 7v10c0 8-5.6 14.4-14 17-8.4-2.6-14-9-14-17V7L18 2z" fill="#16283C" stroke="currentColor" stroke-width="2"/></svg><b>${p.block}</b>`;
    } else { bb.style.display = 'none'; bb.innerHTML = ''; }
  }
}
function renderPotions(){
  const h = G.potions.map((pid, i) => {
    if(!pid) return `<div class="potion empty" title="빈 자리"></div>`;
    const p = POTIONS[pid], col = POTION_ART[pid];
    return `<div class="potion filled" style="--pc:${col}" data-potion="${i}" data-tipname="${esc(p.n)}" data-tipdesc="${esc(p.d)}">${potionSvg(col)}</div>`;
  }).join('');
  $('#potions').innerHTML = h;
}

function renderHand(){
  const host = $('#hand');
  const n = C.hand.length;
  host.innerHTML = C.hand.map((id, i) => {
    const c = CARDS[id];
    const ok = C.energy >= c.c;
    return cardHTML(id, { cls:`inhand ${ok?'playable':'locked'}`, attrs:`data-i="${i}" style="z-index:${10+i}"` });
  }).join('');
  // 부채꼴 배치
  const cards = $$('.card', host);
  const w = host.clientWidth || 900;
  const cardW = (cards[0] && cards[0].offsetWidth) || 158;
  const cardH = (cards[0] && cards[0].offsetHeight) || 216;
  const mid = (n - 1) / 2;
  // 회전 기준점이 카드 아래쪽(center 130%)이라, 기울일수록 좌우로 더 벌어진다.
  // 그 여유분까지 계산해서 간격을 정해야 화면 밖으로 밀리지 않는다.
  const rotStep = n > 1 ? Math.min(w < 560 ? 4 : 5.5, 26 / n) : 0;
  const swing = Math.sin(mid * rotStep * Math.PI / 180) * cardH * 0.8;
  // 리본과 비용 보석이 카드 밖으로 돌출하므로 여유를 더 둔다
  const room  = w / 2 - 22 - cardW / 2 - swing;
  const gap = n > 1 ? Math.max(20, Math.min(cardW * 0.82, room / Math.max(.5, mid))) : 0;
  cards.forEach((el, i) => {
    const off = i - mid;
    const rot = off * rotStep;
    const x   = off * gap;
    const y   = Math.pow(Math.abs(off), 2) * (n > 4 ? 2.4 : 1.6);
    el.style.setProperty('--tx', x.toFixed(1) + 'px');
    el.style.setProperty('--ty', y.toFixed(1) + 'px');
    el.style.setProperty('--rot', rot.toFixed(2) + 'deg');
    el.style.zIndex = String(10 + i);
  });

  cards.forEach(el => el.style.setProperty('--ex', '0px'));
  // 새로 뽑힌 카드는 뽑을 패 더미에서 날아온다
  const dealt = C.dealt || 0;
  if(dealt > 0 && !RM()){
    const pile = $('#pile-draw');
    const hb = host.getBoundingClientRect();
    let from = { x:-hb.width/2 + 40, y:140 };
    if(pile){
      const pb = pile.getBoundingClientRect();
      from = { x: pb.left + pb.width/2 - (hb.left + hb.width/2), y: pb.top - hb.top - hb.height + 60 };
    }
    cards.slice(-dealt).forEach((el, k) => {
      el.animate([
        { transform:`translate(${from.x}px, ${from.y}px) rotate(-40deg) scale(.4)`, opacity:0 },
        { transform:`translate(${from.x*.3}px, ${from.y*.35}px) rotate(-14deg) scale(.86)`, opacity:1, offset:.55 },
        { transform:'none', opacity:1 }
      ], { duration:400, delay:k * 72, easing:'cubic-bezier(.2,.75,.3,1)', composite:'add' });
    });
    C.dealt = 0;
  }
}

/* ═══════════════════════════════════════════════════════════
   13. 이펙트
   ═══════════════════════════════════════════════════════════ */
function rectOf(sel, fx, fy){
  const el = $(sel), a = $('#arena');
  if(!el || !a) return { x:120, y:200 };
  const r = el.getBoundingClientRect(), b = a.getBoundingClientRect();
  return { x: r.left - b.left + r.width * (fx==null?.5:fx),
           y: r.top  - b.top  + r.height * (fy==null?.5:fy) };
}
function enemyRect(){ return rectOf('#enemy-art', .5, .46); }
function heroRect(){  return rectOf('#hero-art',  .5, .42); }
function float(txt, cls, pos){
  const a = $('#arena'); if(!a) return;
  const d = document.createElement('div');
  d.className = 'float ' + (cls||'dmg');
  d.textContent = txt;
  d.style.left = (pos.x + (Math.random()*30-15)) + 'px';
  d.style.top  = (pos.y - 24) + 'px';
  a.appendChild(d);
  setTimeout(()=> d.remove(), 1100);
}
function banner(main, sub, cls){
  const a = $('#arena'); if(!a) return;
  const d = document.createElement('div');
  d.className = 'banner ' + (cls||'');
  d.innerHTML = `<div class="bt">${esc(main)}</div>${sub?`<div class="bs">${esc(sub)}</div>`:''}`;
  a.appendChild(d);
  setTimeout(()=> d.remove(), 1550);
}
function shake(){
  const a = $('#arena'); if(!a) return;
  a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
  setTimeout(()=> a.classList.remove('shake'), 360);
}
function pulseClass(el, cls, ms){
  if(!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(()=> el.classList.remove(cls), ms);
}
function flashEnemy(){
  pulseClass($('#eflash'), 'go', 320);
  pulseClass($('#enemy'), 'hurt', 350);
}
function flashHero(){
  pulseClass($('#hero-unit'), 'hurt', 350);
}
function lungeHero(){ pulseClass($('#hero-art'), 'lunge-r', 450); }
function lungeEnemy(){ pulseClass($('#enemy-art'), 'lunge-l', 450); }
function slashAt(pos, kind){
  const a = $('#arena'); if(!a) return;
  const d = document.createElement('div');
  d.className = 'slash';
  d.style.left = pos.x + 'px'; d.style.top = pos.y + 'px';
  d.innerHTML = SLASH_SVG[kind || 'cut'];
  a.appendChild(d);
  setTimeout(()=> d.remove(), 460);
}
function shockRing(){
  const a = $('#arena'); if(!a) return;
  const p = enemyRect();
  for(let i = 0; i < 2; i++){
    const d = document.createElement('div');
    d.className = 'shockring';
    d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
    d.style.animationDelay = (i * 130) + 'ms';
    if(i) d.style.borderColor = 'rgba(180,235,255,.85)';
    a.appendChild(d);
    setTimeout(()=> d.remove(), 1100);
  }
}

/* ═══════════════════════════════════════════════════════════
   전투 이펙트 — 투사체 / 착탄 / 자기강화
   ═══════════════════════════════════════════════════════════ */
const RM = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function vfxHost(){ return $('#arena'); }
function spawnFX(cls, html, x, y, w, h, z){
  const a = vfxHost(); if(!a) return null;
  const d = document.createElement('div');
  d.className = 'vfx ' + (cls || '');
  d.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;` +
    `margin:${-h/2}px 0 0 ${-w/2}px;z-index:${z || 150}`;
  d.innerHTML = html || '';
  a.appendChild(d);
  return d;
}
function fxAnim(el, frames, dur, ease, delay){
  if(!el) return Promise.resolve();
  const a = el.animate(frames, { duration:dur, easing:ease || 'cubic-bezier(.22,.61,.36,1)',
    delay:delay || 0, fill:'forwards' });
  return a.finished.catch(()=>{});
}

/* ── 투사체 도안 ── */
const PROJ = {
  fireball:{ w:132,h:132,spin:0,arc:74,dur:720,col:'#FF8B3D',
    svg:`<svg viewBox="0 0 132 132"><defs>
      <radialGradient id="fb1"><stop offset="0%" stop-color="#FFFDF4"/><stop offset="26%" stop-color="#FFE08A"/>
      <stop offset="58%" stop-color="#FF7A2E"/><stop offset="86%" stop-color="#D62F0C"/><stop offset="100%" stop-color="#D62F0C" stop-opacity="0"/></radialGradient></defs>
      <g class="fx-spin">
        <path d="M66 8c9 24-12 32-22 48-8 13-13 23-13 33 0 19 16 33 35 33s35-14 35-33c0-17-13-26-21-40-8-13-12-22-14-41z" fill="#FF6A20" opacity=".55"/>
        <path d="M66 22c-14 22-26 30-26 48 0 15 12 26 26 26s26-11 26-26c0-18-12-26-26-48z" fill="#FF9440" opacity=".7"/>
      </g>
      <circle cx="66" cy="66" r="44" fill="url(#fb1)"/>
      <circle cx="66" cy="66" r="20" fill="#FFF6DC"/>
      <circle cx="66" cy="66" r="44" fill="none" stroke="#FFD9A8" stroke-width="2" opacity=".7"/></svg>`},

  iceshard:{ w:126,h:126,spin:400,arc:34,dur:660,col:'#7FD8F2',
    svg:`<svg viewBox="0 0 126 126"><defs>
      <linearGradient id="is1" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="42%" stop-color="#9CE6FA"/>
      <stop offset="78%" stop-color="#39A9CE"/><stop offset="100%" stop-color="#12566E"/></linearGradient></defs>
      <circle cx="63" cy="63" r="46" fill="#4FC4E8" opacity=".16"/>
      <path d="M63 6 L92 46 L63 120 L34 46z" fill="url(#is1)" stroke="#EAFBFF" stroke-width="3" stroke-linejoin="round"/>
      <path d="M63 6 L63 120" stroke="#fff" stroke-width="2" opacity=".8"/>
      <path d="M63 22 L80 48 L63 96 L46 48z" fill="#fff" opacity=".38"/>
      <path d="M34 46 L92 46" stroke="#DFF6FF" stroke-width="2" opacity=".65"/>
      <g stroke="#BEEEFF" stroke-width="2.5" stroke-linecap="round" opacity=".9">
        <path d="M92 46 L112 34M34 46 L14 34M63 120 L63 126"/></g></svg>`},

  bolt:{ w:150,h:150,spin:0,arc:0,dur:520,col:'#D9B8FF',
    svg:`<svg viewBox="0 0 150 150"><defs><linearGradient id="bl1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="50%" stop-color="#E0CBFF"/><stop offset="100%" stop-color="#9B5BE0"/></linearGradient></defs>
      <ellipse cx="75" cy="75" rx="56" ry="30" fill="#9B5BE0" opacity=".2"/>
      <path d="M92 10 L40 72h28L58 140 L112 66H82z" fill="url(#bl1)" stroke="#C9A6FF" stroke-width="4" stroke-linejoin="round"/>
      <path d="M88 26 L56 68h20L68 116" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>
      <g stroke="#E0CBFF" stroke-width="2.5" stroke-linecap="round" opacity=".75" class="fx-flick">
        <path d="M28 40 L44 52M124 96 L108 86M34 110 L50 100"/></g></svg>`},

  hex:{ w:136,h:136,spin:200,arc:0,dur:600,col:'#FF7C97',
    svg:`<svg viewBox="0 0 136 136">
      <circle cx="68" cy="68" r="52" fill="#C4384B" opacity=".16"/>
      <circle cx="68" cy="68" r="46" fill="none" stroke="#FF7C97" stroke-width="4"/>
      <circle cx="68" cy="68" r="32" fill="none" stroke="#FFC2CE" stroke-width="2.5" stroke-dasharray="7 8"/>
      <path d="M68 18 L112 68 L68 118 L24 68z" fill="none" stroke="#FF9FB2" stroke-width="3"/>
      <path d="M68 34 L96 68 L68 102 L40 68z" fill="#2A0F16" opacity=".55"/>
      <circle cx="68" cy="68" r="13" fill="#FF7C97" opacity=".6"/>
      <circle cx="68" cy="68" r="6" fill="#FFE6EB"/></svg>`},

  orb:{ w:120,h:120,spin:0,arc:52,dur:640,col:'#C9CDDC',
    svg:`<svg viewBox="0 0 120 120"><defs><radialGradient id="ob1">
      <stop offset="0%" stop-color="#fff"/><stop offset="40%" stop-color="#DCE2F2"/>
      <stop offset="72%" stop-color="#98A2C0"/><stop offset="100%" stop-color="#98A2C0" stop-opacity="0"/></radialGradient></defs>
      <circle cx="60" cy="60" r="50" fill="url(#ob1)"/>
      <circle cx="60" cy="60" r="22" fill="#fff"/>
      <circle cx="60" cy="60" r="38" fill="none" stroke="#E8ECF8" stroke-width="2" opacity=".7"/></svg>`},

  voidbeam:{ w:140,h:140,spin:0,arc:0,dur:600,col:'#B482F0',
    svg:`<svg viewBox="0 0 140 140"><defs><radialGradient id="vb1">
      <stop offset="0%" stop-color="#F4EAFF"/><stop offset="38%" stop-color="#B482F0"/>
      <stop offset="76%" stop-color="#5A2A90"/><stop offset="100%" stop-color="#5A2A90" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="70" cy="70" rx="62" ry="26" fill="url(#vb1)"/>
      <ellipse cx="70" cy="70" rx="34" ry="12" fill="#F4EAFF"/>
      <g class="fx-spin"><ellipse cx="70" cy="70" rx="50" ry="50" fill="none" stroke="#B482F0" stroke-width="2" stroke-dasharray="8 14" opacity=".7"/></g></svg>`},
};

/* ── 꼬리 입자 ── */
function trail(kind, from, to, dur, arc){
  if(RM()) return;
  const spec = PROJ[kind]; if(!spec) return;
  const n = 20;
  for(let i = 0; i < n; i++){
    const t = (i + 1) / (n + 1);
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * (arc || 0);
    const sz = 7 + Math.random() * 14;
    const d = spawnFX('vfx-dot', '', x + (Math.random()*16-8), y + (Math.random()*16-8), sz, sz, 149);
    if(!d) return;
    d.style.background = spec.col;
    d.style.boxShadow = `0 0 ${sz*2.4}px ${spec.col}`;
    fxAnim(d, [{ opacity:.9, transform:'scale(1)' },
               { opacity:0, transform:`translate(${Math.random()*26-13}px,${Math.random()*22-4}px) scale(.2)` }],
      560 + Math.random()*300, 'ease-out', dur * t * .80).then(()=> d.remove());
  }
}

/* ── 착탄 ── */
function impact(kind, at){
  const a = vfxHost(); if(!a) return;
  const P = {
    fireball:{ col:'#FF8B3D', col2:'#FFE0B8', n:24, ring:'rgba(255,190,120,.95)', sz:190 },
    iceshard:{ col:'#7FD8F2', col2:'#EAFBFF', n:22, ring:'rgba(190,238,255,.95)', sz:178 },
    bolt:{ col:'#C9A6FF', col2:'#F2E6FF', n:20, ring:'rgba(200,170,255,.95)', sz:200 },
    hex:{ col:'#FF7C97', col2:'#FFD6DE', n:16, ring:'rgba(255,150,175,.9)', sz:160 },
    slash:{ col:'#FFD9E0', col2:'#fff', n:10, ring:'rgba(255,220,225,.85)', sz:100 },
    orb:{ col:'#C9CDDC', col2:'#fff', n:10, ring:'rgba(220,225,240,.85)', sz:100 },
    voidbeam:{ col:'#B482F0', col2:'#E4D2FF', n:20, ring:'rgba(180,130,240,.9)', sz:186 },
  }[kind] || { col:'#FFD9E0', col2:'#fff', n:10, ring:'rgba(255,255,255,.8)', sz:100 };

  // 확산 링
  const r = spawnFX('vfx-ring', '', at.x, at.y, P.sz, P.sz, 152);
  if(r){ r.style.borderColor = P.ring;
    fxAnim(r, [{ transform:'scale(.16)', opacity:1, borderWidth:'4px' },
               { transform:'scale(1.5)', opacity:0, borderWidth:'1px' }], 480, 'ease-out').then(()=> r.remove()); }
  // 섬광
  const f = spawnFX('vfx-flash', '', at.x, at.y, P.sz*1.5, P.sz*1.5, 151);
  if(f){ f.style.background = `radial-gradient(circle, ${P.col2}, ${P.col} 38%, transparent 68%)`;
    fxAnim(f, [{ opacity:.95, transform:'scale(.5)' }, { opacity:0, transform:'scale(1.25)' }], 320, 'ease-out').then(()=> f.remove()); }
  if(RM()) return;
  // 파편
  for(let i = 0; i < P.n; i++){
    const ang = (Math.PI * 2 * i) / P.n + Math.random() * .5;
    const dist = 60 + Math.random() * 112;
    const sz = 6 + Math.random() * 12;
    const d = spawnFX('vfx-dot', '', at.x, at.y, sz, sz, 153);
    if(!d) continue;
    const c = Math.random() > .5 ? P.col : P.col2;
    d.style.background = c; d.style.boxShadow = `0 0 ${sz*2.6}px ${c}`;
    fxAnim(d, [{ transform:'translate(0,0) scale(1)', opacity:1 },
      { transform:`translate(${Math.cos(ang)*dist}px,${Math.sin(ang)*dist + 40}px) scale(.15)`, opacity:0 }],
      620 + Math.random()*380, 'cubic-bezier(.2,.7,.3,1)').then(()=> d.remove());
  }
}

/* ── 투사체 발사 ── */
// 시전자 앞에서 기운이 뭉쳤다가 날아간다
async function charge(kind, at){
  const spec = PROJ[kind]; if(!spec || RM()) return;
  const c = spawnFX('vfx-charge', spec.svg, at.x + 34, at.y - 6, spec.w, spec.h, 149);
  if(!c) return;
  // 모여드는 입자
  for(let i = 0; i < 9; i++){
    const ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 60;
    const sz = 5 + Math.random() * 8;
    const d = spawnFX('vfx-dot', '', at.x + 34 + Math.cos(ang)*dist, at.y - 6 + Math.sin(ang)*dist, sz, sz, 148);
    if(!d) continue;
    d.style.background = spec.col; d.style.boxShadow = `0 0 ${sz*3}px ${spec.col}`;
    fxAnim(d, [{ transform:'translate(0,0)', opacity:0 },
      { transform:`translate(${-Math.cos(ang)*dist*.5}px,${-Math.sin(ang)*dist*.5}px)`, opacity:1, offset:.5 },
      { transform:`translate(${-Math.cos(ang)*dist}px,${-Math.sin(ang)*dist}px)`, opacity:0 }],
      300, 'ease-in', Math.random()*90).then(()=> d.remove());
  }
  await fxAnim(c, [
    { transform:'scale(.1)', opacity:0 },
    { transform:'scale(.62)', opacity:1, offset:.65 },
    { transform:'scale(.5)', opacity:1 }
  ], 300, 'cubic-bezier(.2,.8,.3,1)');
  if(c) c.remove();
}

async function fire(kind, from, to){
  const spec = PROJ[kind];
  if(!spec){ impact(kind, to); return; }
  await charge(kind, from);
  const dur = RM() ? 60 : spec.dur;
  const d = spawnFX('vfx-proj', spec.svg, from.x + 34, from.y - 6, spec.w, spec.h, 150);
  const dx = to.x - (from.x + 34), dy = to.y - (from.y - 6);
  trail(kind, { x:from.x + 34, y:from.y - 6 }, to, dur, spec.arc);
  await fxAnim(d, [
    { transform:'translate(0,0) rotate(0deg) scale(.5)', opacity:0 },
    { transform:`translate(${dx*.10}px,${dy*.10 - spec.arc*.6}px) rotate(${spec.spin*.10}deg) scale(.9)`, opacity:1, offset:.12 },
    { transform:`translate(${dx*.55}px,${dy*.55 - spec.arc}px) rotate(${spec.spin*.55}deg) scale(1.1)`, opacity:1, offset:.6 },
    { transform:`translate(${dx}px,${dy}px) rotate(${spec.spin}deg) scale(1.3)`, opacity:1 }
  ], dur, 'cubic-bezier(.25,.35,.55,1)');
  if(d) d.remove();
  impact(kind, to);
}

/* ── 베기 ── */
async function slashFX(at, tint){
  const col = tint || '#FFE8EC';
  const d = spawnFX('vfx-slash', `<svg viewBox="0 0 120 120">
    <path d="M14 92 C42 66 70 42 108 22" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"/>
    <path d="M22 104 C50 78 76 56 114 38" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>`,
    at.x, at.y, 150, 150, 152);
  impact('slash', at);
  await fxAnim(d, [
    { opacity:0, transform:'scale(.5) rotate(-28deg)' },
    { opacity:1, transform:'scale(1.05) rotate(-6deg)', offset:.3 },
    { opacity:0, transform:'scale(1.3) rotate(8deg)' }
  ], 300, 'ease-out');
  if(d) d.remove();
}

/* ── 자기 강화 (방어·힘·회복·드로우) ── */
function selfFX(kind, at){
  const P = {
    guard:{ col:'#9CC4E8', ring:'rgba(150,200,240,.9)' },
    buff:{ col:'#F2CE7C', ring:'rgba(242,206,124,.9)' },
    heal:{ col:'#6FD69C', ring:'rgba(111,214,156,.9)' },
    draw:{ col:'#AEB6D0', ring:'rgba(200,208,230,.85)' },
  }[kind] || { col:'#9CC4E8', ring:'rgba(150,200,240,.9)' };
  const r = spawnFX('vfx-ring', '', at.x, at.y + 12, 130, 130, 149);
  if(r){ r.style.borderColor = P.ring;
    fxAnim(r, [{ transform:'scale(1.3)', opacity:0 }, { transform:'scale(.55)', opacity:.95, offset:.55 },
               { transform:'scale(.5)', opacity:0 }], 620, 'ease-out').then(()=> r.remove()); }
  if(RM()) return;
  for(let i = 0; i < 12; i++){
    const sz = 3 + Math.random()*7;
    const ox = (Math.random()*84 - 42);
    const d = spawnFX('vfx-dot', '', at.x + ox, at.y + 54, sz, sz, 150);
    if(!d) continue;
    d.style.background = P.col; d.style.boxShadow = `0 0 ${sz*3}px ${P.col}`;
    fxAnim(d, [{ transform:'translateY(0)', opacity:0 },
      { transform:'translateY(-30px)', opacity:1, offset:.3 },
      { transform:`translateY(-${80 + Math.random()*50}px)`, opacity:0 }],
      700 + Math.random()*400, 'ease-out', Math.random()*180).then(()=> d.remove());
  }
}

/* ═══ 방어도: 전개 / 유지 / 피격 / 파괴 ═══ */
const BARRIER_SVG = `<svg viewBox="0 0 200 240" aria-hidden="true">
<defs><linearGradient id="bar1" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#BFE0FF" stop-opacity=".55"/>
<stop offset="55%" stop-color="#6FA8DC" stop-opacity=".22"/>
<stop offset="100%" stop-color="#3A6FA0" stop-opacity=".38"/></linearGradient></defs>
<path d="M100 6 L188 44 v92c0 56-38 88-88 102C50 224 12 192 12 136V44z"
  fill="url(#bar1)" stroke="var(--bc,#9CC4E8)" stroke-width="2.5"/>
<path d="M100 6 L188 44 v92c0 56-38 88-88 102C50 224 12 192 12 136V44z"
  fill="none" stroke="#EAF4FF" stroke-width="1" opacity=".55"/>
<g stroke="var(--bc,#9CC4E8)" stroke-width="1.1" opacity=".42" fill="none">
<path d="M100 6v230M12 100h176M12 160h176M40 24 L160 216M160 24 L40 216"/></g>
<g class="fx-shimmer" opacity=".5">
<path d="M12 150 L188 60" stroke="#EAF4FF" stroke-width="14" opacity=".18"/></g></svg>`;

function setBarrier(sel, on, col){
  const host = $(sel); if(!host) return;
  let b = host.querySelector('.barrier');
  if(on){
    if(b && !b.classList.contains('gone')) return;
    if(b) b.remove();
    b = document.createElement('div');
    b.className = 'barrier';
    b.style.setProperty('--bc', col || '#9CC4E8');
    b.innerHTML = BARRIER_SVG;
    host.appendChild(b);
    b.animate([
      { opacity:0, transform:'scale(.55) rotateY(60deg)' },
      { opacity:1, transform:'scale(1.1) rotateY(0deg)', offset:.55 },
      { opacity:1, transform:'scale(1)' }
    ], { duration:420, easing:'cubic-bezier(.34,1.4,.64,1)', composite:'add' });
  } else if(b && !b.classList.contains('gone')){
    b.classList.add('gone');
    const a = b.animate([{ opacity:1, transform:'scale(1)' },
                         { opacity:0, transform:'scale(1.22)' }],
                        { duration:280, easing:'ease-out', composite:'add' });
    a.finished.then(()=> b.remove()).catch(()=>{});
  }
}

// 방어도 획득: 파편이 모여 방벽이 된다
function blockGainFX(at, col){
  const c = col || '#9CC4E8';
  const r = spawnFX('vfx-ring', '', at.x, at.y + 10, 190, 190, 149);
  if(r){ r.style.borderColor = c;
    fxAnim(r, [{ transform:'scale(1.5)', opacity:0 }, { transform:'scale(.9)', opacity:.9, offset:.6 },
               { transform:'scale(.82)', opacity:0 }], 520, 'ease-out').then(()=> r.remove()); }
  if(RM()) return;
  for(let i = 0; i < 14; i++){
    const ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 70;
    const sz = 5 + Math.random() * 9;
    const d = spawnFX('vfx-shard', '', at.x + Math.cos(ang)*dist, at.y + 10 + Math.sin(ang)*dist, sz, sz*1.7, 150);
    if(!d) continue;
    d.style.background = c; d.style.boxShadow = `0 0 ${sz*2.6}px ${c}`;
    fxAnim(d, [{ transform:`rotate(${Math.random()*360}deg) translate(0,0)`, opacity:0 },
      { transform:`rotate(${Math.random()*360}deg) translate(${-Math.cos(ang)*dist*.5}px,${-Math.sin(ang)*dist*.5}px)`, opacity:1, offset:.45 },
      { transform:`rotate(${Math.random()*360}deg) translate(${-Math.cos(ang)*dist}px,${-Math.sin(ang)*dist}px)`, opacity:0 }],
      440, 'cubic-bezier(.3,.1,.2,1)', Math.random()*110).then(()=> d.remove());
  }
}

// 방어도가 피해를 받아냈을 때
function blockHitFX(sel, at, broke, col){
  const c = col || '#9CC4E8';
  const host = $(sel);
  const b = host && host.querySelector('.barrier');
  if(b && !broke){
    b.animate([{ filter:'brightness(3.2)', transform:'scale(1.09)' },
               { filter:'brightness(1)', transform:'scale(1)' }],
              { duration:280, easing:'ease-out', composite:'add' });
  }
  const f = spawnFX('vfx-flash', '', at.x, at.y + 6, 180, 180, 152);
  if(f){ f.style.background = `radial-gradient(circle, #fff, ${c} 42%, transparent 70%)`;
    fxAnim(f, [{ opacity:.8, transform:'scale(.6)' }, { opacity:0, transform:'scale(1.15)' }], 260, 'ease-out').then(()=> f.remove()); }
  if(!broke || RM()) return;
  // 파괴: 방벽이 조각나 흩어진다
  SFX.play('shatter');
  if(b){ b.classList.add('gone');
    b.animate([{ opacity:1, transform:'scale(1)', filter:'brightness(3)' },
               { opacity:0, transform:'scale(1.3) rotate(6deg)', filter:'brightness(1)' }],
      { duration:340, easing:'ease-out', composite:'add' }).finished.then(()=> b.remove()).catch(()=>{}); }
  for(let i = 0; i < 18; i++){
    const ang = -Math.PI/2 + (Math.random() - .5) * Math.PI * 1.6;
    const dist = 70 + Math.random() * 120;
    const sz = 6 + Math.random() * 13;
    const d = spawnFX('vfx-shard', '', at.x, at.y + 6, sz, sz*1.8, 153);
    if(!d) continue;
    d.style.background = Math.random() > .5 ? c : '#EAF4FF';
    d.style.boxShadow = `0 0 ${sz*2}px ${c}`;
    fxAnim(d, [{ transform:'translate(0,0) rotate(0deg)', opacity:1 },
      { transform:`translate(${Math.cos(ang)*dist}px,${Math.sin(ang)*dist + 90}px) rotate(${Math.random()*540-270}deg)`, opacity:0 }],
      640 + Math.random()*320, 'cubic-bezier(.2,.6,.4,1)').then(()=> d.remove());
  }
}

/* ── 카드 → 이펙트 대응 ── */
const CARD_VFX = {
  strike:'slash', heavy:'slash', flurry:'slash',
  ember_toss:'fireball', ashstorm:'fireball', sigil:'fireball', kindle:'fireball',
  firewall:'guard-fire', detonate:'blast',
  frost_shard:'iceshard', glacier:'iceshard', sleet:'iceshard', coldsnap:'iceshard',
  abszero:'guard-ice',
  mark:'hex', defend:'guard', frost_ward:'guard-ice', forge:'buff',
  regroup:'draw', rekindle:'heal',
};

// 카드 사용 시 연출. 반환 후에 실제 효과가 적용된다.
async function playCardFX(id){
  const kind = CARD_VFX[id] || 'orb';
  const hero = heroRect(), foe = enemyRect();
  if(kind === 'slash'){
    lungeHero(); await wait(75); await slashFX(foe); return;
  }
  if(kind === 'blast'){
    selfFX('buff', hero);
    await wait(90);
    impact('fireball', foe); shake();
    for(let i = 0; i < 3; i++){
      const off = { x: foe.x + (Math.random()*90-45), y: foe.y + (Math.random()*90-45) };
      setTimeout(()=> impact('fireball', off), i * 110);
    }
    await wait(220); return;
  }
  if(kind === 'guard'){ blockGainFX(hero); await wait(260); return; }
  if(kind === 'buff'){ selfFX('buff', hero); await wait(180); return; }
  if(kind === 'heal'){ selfFX('heal', hero); await wait(180); return; }
  if(kind === 'draw'){ selfFX('draw', hero); await wait(140); return; }
  if(kind === 'guard-fire'){ blockGainFX(hero, '#FFB27A'); await wait(240); await fire('fireball', hero, foe); return; }
  if(kind === 'guard-ice'){ blockGainFX(hero, '#7FD8F2'); await wait(240); await fire('iceshard', hero, foe); return; }
  await fire(kind, hero, foe);
}

/* ── 적 공격 연출 ── */
const ENEMY_VFX = {
  guardian:'slam', guardian2:'slam', wolf:'claw',
  wisp:'fireball', warden:'voidbeam', warden2:'voidbeam', boss:'bolt',
};
async function enemyAttackFX(enemyId, big){
  const hero = heroRect(), foe = enemyRect();
  const kind = ENEMY_VFX[enemyId] || 'slam';
  if(kind === 'slam'){
    lungeEnemy(); await wait(110); await slashFX(hero, '#FFB9A0'); return;
  }
  if(kind === 'claw'){
    lungeEnemy(); await wait(90);
    for(let i = 0; i < 3; i++){
      const p = { x: hero.x + (i-1)*22, y: hero.y + (i-1)*18 };
      setTimeout(()=> impact('slash', p), i * 80);
    }
    await slashFX(hero, '#BEEEFF'); return;
  }
  if(big){
    // 대형 공격은 예비동작이 길다
    selfFX('buff', foe);
    await wait(320);
    shake();
    await fire(kind, foe, hero);
    impact(kind, hero);
    return;
  }
  await fire(kind, foe, hero);
}


/* ═══════════════════════════════════════════════════════════
   14. 전투 — 핵심 로직
   ═══════════════════════════════════════════════════════════ */
function draw(n){
  if(!C || C.over) return;
  let got = 0;
  for(let k = 0; k < n; k++){
    if(C.hand.length >= 10){ toast('손패가 가득 찼다'); break; }
    if(C.draw.length === 0){
      if(C.discard.length === 0) break;
      C.draw = shuffle(C.discard.slice());
      C.discard = [];
    }
    C.hand.push(C.draw.pop());
    got++;
  }
  C.dealt = got;
  renderHand(); renderPiles();
}

async function attack(base, raw){
  if(!C || C.over) return;
  // raw=true 이면 힘/약화 보정 없이 그대로 (기폭)
  let d = raw ? base : base + C.p.str;
  if(!raw && C.p.weak > 0) d = Math.floor(d * 0.75);
  d = Math.max(0, d);
  if(C.e.vuln > 0) d = Math.floor(d * 1.5);
  await damageEnemy(d);
}

async function damageEnemy(d, opts){
  opts = opts || {};
  if(!C || C.over || C.e.hp <= 0) return;
  let dmg = d, eBlocked = 0;
  if(!opts.pierce && C.e.block > 0){
    eBlocked = Math.min(C.e.block, dmg);
    C.e.block -= eBlocked; dmg -= eBlocked;
  }
  if(eBlocked > 0) blockHitFX('#enemy-art', enemyRect(), C.e.block === 0, '#E8A0A8');
  C.e.hp = Math.max(0, C.e.hp - dmg);
  G.stats.dmgDealt += dmg;
  SFX.play(dmg >= 12 ? 'heavy' : 'hit');
  flashEnemy();
  float(String(dmg), opts.cls || 'dmg', enemyRect());
  if(dmg >= 12) shake();
  renderHP(); renderEnemyStatus();
  await wait(210);
  // 사망 연출은 await 하지 않는다. onEnemyDead가 동기 구간에서 C.over를 세우므로
  // 뒤따르는 카드 효과들은 각자의 가드에서 안전하게 빠져나간다.
  if(C.e.hp <= 0) onEnemyDead();
}

async function gainBlock(n){
  if(!C || C.over) return;
  SFX.play('block');
  C.p.block += n;
  renderPlayerStatus();
  float('+' + n, 'blk', heroRect());
  await wait(150);
}
function heal(n){
  SFX.play('heal');
  const before = G.hp;
  G.hp = Math.min(G.maxHp, G.hp + n);
  renderHP();
  if(C) float('+' + (G.hp - before), 'heal', heroRect());
}

// 적에게 상태 부여 → 열충격 판정
async function applyE(key, n){
  if(!C || C.over || C.e.hp <= 0) return;
  C.e[key] += n;
  renderEnemyStatus();
  const chip = $(`#enemy-st .st-${key === 'ignite' ? 'ignite' : key === 'frost' ? 'frost' : key}`);
  if(chip && !RM()) chip.animate([
    { transform:'scale(.4) translateY(-26px)', opacity:0 },
    { transform:'scale(1.22)', opacity:1, offset:.55 },
    { transform:'scale(1)', opacity:1 }], { duration:380, easing:'cubic-bezier(.34,1.4,.64,1)' });
  await wait(150);
  if(key === 'frost'){
    if(C.e.frost >= 5){
      C.e.frost = 0; C.e.frozen = true;
      G.stats.freezes++;
      log('FREEZE', `전투${C.fightNo}`);
      renderEnemyStatus(); renderIntent();
      SFX.play('freeze'); impact('iceshard', enemyRect());
      banner('빙결', '적이 한 턴 행동하지 못한다', 'freeze');
      await wait(600);
    }
  }
}

async function thermalShock(){
  if(!C || C.over) return;
  const ig = C.e.ignite, fr = C.e.frost;
  const dmg = (ig + fr) * 2;
  C.e.ignite = 0; C.e.frost = 0;
  G.stats.shocks++;
  C.shockThisFight++;
  if(!G.stats.firstShockFight) G.stats.firstShockFight = C.fightNo;
  log('THERMAL_SHOCK', `전투${C.fightNo} 점화${ig}+서리${fr} → ${dmg}`);
  renderEnemyStatus();
  SFX.play('shock');
  shockRing(); shake();
  impact('fireball', enemyRect());
  setTimeout(()=> impact('iceshard', enemyRect()), 130);
  banner('열충격', `점화 ${ig} + 서리 ${fr}`, 'shock');
  await wait(340);
  await damageEnemy(dmg, { pierce:true, cls:'burn' });
  if(C.e.hp > 0){
    C.e.vuln += 2;
    renderEnemyStatus();
    await wait(180);
  }
}

/* ── 카드 사용 ── */
async function playCard(i){
  if(busy || !C || C.over) return;
  const id = C.hand[i];
  if(!id) return;
  const c = CARDS[id];
  if(C.energy < c.c){
    const el = $(`#hand .card[data-i="${i}"]`);
    if(el) nopeCard(el, i);
    return;
  }

  busy = true;
  const node = $(`#hand .card[data-i="${i}"]`);
  if(node){
    node.classList.remove('playable');
    node.style.zIndex = '90';
    const selfCard = ['defend','frost_ward','forge','regroup','rekindle'].includes(id);
    const tgt = selfCard ? heroRect() : enemyRect();
    const nb = node.getBoundingClientRect(), ab = $('#arena').getBoundingClientRect();
    const dx = tgt.x - (nb.left - ab.left + nb.width/2);
    const dy = tgt.y - (nb.top - ab.top + nb.height/2);
    node.animate([
      { transform:'none', opacity:1, filter:'brightness(1)' },
      { transform:'translateY(-70px) scale(1.14) rotate(0deg)', opacity:1, filter:'brightness(1.6)', offset:.35 },
      { transform:`translate(${dx*.55}px, ${dy*.55 - 30}px) scale(.5) rotate(0deg)`, opacity:.5, filter:'brightness(2.2)', offset:.8 },
      { transform:`translate(${dx*.8}px, ${dy*.8}px) scale(.2)`, opacity:0, filter:'brightness(3)' }
    ], { duration:340, easing:'cubic-bezier(.4,0,.7,1)', composite:'add', fill:'forwards' });
  }

  C.energy -= c.c;
  const eEl = $('#energy');
  eEl.classList.remove('spent'); void eEl.offsetWidth; eEl.classList.add('spent');
  renderEnergy();

  C.hand.splice(i, 1);
  C.discard.push(id);
  G.stats.cardsPlayed++;
  log('CARD', `전투${C.fightNo} T${C.turn} ${c.n}`);

  SFX.play('card');
  await wait(215);
  if(node) node.remove();
  renderHand(); renderPiles();

  try {
    await playCardFX(id);
    await c.use();
  } catch(err){ console.error('card error', id, err); }

  busy = false;
  if(C && !C.over){ renderHand(); renderIntent(); }
  updateQA();
}

// 손패가 버린 패 더미로 날아가 꽂힌다
async function discardHandFX(){
  const cards = $$('#hand .card');
  if(!cards.length || RM()) return;
  const pile = $('#pile-discard'), arena = $('#arena');
  if(!pile || !arena) return;
  const pb = pile.getBoundingClientRect();
  cards.forEach((el, k) => {
    const eb = el.getBoundingClientRect();
    const dx = (pb.left + pb.width/2) - (eb.left + eb.width/2);
    const dy = (pb.top + pb.height/2) - (eb.top + eb.height/2);
    el.animate([
      { transform:'none', opacity:1 },
      { transform:`translate(${dx}px, ${dy}px) rotate(${28 + k*9}deg) scale(.24)`, opacity:0 }
    ], { duration:300, delay:k * 45, easing:'cubic-bezier(.5,0,.75,.6)', composite:'add', fill:'forwards' });
  });
  await wait(300 + cards.length * 45);
}

/* ── 턴 흐름 ── */
async function startPlayerTurn(first){
  if(!C || C.over) return;
  C.turn++;
  G.stats.turns++;
  if(C.p.block > 0){
    const b = $('#hero-art .barrier');
    if(b && !b.classList.contains('gone')){
      b.classList.add('gone');
      b.animate([{ opacity:1, transform:'scale(1)' }, { opacity:0, transform:'scale(.86) translateY(14px)' }],
        { duration:340, easing:'ease-in', composite:'add' }).finished.then(()=> b.remove()).catch(()=>{});
    }
  }
  // 첫 턴에는 방어도를 초기화하지 않는다 (전투 시작 특전이 지워지지 않도록)
  if(C.turn > 1) C.p.block = 0;
  C.energy = C.maxEnergy;
  if(C.p.vuln > 0) C.p.vuln--;
  if(C.p.weak > 0) C.p.weak--;
  renderPlayerStatus(); renderEnergy(); renderHP();
  draw(5 + (C.bonusDraw || 0));
  C.bonusDraw = 0;
  renderIntent();
  updateQA();
  setPhase('mine');
  const et = $('#end-turn');
  et.disabled = false; et.classList.add('ready');
  if(!first){ phaseSweep('내 턴', '#6FA678'); SFX.play('turn'); }
  if(!first) log('TURN', `전투${C.fightNo} T${C.turn}`);
}

async function endTurn(){
  if(busy || !C || C.over) return;
  busy = true;
  const etb = $('#end-turn');
  etb.classList.remove('ready'); etb.disabled = true;

  // 보스 대형 공격('소멸') 대비 여부 — 영상 분석의 핵심 지표
  if(C.boss && C.e.act && C.e.act.big){
    let inc = enemyAtkVal(C.e.act.atk);
    if(C.p.vuln > 0) inc = Math.floor(inc * 1.5);
    if(C.e.frozen){
      G.stats.bossBigBlocked++;
      log('BOSS_BIG_FROZEN', `빙결로 무력화 (${inc} 무효)`);
    } else if(C.p.block >= inc){
      G.stats.bossBigBlocked++;
      log('BOSS_BIG_PREPARED', `방어 ${C.p.block} ≥ ${inc}`);
    } else {
      G.stats.bossBigHits++;
      const mit = Math.round(Math.min(1, C.p.block / Math.max(1, inc)) * 100);
      log('BOSS_BIG_EXPOSED', `방어 ${C.p.block} / ${inc} (경감 ${mit}%)`);
    }
  }

  setPhase('foe');
  phaseSweep('적의 턴', '#C4384B');
  await wait(700);

  await enemyTurn();

  // 적 행동이 끝난 뒤에 손패를 버린다 (적 턴 동안 화면이 비지 않도록)
  if(C && !C.over){
    await discardHandFX();
    while(C.hand.length){ C.discard.push(C.hand.pop()); }
    renderHand(); renderPiles();
    await wait(120);
  }

  if(C && !C.over){
    busy = false;
    await startPlayerTurn(false);
  } else {
    busy = false;
  }
}

async function enemyTurn(){
  if(!C || C.over) return;
  C.e.block = 0;
  renderEnemyStatus();

  if(C.e.frozen){
    C.e.frozen = false;
    banner('빙결', '적이 움직이지 못한다', 'freeze');
    renderEnemyStatus();
    await wait(900);
  } else {
    const a = C.e.act;
    if(C.boss) G.stats.bossPatternSeen++;
    pulseClass($('#intent'), 'acting', 700);
    banner(a.l, '', 'turn');
    await wait(520);

    if(a.blk !== undefined){
      C.e.block += a.blk;
      renderEnemyStatus();
      float('+' + a.blk, 'blk', enemyRect());
      await wait(320);
    }
    if(a.str !== undefined){
      C.e.str += a.str;
      renderEnemyStatus();
      float('힘 +' + a.str, 'blk', enemyRect());
      await wait(320);
    }
    if(a.multi){
      for(let k = 0; k < a.multi[1]; k++){
        await enemyAttackFX(C.id, false);
        await hitPlayer(enemyAtkVal(a.multi[0]), a.big);
        await wait(230);
        if(G.hp <= 0) break;
      }
    } else if(a.atk !== undefined){
      await enemyAttackFX(C.id, !!a.big);
      await hitPlayer(enemyAtkVal(a.atk), a.big);
      await wait(230);
    }
    if(a.deb && G.hp > 0){
      for(const k in a.deb){ C.p[k] += a.deb[k]; }
      renderPlayerStatus();
      float(a.deb.vuln ? '취약' : '약화', 'blk', heroRect());
      await wait(320);
    }
  }

  if(G.hp <= 0){ await onPlayerDead(); return; }

  // 점화 피해
  if(C.e.ignite > 0 && C.e.hp > 0){
    const burn = C.e.ignite;
    SFX.play('ignite');
    banner('점화', `${burn} 피해`, 'shock');
    await wait(300);
    await damageEnemy(burn, { pierce:true, cls:'burn' });
    if(C && !C.over){ await wait(200); }
  }
  if(!C || C.over) return;

  // 열충격: 적 턴이 끝날 때 두 속성이 함께 있으면 터진다.
  // 즉발이던 시절에는 두 속성을 쌓는 것 자체가 불가능했다.
  if(C.e.ignite > 0 && C.e.frost > 0 && C.e.hp > 0){
    await thermalShock();
  }
  if(!C || C.over) return;

  if(C.e.vuln > 0) C.e.vuln--;
  if(C.e.weak > 0) C.e.weak--;
  renderEnemyStatus();

  C.e.pi++;
  setIntent();
  renderIntent();
  updateQA();
}

async function hitPlayer(raw, isBig){
  let d = raw;
  if(C.p.vuln > 0) d = Math.floor(d * 1.5);
  let blocked = 0;
  if(C.p.block > 0){
    blocked = Math.min(C.p.block, d);
    C.p.block -= blocked; d -= blocked;
  }
  G.hp = Math.max(0, G.hp - d);
  G.stats.dmgTaken += d;
  if(blocked > 0) blockHitFX('#hero-art', heroRect(), C.p.block === 0, '#9CC4E8');
  SFX.play(d > 0 ? 'hurt' : 'block');
  flashHero();
  if(d > 0) float(String(d), 'dmg', heroRect());
  else float('막음', 'blk', heroRect());
  if(d >= 10 || isBig) shake();
  renderHP(); renderPlayerStatus();
  await wait(200);
}

/* ── 전투 종료 ── */
async function onEnemyDead(){
  if(!C || C.over) return;
  C.over = true;
  busy = true;
  drag = null; hideAim(); setReticle(false);
  $('#arena').classList.remove('foe');
  $('#phase').innerHTML = '';
  $('#enemy').classList.add('dying');
  renderIntent();
  const dur = Math.round((ms() - C.startedAt) / 1000);
  G.stats.fightLog.push({
    no:C.fightNo, e:ENEMIES[C.id].n, turns:C.turn, sec:dur,
    hpLeft:G.hp, shocks:C.shockThisFight, potions:C.potionUsedThisFight
  });
  log('FIGHT_WIN', `전투${C.fightNo} ${C.turn}턴 ${dur}초 체력${G.hp}`);
  await wait(760);
  const wasBoss = C.boss, wasElite = C.elite;
  SFX.play(wasBoss ? 'win' : 'reward');
  banner('승리', `${C.turn}턴`, 'turn');
  await wait(900);
  C = null;
  busy = false;
  updateQA();

  if(wasBoss){ endRun(true); return; }

  // 보상
  const gold = wasElite ? 68 : 32;
  G.gold += gold;
  renderTopHUD();
  let gotPotion = null;
  const lr = RNG.loot(G.fights);
  if(wasElite || lr() < 0.45){
    const slot = G.potions.indexOf(null);
    if(slot >= 0){
      gotPotion = POTION_IDS[riR(lr, POTION_IDS.length)];
      G.potions[slot] = gotPotion;
      G.stats.potionsFound++;
    }
  }
  openReward(gold, gotPotion);
}

async function onPlayerDead(){
  if(!C || C.over) return;
  C.over = true;
  busy = true;
  log('FIGHT_LOSE', `전투${C.fightNo} T${C.turn}`);
  G.stats.fightLog.push({
    no:C.fightNo, e:ENEMIES[C.id].n, turns:C.turn,
    sec:Math.round((ms()-C.startedAt)/1000), hpLeft:0,
    shocks:C.shockThisFight, potions:C.potionUsedThisFight, lost:true
  });
  SFX.play('lose');
  applyScene('lose');
  banner('소멸', '각인이 흩어졌다', 'turn');
  await wait(1500);
  C = null; busy = false;
  endRun(false);
}

/* ═══════════════════════════════════════════════════════════
   15. 보상
   ═══════════════════════════════════════════════════════════ */
function rollRewardCards(fightNo){
  // 매 보상마다 불/서리 각 최소 1장 보장 → 속성 선택이 항상 가능
  const r = RNG.reward(fightNo);
  const f = pickR(r, CARD_POOL_FIRE);
  const i = pickR(r, CARD_POOL_ICE);
  const rest = CARD_POOL_FIRE.concat(CARD_POOL_ICE, CARD_POOL_NEU).filter(x => x !== f && x !== i);
  const third = pickR(r, rest);
  return shuffleWith(r, [f, i, third]);
}
let rewardOpenedAt = 0;

function openReward(gold, potion){
  const cards = rollRewardCards(G.fights);
  rewardOpenedAt = ms();
  $('#rw-title').textContent = '각인을 하나 취하시오';
  let d = `재화 +${gold}`;
  if(potion) d += ` · 물약 획득: ${POTIONS[potion].n}`;
  $('#rw-desc').textContent = d;
  $('#rw-cards').innerHTML = cards.map((id, k) =>
    `<div class="pick" data-add="${id}" style="animation-delay:${k*70}ms">${cardHTML(id)}</div>`
  ).join('');
  ov('ov-reward', true);
  SFX.play('ui');
  log('REWARD_OFFER', cards.join(','));
}

function takeReward(id){
  G.deck.push(id);
  const c = CARDS[id];
  if(c.el === 'fire') G.stats.firePicks++;
  else if(c.el === 'ice') G.stats.icePicks++;
  else G.stats.neuPicks++;
  G.stats.cardsAdded.push(id);
  renderTopHUD();
  log('REWARD_TAKE', `${c.n} (${Math.round((ms()-rewardOpenedAt)/100)/10}초)`);
  ov('ov-reward', false);
  advance();
}

/* ═══════════════════════════════════════════════════════════
   16. 야영지 / 상점
   ═══════════════════════════════════════════════════════════ */
function openRest(){
  const canRemove = G.deck.length > 5;
  $('#rest-opts').innerHTML = `
    <div class="opt" data-rest="heal" style="--oc:#6FA678">
      ${ico('heart')}<h4>잿불 쬐기</h4><p>체력을 22 회복한다.<br>현재 ${G.hp} / ${G.maxHp}</p></div>
    <div class="opt ${canRemove?'':'cant'}" data-rest="remove" style="--oc:#C4384B">
      ${ico('trash')}<h4>각인 지우기</h4><p>덱에서 카드 한 장을 영구히 제거한다.</p></div>
    <div class="opt" data-rest="grow" style="--oc:#D9B463">
      ${ico('up')}<h4>각인 덧새기기</h4><p>최대 체력이 10 늘고 그만큼 회복한다.</p></div>`;
  ov('ov-rest', true);
  log('REST_OPEN', '');
}

let shopStock = null;
function openShop(){
  if(!shopStock){
    const p = shuffleWith(RNG.shop(), CARD_POOL_FIRE.concat(CARD_POOL_ICE, CARD_POOL_NEU));
    shopStock = [
      { id:p[0], price:60, sold:false },
      { id:p[1], price:60, sold:false },
      { id:p[2], price:78, sold:false },
    ];
    shopRemoved = false;
  }
  renderShop();
  ov('ov-shop', true);
  log('SHOP_OPEN', `재화 ${G.gold}`);
}
let shopRemoved = false;
function renderShop(){
  $('#shop-desc').textContent = `보유 재화 ${G.gold}`;
  $('#shop-cards').innerHTML = shopStock.map(s => {
    if(s.sold) return `<div class="pick cant" style="opacity:.22"><div style="width:158px;height:216px;border:1px dashed #313850;border-radius:13px;display:grid;place-items:center;color:#5E6479;font-size:12px">판매됨</div></div>`;
    const cant = G.gold < s.price ? 'cant' : '';
    return `<div class="pick ${cant}" data-buy="${s.id}">${cardHTML(s.id)}<div class="pick-price">${s.price}</div></div>`;
  }).join('');
  const rb = $('#shop-remove');
  rb.disabled = shopRemoved || G.gold < 70 || G.deck.length <= 5;
  rb.textContent = shopRemoved ? '각인 지우기 · 완료' : '각인 지우기 · 70';
}

/* ═══════════════════════════════════════════════════════════
   17. 덱 보기 / 제거
   ═══════════════════════════════════════════════════════════ */
let removeMode = false, removeAfter = null, removeCtx = null;
function openDeck(forRemove, after, ctx){
  removeMode = !!forRemove; removeAfter = after || null; removeCtx = ctx || null;
  const sorted = G.deck.slice().sort((a,b)=>{
    const A = CARDS[a], Bc = CARDS[b];
    if(A.c !== Bc.c) return A.c - Bc.c;
    return A.n.localeCompare(Bc.n, 'ko');
  });
  $('#dv-title').textContent = removeMode ? '지울 각인을 고르시오' : '덱';
  $('#dv-desc').textContent  = removeMode ? '한 장이 영구히 사라집니다.' : `${G.deck.length}장`;
  $('#dv-list').innerHTML = sorted.map(id => cardHTML(id, { cls: removeMode ? 'rm' : '' })).join('');
  $('#dv-close').textContent = removeMode ? '취소' : '닫기';
  ov('ov-deck', true);
}
function openPile(which){
  if(!C) return;
  const arr = which === 'draw' ? C.draw : C.discard;
  const sorted = arr.slice().sort((a,b)=>{
    const A = CARDS[a], Bc = CARDS[b];
    if(A.c !== Bc.c) return A.c - Bc.c;
    return A.n.localeCompare(Bc.n, 'ko');
  });
  $('#pv-title').textContent = which === 'draw' ? '뽑을 패' : '버린 패';
  $('#pv-desc').textContent = sorted.length
    ? (which === 'draw' ? `${sorted.length}장 · 실제 순서는 알 수 없다` : `${sorted.length}장`)
    : '비어 있다';
  $('#pv-list').innerHTML = sorted.map(id => cardHTML(id)).join('');
  ov('ov-pile', true);
  log('VIEW_PILE', which);
}

/* ═══════════════════════════════════════════════════════════
   18. 지도
   ═══════════════════════════════════════════════════════════ */
let mapShownAt = 0;
function goMap(){
  closeAllOv();
  C = null;
  applyScene('map');
  show('map-screen');
  renderMap();
  mapShownAt = ms();
  updateQA();
}
function renderMap(){
  renderTopHUD();

  const inner = $('#map-inner');
  let h = '<svg class="map-svg" id="map-svg"></svg>';
  MAP_LAYERS.forEach((layer, li) => {
    h += `<div class="map-layer" data-layer="${li}">`;
    layer.forEach((node, ni) => {
      const done = li < G.layer;
      const avail = li === G.layer;
      const chosenHere = G.chosen[li];
      const isChosen = done && chosenHere === ni;
      const dim = done && !isChosen;
      const cls = [
        'map-node', node.t,
        avail ? 'avail' : '',
        isChosen ? 'done' : '',
        dim ? 'skipped' : ''
      ].join(' ');
      h += `<div class="${cls}" data-l="${li}" data-n="${ni}" style="${dim?'opacity:.22':''}">
        <div class="node-disc">${ico(NODE_ICON[node.t])}</div>
        <div class="node-label">${NODE_LABEL[node.t]}</div>
        <div class="node-note">${esc(node.name)}</div>
      </div>`;
    });
    h += `</div>`;
  });
  inner.innerHTML = h;
  requestAnimationFrame(drawMapLines);
}
function drawMapLines(){
  const svg = $('#map-svg'); if(!svg) return;
  const inner = $('#map-inner');
  const box = inner.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  svg.setAttribute('width', box.width); svg.setAttribute('height', box.height);
  let paths = '';
  for(let li = 0; li < MAP_LAYERS.length - 1; li++){
    const from = $$(`.map-node[data-l="${li}"]`);
    const to   = $$(`.map-node[data-l="${li+1}"]`);
    from.forEach(a => {
      const ra = a.querySelector('.node-disc').getBoundingClientRect();
      const ax = ra.left - box.left + ra.width/2, ay = ra.bottom - box.top;
      to.forEach(b => {
        const rb = b.querySelector('.node-disc').getBoundingClientRect();
        const bx = rb.left - box.left + rb.width/2, by = rb.top - box.top;
        const mid = (ay + by) / 2;
        const active = li < G.layer;
        paths += `<path d="M${ax} ${ay} C ${ax} ${mid}, ${bx} ${mid}, ${bx} ${by}" fill="none"
          stroke="${active ? 'rgba(111,166,120,.34)' : 'rgba(255,255,255,.09)'}"
          stroke-width="1.4" stroke-dasharray="${active ? '0' : '4 7'}"/>`;
      });
    });
  }
  svg.innerHTML = paths;
}
window.addEventListener('resize', () => {
  if($('#map-screen').classList.contains('on')) requestAnimationFrame(drawMapLines);
  if(C) renderHand();
});

function enterNode(li, ni){
  if(li !== G.layer) return;
  const node = MAP_LAYERS[li][ni];
  const layer = MAP_LAYERS[li];
  if(layer.length > 1){
    const dt = Math.round((ms() - mapShownAt) / 100) / 10;
    G.stats.branchMs.push(dt);
    G.stats.eliteOffers++;
    if(node.t === 'elite') G.stats.elitesTaken++;
    log('BRANCH', `층${li+1} → ${NODE_LABEL[node.t]} (${dt}초)`);
  } else {
    log('NODE', `층${li+1} ${NODE_LABEL[node.t]}`);
  }
  G.chosen[li] = ni;

  if(node.t === 'battle' || node.t === 'elite' || node.t === 'boss'){
    startCombat(node.e, node.name, node.t === 'elite', node.t === 'boss');
  } else if(node.t === 'rest'){
    applyScene('rest'); show('map-screen'); openRest();
  } else if(node.t === 'shop'){
    applyScene('shop'); show('map-screen'); openShop();
    const skEl = $('#shopkeeper-img'); if(skEl) skEl.src = SHOPKEEPER_ART;
  }
}
function advance(){
  G.layer++;
  if(G.layer >= MAP_LAYERS.length){ endRun(true); return; }
  goMap();
}

/* ═══════════════════════════════════════════════════════════
   19. 결과 + 기록 내보내기
   ═══════════════════════════════════════════════════════════ */
function endRun(won){
  G.done = true;
  G.won = won;
  G.totalMs = ms();
  if(timerId){ clearInterval(timerId); timerId = null; }
  log('RUN_END', won ? '승리' : '패배');

  const s = G.stats;
  $('#res-mark').innerHTML = won
    ? `<circle cx="50" cy="50" r="44" fill="none" stroke="#D9B463" stroke-width="1.4" stroke-dasharray="4 8"/>
       <path d="M50 20 L76 66 H24 Z" fill="rgba(217,180,99,.13)" stroke="#D9B463" stroke-width="2.4" stroke-linejoin="round"/>
       <circle cx="50" cy="53" r="8" fill="#F0562D" opacity=".55"/><circle cx="50" cy="53" r="3.4" fill="#FFE9C2"/>`
    : `<circle cx="50" cy="50" r="44" fill="none" stroke="#4A4050" stroke-width="1.4" stroke-dasharray="3 9"/>
       <path d="M50 80 L24 34 H76 Z" fill="rgba(90,80,100,.13)" stroke="#6B5F74" stroke-width="2.4" stroke-linejoin="round"/>
       <circle cx="50" cy="47" r="7" fill="#3A3244"/>`;
  $('#res-name').textContent = won ? '회랑 돌파' : '소멸';
  $('#res-sub').textContent = won
    ? '말라붙은 심판자의 저울이 부러졌다.'
    : `${MAP_LAYERS.length}층 중 ${Math.min(G.layer + 1, MAP_LAYERS.length)}층에서 각인이 흩어졌다.`;

  const st = G.stats;
  const cells = [
    ['총 시간', tstr(G.totalMs)],
    ['전투', String(st.fightLog.length)],
    ['총 턴', String(st.turns)],
    ['가한 피해', String(st.dmgDealt)],
    ['받은 피해', String(st.dmgTaken)],
    ['열충격', String(st.shocks)],
    ['빙결', String(st.freezes)],
    ['최종 덱', String(G.deck.length)],
  ];
  $('#res-stats').innerHTML = cells.map(c => `<div class="rstat"><b>${c[1]}</b><span>${c[0]}</span></div>`).join('');

  // 기획 의도 대비 실측 요약
  const picks = st.firePicks + st.icePicks + st.neuPicks;
  const lean = picks ? Math.round(Math.max(st.firePicks, st.icePicks) / picks * 100) : 0;
  const leanEl = st.firePicks >= st.icePicks ? '불' : '서리';
  const potLeft = G.potions.filter(Boolean).length;
  const parts = [];
  parts.push(`캐릭터 <b>${G.starter ? CHARS[G.starter].name : '—'}</b> · 결정까지 <b>${(st.deckChoiceMs/1000).toFixed(1)}초</b>`);
  parts.push(`획득 각인 ${picks}장 중 ${leanEl} 쪽으로 <b>${lean}%</b> 쏠림`);
  parts.push(st.shocks ? `열충격 첫 발동 <b>전투 ${st.firstShockFight}</b> · 총 <b>${st.shocks}회</b>` : `열충격 <b>미발동</b> — 시너지를 끝내 발견하지 못함`);
  parts.push(`정예 선택 <b>${st.elitesTaken}/${st.eliteOffers}</b>${st.branchMs.length ? ` · 분기 결정 평균 <b>${(st.branchMs.reduce((a,b)=>a+b,0)/st.branchMs.length).toFixed(1)}초</b>` : ''}`);
  parts.push(`물약 사용 <b>${st.potionsUsed}</b> / 획득 ${st.potionsFound} · 미사용 종료 <b>${potLeft}개</b>`);
  if(st.bossPatternSeen) parts.push(`보스 4턴차 소멸 — 사전 방어 <b>${st.bossBigBlocked}회</b> / 피격 <b>${st.bossBigHits}회</b>`);
  $('#res-note').innerHTML = parts.join('<br>');

  applyScene(won ? 'win' : 'lose');
  closeAllOv();
  ov('ov-result', true);
  updateQA();
}

function exportText(){
  const st = G.stats;
  const L = [];
  L.push('재의 회랑 · 플레이 기록');
  L.push('─────────────────────────────');
  L.push(`세션 ${SID}   시드 ${SEED}`);
  L.push(`결과 ${G.won ? '승리 (보스 처치)' : '패배'}   총 ${tstr(G.totalMs)}`);
  L.push(`캐릭터 ${G.starter ? CHARS[G.starter].name : '-'} (결정 ${(st.deckChoiceMs/1000).toFixed(1)}초)`);
  L.push('');
  L.push('[집계]');
  L.push(`전투 ${st.fightLog.length} · 총 턴 ${st.turns} · 카드 사용 ${st.cardsPlayed}`);
  L.push(`가한 피해 ${st.dmgDealt} · 받은 피해 ${st.dmgTaken}`);
  L.push(`열충격 ${st.shocks}회 (첫 발동: ${st.firstShockFight || '없음'}) · 빙결 ${st.freezes}회`);
  L.push(`정예 ${st.elitesTaken}/${st.eliteOffers} · 분기 결정 ${st.branchMs.map(x=>x+'초').join(', ') || '-'}`);
  L.push(`물약 사용 ${st.potionsUsed}/${st.potionsFound} · 미사용 보유 ${G.potions.filter(Boolean).length}`);
  L.push(`획득 각인 불 ${st.firePicks} / 서리 ${st.icePicks} / 무속성 ${st.neuPicks} / 넘김 ${st.skips}`);
  if(st.bossPatternSeen) L.push(`보스 소멸 패턴 — 사전 방어 ${st.bossBigBlocked} / 피격 ${st.bossBigHits}`);
  L.push('');
  L.push('[전투별]');
  st.fightLog.forEach(f => {
    L.push(`  ${f.no}. ${f.e} — ${f.turns}턴 ${f.sec}초 · 남은 체력 ${f.hpLeft} · 열충격 ${f.shocks} · 물약 ${f.potions}${f.lost?' · 패배':''}`);
  });
  L.push('');
  L.push('[최종 덱]');
  L.push('  ' + G.deck.map(id => CARDS[id].n).join(', '));
  L.push('');
  L.push('[타임라인]');
  G.log.forEach(e => L.push(`  ${tstr(e.t)}  ${e.ev}${e.d ? '  ' + e.d : ''}`));
  return L.join('\n');
}

/* ═══════════════════════════════════════════════════════════
   20. 툴팁
   ═══════════════════════════════════════════════════════════ */
const ST_TIP = {
  ignite:['점화','적의 턴이 끝날 때마다 쌓인 수치만큼 피해를 준다. 저절로 사라지지 않는다.'],
  frost:['서리','5겹에 이르면 모두 소모되어 적이 한 턴 얼어붙는다.'],
  frozen2:['',''],
  vuln:['취약','받는 피해가 50% 늘어난다. 턴마다 1 줄어든다.'],
  weak:['약화','주는 피해가 25% 줄어든다. 턴마다 1 줄어든다.'],
  str:['힘','공격 피해가 수치만큼 늘어난다. 전투 내내 유지된다.'],
  block:['방어도','피해를 대신 받아낸다. 자기 턴이 시작될 때 사라진다.'],
  frozen:['빙결','이번 턴 아무 행동도 하지 못한다.'],
};
const tip = $('#tip');
function showTip(html, x, y){
  tip.innerHTML = html;
  tip.classList.add('on');
  const r = tip.getBoundingClientRect();
  let left = x - r.width / 2, top = y - r.height - 14;
  left = clamp(left, 8, window.innerWidth - r.width - 8);
  if(top < 8) top = y + 20;
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
function hideTip(){ tip.classList.remove('on'); }

document.addEventListener('mouseover', e => {
  const st = e.target.closest('[data-st]');
  if(st && ST_TIP[st.dataset.st]){
    const [n, d] = ST_TIP[st.dataset.st];
    const r = st.getBoundingClientRect();
    showTip(`<h5>${n}</h5>${d}`, r.left + r.width/2, r.top);
    return;
  }
  const po = e.target.closest('[data-tipname]');
  if(po){
    const r = po.getBoundingClientRect();
    showTip(`<h5>${po.dataset.tipname}</h5>${po.dataset.tipdesc}<br><span style="color:#8E93A6">클릭해 사용</span>`, r.left + r.width/2, r.top);
    return;
  }
  hideTip();
});
document.addEventListener('mouseout', e => {
  if(e.target.closest && (e.target.closest('[data-st]') || e.target.closest('[data-tipname]'))) hideTip();
});
window.addEventListener('scroll', hideTip, true);

/* ═══════════════════════════════════════════════════════════
   카드 조작 — 끌어서 조준 / 호버 미리보기
   ═══════════════════════════════════════════════════════════ */

// 카드별 예상 피해 (호버·조준 시 미리보기용)
const CARD_DMG = {
  strike:[6,1], flurry:[3,2], heavy:[15,1],
  ember_toss:[4,1], ashstorm:[16,1],
  frost_shard:[3,1], sleet:[4,1], glacier:[10,1],
};
const CARD_BLOCK = { defend:6, frost_ward:6, firewall:12, abszero:16 };
// 대상을 지정하지 않는 카드 (자기 자신에게)
const SELF_CARDS = ['defend','frost_ward','forge','regroup','rekindle'];

function previewFor(id){
  if(!C || C.over) return 0;
  if(id === 'detonate') return Math.floor(C.e.ignite * 5 * (C.e.vuln > 0 ? 1.5 : 1));
  const m = CARD_DMG[id];
  if(!m) return 0;
  let d = pAtk(m[0]);
  if(C.e.vuln > 0) d = Math.floor(d * 1.5);
  return Math.max(0, d) * m[1];
}
function showPreview(id){
  const bar = $('#enemy .hpbar'), prev = $('#ehp-prev'), txt = $('#ehp-txt');
  if(!bar || !prev || !C || C.over) return;
  const dmg = previewFor(id);
  if(!dmg){ clearPreview(); return; }
  const after = Math.max(0, C.e.hp - dmg);
  prev.style.width = ((C.e.hp - after) / C.e.maxHp * 100) + '%';
  bar.classList.toggle('lethal', after <= 0);
  txt.innerHTML = after <= 0
    ? `<span style="color:#FFE9A8">치명</span>`
    : `${C.e.hp}<span style="color:#8E93A6">→</span><span style="color:#FFD2D8">${after}</span>`;
}
function clearPreview(){
  const bar = $('#enemy .hpbar'), prev = $('#ehp-prev');
  if(prev) prev.style.width = '0';
  if(bar) bar.classList.remove('lethal');
  if(C && !C.over) $('#ehp-txt').textContent = `${C.e.hp} / ${C.e.maxHp}`;
  const g = $('#hero-art .blk-ghost'); if(g) g.remove();
}
// 방어 카드: 생길 방벽을 반투명으로 미리 보여준다
function showBlockPreview(id){
  const v = CARD_BLOCK[id]; const host = $('#hero-art');
  if(!v || !host || !C || C.over) return;
  if(host.querySelector('.blk-ghost')) return;
  const g = document.createElement('div');
  g.className = 'blk-ghost';
  g.innerHTML = BARRIER_SVG + `<b>+${v}</b>`;
  host.appendChild(g);
  if(!RM()) g.animate([{ opacity:0, transform:'translate(-50%,-50%) scale(.8)' },
    { opacity:1, transform:'translate(-50%,-50%) scale(1)' }], { duration:180, easing:'ease-out' });
}

/* ── 손패 호버: 이웃이 비켜서고 미리보기가 뜬다 ── */
function spreadHand(hoverIdx){
  $$('#hand .card').forEach((el, j) => {
    let ex = 0;
    if(hoverIdx >= 0 && j !== hoverIdx){
      const d = j - hoverIdx;
      ex = (d > 0 ? 1 : -1) * Math.max(14, 40 - Math.abs(d) * 9);
    }
    el.style.setProperty('--ex', ex.toFixed(0) + 'px');
  });
}

/* ── 조준선 ── */
const AIM_MISS = '#7E89A8', AIM_HIT = '#FF8FA3';
function drawAim(from, to, locked){
  const svg = $('#aim'); if(!svg) return;
  const a = $('#arena').getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${a.width} ${a.height}`);
  const col = locked ? AIM_HIT : AIM_MISS;
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - Math.max(70, Math.abs(to.x - from.x) * .28);
  // 곡선을 따라 쐐기 모양을 늘어놓는다
  const seg = [];
  const N = 13;
  const B = t => ({
    x:(1-t)*(1-t)*from.x + 2*(1-t)*t*cx + t*t*to.x,
    y:(1-t)*(1-t)*from.y + 2*(1-t)*t*cy + t*t*to.y
  });
  for(let i = 1; i <= N; i++){
    const t = i / (N + 1), p = B(t), q = B(Math.min(1, t + .03));
    const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
    const sc = .42 + (i / N) * .78;
    seg.push(`<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${sc.toFixed(2)})" opacity="${(.3 + i/N*.7).toFixed(2)}">
      <path d="M-9 -7 L7 0 L-9 7 L-5 0z" fill="${col}"/></g>`);
  }
  const tip = B(1);
  const tAng = (()=>{ const p = B(.94); return Math.atan2(tip.y - p.y, tip.x - p.x) * 180 / Math.PI; })();
  svg.innerHTML = seg.join('') +
    `<g transform="translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)}) rotate(${tAng.toFixed(1)})">
      <path d="M-26 -20 L18 0 L-26 20 L-14 0z" fill="${col}" stroke="#fff" stroke-width="2" stroke-linejoin="round"
        opacity="${locked ? 1 : .82}"/></g>` +
    (locked ? `<circle cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" r="34" fill="none" stroke="${col}" stroke-width="2.5" opacity=".65"/>` : '');
  svg.classList.add('on');
}
function hideAim(){ const s = $('#aim'); if(s){ s.classList.remove('on'); s.innerHTML = ''; } }

const RETICLE = `<div class="reticle"><svg viewBox="0 0 200 200" fill="none">
<g class="rot"><circle cx="100" cy="100" r="86" stroke="#FF8FA3" stroke-width="2" stroke-dasharray="14 18" opacity=".9"/></g>
<g stroke="#FFD2D8" stroke-width="3" stroke-linecap="round">
<path d="M100 8v22M100 170v22M8 100h22M170 100h22"/></g>
<circle cx="100" cy="100" r="62" stroke="#FF8FA3" stroke-width="1.4" opacity=".45"/></svg></div>`;
function setReticle(on){
  const host = $('#enemy-art'); if(!host) return;
  const cur = host.querySelector('.reticle');
  $('#enemy').classList.toggle('targeted', !!on);
  if(on && !cur){ host.insertAdjacentHTML('beforeend', RETICLE); }
  else if(!on && cur){ cur.remove(); }
}

/* ── 드래그 ── */
let drag = null, suppressClick = 0;
function overEnemy(x, y){
  const r = $('#enemy-art').getBoundingClientRect();
  const pad = 70;
  return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
}
function cardBase(el){
  const hand = $('#hand').getBoundingClientRect();
  const cw = el.offsetWidth, ch = el.offsetHeight;
  return { cx: hand.left + hand.width / 2, by: hand.bottom, cw, ch };
}
function beginDrag(el, ev){
  if(busy || !C || C.over) return;
  const i = parseInt(el.dataset.i, 10);
  const id = C.hand[i];
  if(id === undefined) return;
  const c = CARDS[id];
  if(C.energy < c.c){ nopeCard(el, i); return; }
  const b = cardBase(el);
  drag = { el, i, id, targeted: !SELF_CARDS.includes(id), moved:false,
           startX:ev.clientX, startY:ev.clientY, b, over:false };
  el.setPointerCapture && el.setPointerCapture(ev.pointerId);
  spreadHand(-1);
}
function moveDrag(ev){
  if(!drag) return;
  const dx = ev.clientX - drag.startX, dy = ev.clientY - drag.startY;
  if(!drag.moved && Math.hypot(dx, dy) < 9) return;
  if(!drag.moved){
    drag.moved = true;
    drag.el.classList.add('dragging');
    SFX.play('ui');
  }
  const a = $('#arena').getBoundingClientRect();
  const b = drag.b;
  if(drag.targeted){
    // 카드는 손패 위에 뜬 채로, 조준선이 커서를 따라간다
    drag.el.style.setProperty('--tx', (0).toFixed(0) + 'px');
    drag.el.style.setProperty('--ex', '0px');
    drag.el.style.setProperty('--ty', (-150).toFixed(0) + 'px');
    drag.el.style.setProperty('--rot', '0deg');
    drag.el.classList.add('ghosted');
    const from = { x: b.cx - a.left, y: b.by - a.top - 150 };
    const to = { x: ev.clientX - a.left, y: ev.clientY - a.top };
    drag.over = overEnemy(ev.clientX, ev.clientY);
    drawAim(from, to, drag.over);
    setReticle(drag.over);
    if(drag.over) showPreview(drag.id); else clearPreview();
  } else {
    // 자기 대상 카드는 카드 자체를 끌어올린다
    drag.el.style.setProperty('--tx', (ev.clientX - b.cx).toFixed(0) + 'px');
    drag.el.style.setProperty('--ex', '0px');
    drag.el.style.setProperty('--ty', (ev.clientY - (b.by - b.ch / 2)).toFixed(0) + 'px');
    drag.el.style.setProperty('--rot', '0deg');
    drag.over = ev.clientY < ($('#hand').getBoundingClientRect().top + 30);
    drag.el.style.filter = drag.over ? 'drop-shadow(0 0 26px rgba(150,200,240,.9))' : '';
    if(drag.over) showBlockPreview(drag.id);
    else { const g = $('#hero-art .blk-ghost'); if(g) g.remove(); }
  }
}
function endDrag(ev){
  if(!drag) return;
  const d = drag; drag = null;
  hideAim(); setReticle(false); clearPreview();
  d.el.classList.remove('dragging', 'ghosted');
  d.el.style.filter = '';
  // 포인터로 처리했으므로 뒤따르는 click 이벤트는 무시한다
  suppressClick = Date.now();
  if(!d.moved){ playCard(d.i); return; }   // 짧게 누르면 그냥 사용
  if(d.over){ playCard(d.i); return; }
  // 취소: 제자리로 튕겨 돌아간다
  renderHand();
  const back = $(`#hand .card[data-i="${d.i}"]`);
  if(back && !RM()) back.animate([
    { transform:`translate(${ev.clientX - d.b.cx}px, ${ev.clientY - (d.b.by - d.b.ch/2)}px) scale(1.02)` },
    { transform:'none' }
  ], { duration:280, easing:'cubic-bezier(.34,1.3,.64,1)', composite:'add' });
}
function nopeCard(el, i){
  el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope');
  setTimeout(()=> el.classList.remove('nope'), 340);
  toast('에너지가 부족하다');
}

function clearPreviewSafe(){
  const prev = $('#ehp-prev'); if(prev) prev.style.width = '0';
  const bar = $('#enemy .hpbar'); if(bar) bar.classList.remove('lethal');
}


/* ═══════════════════════════════════════════════════════════
   21. 이벤트 바인딩
   ═══════════════════════════════════════════════════════════ */
let deckShownAt = 0;

$('#btn-start').addEventListener('click', () => {
  SFX.begin(); SFX.play('click');
  newRun();
  t0 = Date.now();
  if(timerId) clearInterval(timerId);
  timerId = setInterval(updateQA, 500);
  log('RUN_START', `시드 ${SEED}`);
  applyScene('deck');
  renderStarters();
  show('deck-screen');
  deckShownAt = ms();
  updateQA();
});

let csPick = 'ember';

function renderStarters(){
  $('#cs-picker').innerHTML = STARTERS.map(ch =>
    `<button class="cs-tab${ch.id === csPick ? ' on' : ''}" data-starter="${ch.id}" style="--cc:${ch.color}">
      <span class="cs-tab-art">${PORTRAITS[ch.id] ? `<img src="${PORTRAITS[ch.id]}" alt="">` : HEROES[ch.id]}</span>
      <em>${esc(ch.name)}</em>
    </button>`).join('');
  renderCharDetail();
}

function renderCharDetail(){
  const ch = STARTERS.find(x => x.id === csPick) || STARTERS[0];
  const root = document.documentElement;
  root.style.setProperty('--cc', ch.color);
  applyScene('deck');
  $('#cs-name').textContent = ch.name;
  $('#cs-en').textContent = ch.en;
  $('#cs-hp').textContent = `${ch.hp}/${ch.hp}`;
  $('#cs-tag').textContent = ch.tag;
  $('#cs-line').textContent = ch.line;
  $('#cs-pname').textContent = ch.boon.n;
  $('#cs-pdesc').textContent = ch.boon.d;
  $('#cs-pmark').innerHTML = STARTER_SIGIL[ch.id] || '';

  const counts = {};
  ch.cards.forEach(c => counts[c] = (counts[c] || 0) + 1);
  $('#cs-chips').innerHTML = Object.keys(counts)
    .sort((a, b) => CARDS[a].c - CARDS[b].c || CARDS[a].n.localeCompare(CARDS[b].n, 'ko'))
    .map(c => {
      const cd = CARDS[c];
      const el = cd.el === 'fire' ? 'f' : cd.el === 'ice' ? 'i' : 'n';
      return `<span class="cs-chip el-${el}"><i>${cd.c}</i>${esc(cd.n)}<b>×${counts[c]}</b></span>`;
    }).join('');

  const art = $('#cs-art');
  const portrait = PORTRAITS[ch.id];
  art.classList.toggle('has-portrait', !!portrait);
  art.innerHTML = portrait
    ? `<img class="cs-portrait" src="${portrait}" alt="${esc(ch.name)}"><div class="cs-art-floor"></div>`
    : HEROES[ch.id] + '<div class="cs-art-floor"></div>';
  if(!RM()) art.animate([
    { opacity:0, transform:'translateX(46px) scale(.94)' },
    { opacity:1, transform:'none' }
  ], { duration:420, easing:'cubic-bezier(.22,.61,.36,1)' });
  $$('.cs-tab').forEach(t => t.classList.toggle('on', t.dataset.starter === csPick));
}

$('#cs-picker').addEventListener('click', e => {
  const t = e.target.closest('[data-starter]');
  if(!t || t.dataset.starter === csPick) return;
  csPick = t.dataset.starter;
  SFX.play('click');
  renderCharDetail();
});

$('#cs-go').addEventListener('click', () => {
  const s = STARTERS.find(x => x.id === csPick);
  if(!s) return;
  G.starter = s.id;
  G.heroName = s.name;
  G.deck = s.cards.slice();
  G.maxHp = s.hp; G.hp = s.hp;
  G.stats.deckChoiceMs = ms() - deckShownAt;
  const nm = $('.tb-id b'); if(nm) nm.textContent = s.name;
  const sub = $('.tb-id span'); if(sub) sub.textContent = s.en;
  log('DECK_PICK', `${s.name} (${(G.stats.deckChoiceMs/1000).toFixed(1)}초)`);
  goMap();
});

$('#map-inner').addEventListener('click', e => {
  const n = e.target.closest('.map-node.avail');
  if(!n) return;
  enterNode(parseInt(n.dataset.l,10), parseInt(n.dataset.n,10));
});

const handEl = $('#hand');
handEl.addEventListener('pointerdown', e => {
  const c = e.target.closest('.card');
  if(!c || e.button > 0) return;
  e.preventDefault();
  beginDrag(c, e);
});
window.addEventListener('pointermove', e => { if(drag) moveDrag(e); }, { passive:true });
window.addEventListener('pointerup', e => { if(drag) endDrag(e); });
window.addEventListener('pointercancel', e => { if(drag) endDrag(e); });
// 포인터 이벤트가 없는 경로(접근성 도구·스크립트 클릭)를 위한 대비책
handEl.addEventListener('click', e => {
  if(Date.now() - suppressClick < 500) return;
  const c = e.target.closest('.card');
  if(!c || drag) return;
  playCard(parseInt(c.dataset.i, 10));
});

// 호버: 이웃이 비켜서고 피해 미리보기가 뜬다
handEl.addEventListener('pointerover', e => {
  if(drag || busy) return;
  const c = e.target.closest('.card');
  if(!c) return;
  spreadHand(parseInt(c.dataset.i, 10));
  if(c.classList.contains('playable')){
    showPreview(c.dataset.card);
    showBlockPreview(c.dataset.card);
  }
});
handEl.addEventListener('pointerleave', () => {
  if(drag) return;
  spreadHand(-1); clearPreview();
});
$('#end-turn').addEventListener('click', endTurn);
$('#pile-draw').addEventListener('click', () => openPile('draw'));
$('#pile-discard').addEventListener('click', () => openPile('discard'));

$('#potions').addEventListener('click', async e => {
  const p = e.target.closest('[data-potion]');
  if(!p || busy || !C || C.over) return;
  const i = parseInt(p.dataset.potion, 10);
  const pid = G.potions[i];
  if(!pid) return;
  busy = true;
  hideTip();
  G.potions[i] = null;
  G.stats.potionsUsed++;
  C.potionUsedThisFight++;
  SFX.play('potion');
  log('POTION', `전투${C.fightNo} T${C.turn} ${POTIONS[pid].n} (적 체력 ${C.e.hp}/${C.e.maxHp}, 내 체력 ${G.hp})`);
  renderPotions();
  try {
    const fx = { p_heal:'heal', p_str:'buff', p_energy:'buff' }[pid];
    if(fx) selfFX(fx, heroRect());
    else await fire(pid === 'p_fire' ? 'fireball' : 'iceshard', heroRect(), enemyRect());
    await POTIONS[pid].use();
  } catch(err){ console.error(err); }
  busy = false;
  if(C && !C.over) renderHand();
});

$('#rw-cards').addEventListener('click', e => {
  const p = e.target.closest('[data-add]');
  if(!p) return;
  takeReward(p.dataset.add);
});
$('#rw-skip').addEventListener('click', () => {
  G.stats.skips++;
  log('REWARD_SKIP', `(${Math.round((ms()-rewardOpenedAt)/100)/10}초)`);
  ov('ov-reward', false);
  advance();
});

$('#rest-opts').addEventListener('click', e => {
  const o = e.target.closest('[data-rest]');
  if(!o || o.classList.contains('cant')) return;
  const k = o.dataset.rest;
  if(k === 'heal'){
    const before = G.hp;
    G.hp = Math.min(G.maxHp, G.hp + 22);
    log('REST', `회복 +${G.hp-before}`);
    ov('ov-rest', false); advance();
  } else if(k === 'grow'){
    G.maxHp += 10; G.hp += 10;
    log('REST', '최대 체력 +10');
    ov('ov-rest', false); advance();
  } else if(k === 'remove'){
    ov('ov-rest', false);
    openDeck(true, () => { log('REST','각인 제거'); advance(); }, 'rest');
  }
});

$('#dv-list').addEventListener('click', e => {
  if(!removeMode) return;
  const c = e.target.closest('.card');
  if(!c) return;
  const id = c.dataset.card;
  const idx = G.deck.indexOf(id);
  if(idx >= 0) G.deck.splice(idx, 1);
  log('CARD_REMOVE', CARDS[id].n);
  ov('ov-deck', false);
  const after = removeAfter;
  removeMode = false; removeAfter = null; removeCtx = null;
  if(after) after(); else renderMap();
});
$('#dv-close').addEventListener('click', () => {
  ov('ov-deck', false);
  if(!removeMode) return;
  const ctx = removeCtx;
  removeMode = false; removeAfter = null; removeCtx = null;
  if(ctx === 'rest') openRest();
  else if(ctx === 'shop'){ renderShop(); ov('ov-shop', true); }
});
$('#pv-close').addEventListener('click', () => ov('ov-pile', false));

$('#tb-deck').addEventListener('click', () => openDeck(false));

$('#shop-cards').addEventListener('click', e => {
  const p = e.target.closest('[data-buy]');
  if(!p || p.classList.contains('cant')) return;
  const id = p.dataset.buy;
  const s = shopStock.find(x => x.id === id && !x.sold);
  if(!s || G.gold < s.price) return;
  G.gold -= s.price; s.sold = true;
  G.deck.push(id);
  const c = CARDS[id];
  if(c.el === 'fire') G.stats.firePicks++;
  else if(c.el === 'ice') G.stats.icePicks++;
  else G.stats.neuPicks++;
  G.stats.cardsAdded.push(id);
  log('SHOP_BUY', `${c.n} -${s.price}`);
  renderTopHUD(); renderShop();
});
$('#shop-remove').addEventListener('click', () => {
  if(shopRemoved || G.gold < 70 || G.deck.length <= 5) return;
  ov('ov-shop', false);
  openDeck(true, () => {
    G.gold -= 70; shopRemoved = true;
    log('SHOP_REMOVE', '-70');
    renderShop(); ov('ov-shop', true);
  }, 'shop');
});
$('#shop-leave').addEventListener('click', () => {
  log('SHOP_LEAVE', `잔여 ${G.gold}`);
  ov('ov-shop', false); advance();
});

$('#res-copy').addEventListener('click', async () => {
  const txt = exportText();
  try {
    await navigator.clipboard.writeText(txt);
    $('#res-copy').textContent = '복사됨';
    setTimeout(()=> $('#res-copy').textContent = '플레이 기록 복사', 1800);
  } catch(err){
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position='fixed'; ta.style.left='-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); $('#res-copy').textContent='복사됨'; }
    catch(e2){ console.log(txt); $('#res-copy').textContent='콘솔에 출력됨'; }
    ta.remove();
    setTimeout(()=> $('#res-copy').textContent = '플레이 기록 복사', 1800);
  }
});
$('#res-again').addEventListener('click', () => { location.reload(); });

// 키보드
document.addEventListener('keydown', e => {
  // Escape는 열람용 창만 닫는다. 보상·야영지·상점은 선택이 끝나야 넘어간다.
  if(e.key === 'Escape'){
    if($('#ov-pile').classList.contains('on')) ov('ov-pile', false);
    else if($('#ov-deck').classList.contains('on')) $('#dv-close').click();
    return;
  }
  if(!$('#combat-screen').classList.contains('on')) return;
  if($$('.overlay.on').length) return;
  if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); endTurn(); return; }
  const n = parseInt(e.key, 10);
  if(n >= 1 && n <= 9 && C && !C.over && C.hand[n-1] !== undefined) playCard(n-1);
});

curScene = null;
applyScene('title');
const tbg = $('#title-bg'); if(tbg) tbg.src = TITLE_BG_ART;
$('#title-hero').innerHTML = TITLE_ART;
$('#hero-art').innerHTML = HEROES.ash + `<div class="unit-shadow"></div><div id="blockbadge" class="blockbadge" style="display:none"></div>`;
requestAnimationFrame(parallaxTick);

// 사운드 토글
const SND_ON  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
const sndBtn = $('#snd');
sndBtn.innerHTML = SND_ON;
sndBtn.addEventListener('click', () => {
  SFX.begin();
  const on = SFX.toggle();
  sndBtn.innerHTML = on ? SND_ON : SND_OFF;
  sndBtn.classList.toggle('off', !on);
  if(on) SFX.play('ui');
});

// 버튼 공통 사운드
document.addEventListener('click', e => {
  if(e.target.closest('.btn, .opt, .pick, .map-node.avail, .deck-card, .potion.filled')) SFX.play('click');
}, true);

updateQA();
window.__G = () => ({ G, C });
window.__drag = () => drag;
window.__busy = () => busy;
window.__scene = k => { curScene=null; applyScene(k); };

})();
