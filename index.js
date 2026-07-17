/**
 * 📜 Narrative Card - SillyTavern Extension
 * 사용자가 직접 드래그한 텍스트를 발췌해 카드 이미지로 만듭니다.
 */

import { getContext, extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

// ── 웹폰트 강제 로드 (기기별 시스템 폰트 차이 방지) ─────────
// 안드로이드/iOS 모두 한글 세리프(명조체) 시스템 폰트가 기본 설치돼 있지
// 않은 경우가 많아, CSS에 'Noto Serif KR'을 지정해도 기기에 따라 다른
// (주로 산세리프) 폰트로 렌더링되는 문제가 있음. Google Fonts를 통해
// 웹폰트를 직접 불러와서 항상 동일한 서체가 나오도록 고정함.
let _fontLoadPromise = null;
function ensureFontReady() {
    if (_fontLoadPromise) return _fontLoadPromise;

    _fontLoadPromise = (async () => {
        try {
            if (!document.getElementById('ncard-webfont-link')) {
                const link = document.createElement('link');
                link.id = 'ncard-webfont-link';
                link.rel = 'stylesheet';
                link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap';
                document.head.appendChild(link);
            }
            if (document.fonts && document.fonts.load) {
                await Promise.all([
                    document.fonts.load('16px "Noto Serif KR"'),
                    document.fonts.load('bold 16px "Noto Serif KR"'),
                ]);
            }
        } catch (e) {
            console.warn('[NarrativeCard] 웹폰트 로드 실패 (시스템 기본 폰트로 표시됨):', e);
        }
    })();

    return _fontLoadPromise;
}

// ── CSS 주입 ──────────────────────────────────────────────
function injectStyles() {
    if (document.getElementById('ncard-injected-css')) return;
    const style = document.createElement('style');
    style.id = 'ncard-injected-css';
    style.textContent = `
/* ── 마법봉 메뉴 항목 폰트 보정 (테마 CSS 미상속 대비) ─────── */
#ncard-wand-item {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: inherit;
    font-weight: normal;
}
#ncard-wand-item i { width: 16px; text-align: center; flex-shrink: 0; }

/* ── 드래그 선택 + 버튼 ─────────────────────────────────── */
.ncard-add-btn {
    position: fixed !important;
    z-index: 2147483646 !important;
    background: #fde97a;
    color: #5a4a00;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    font-size: 20px;
    font-weight: bold;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 3px 14px rgba(253,220,80,0.55), 0 2px 6px rgba(0,0,0,0.2);
    transition: transform .15s, background .15s, box-shadow .15s;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
}
.ncard-add-btn:hover,
.ncard-add-btn:active { background: #ffe44d; transform: scale(1.15); box-shadow: 0 4px 18px rgba(253,220,80,0.7), 0 2px 8px rgba(0,0,0,0.2); }

/* ── 발췌 팝업 ───────────────────────────────────────────── */
/*
 * 모바일 정중앙 고정을 위해 position:fixed + inset:0 + flex centering을
 * 모두 !important로 중복 선언합니다.
 * SillyTavern 내부 z-index 및 transform 충돌을 방지하기 위해
 * 최고 z-index(2147483647)를 사용합니다.
 */
.ncard-popup-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    height: 100dvh !important;
    min-width: 100vw !important;
    min-height: 100vh !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    -webkit-transform: none !important;
    background: transparent !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    pointer-events: none !important;
}
.ncard-popup-overlay > * { pointer-events: auto !important; }
.ncard-popup {
    position: relative !important;
    /* 절대 위치 지정 — 부모가 flex centering이므로 이것이 정중앙에 옵니다 */
    margin: auto !important;
    background: #ffffff;
    border-radius: 16px;
    width: min(92vw, 420px) !important;
    max-height: 82vh !important;
    max-height: 82dvh !important;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.35);
    border: 1px solid rgba(0,0,0,0.08);
    transform: none !important;
    -webkit-transform: none !important;
}
.ncard-popup-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px 10px;
    border-bottom: 1px solid rgba(0,0,0,0.1);
    flex-shrink: 0;
}
.ncard-popup-title {
    color: #1c1a17;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
}
.ncard-popup-close {
    cursor: pointer;
    opacity: 0.6;
    font-size: 20px;
    color: #1c1a17;
    line-height: 1;
    padding: 4px;
    touch-action: manipulation;
}
.ncard-popup-close:hover { opacity: 1; }

.ncard-popup-body {
    overflow-y: auto;
    padding: 14px 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.ncard-excerpt-item {
    background: rgba(0,0,0,0.04);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    position: relative;
}
.ncard-excerpt-text {
    flex: 1;
    color: #222;
    font-size: 13px;
    line-height: 1.6;
    word-break: break-all;
    white-space: pre-wrap;
}
.ncard-excerpt-del {
    flex-shrink: 0;
    cursor: pointer;
    opacity: 0.55;
    color: #d34848;
    font-size: 16px;
    touch-action: manipulation;
    padding: 2px 4px;
}
.ncard-excerpt-del:hover { opacity: 1; }
.ncard-excerpt-edit {
    flex-shrink: 0;
    cursor: pointer;
    opacity: 0.45;
    color: #555;
    font-size: 13px;
    touch-action: manipulation;
    padding: 2px 4px;
    line-height: 1;
}
.ncard-excerpt-edit:hover { opacity: 1; color: #d4a017; }
.ncard-excerpt-editing {
    background: rgba(212,160,23,0.08) !important;
    border: 1px solid rgba(212,160,23,0.35) !important;
}
.ncard-excerpt-textarea {
    flex: 1;
    font-size: 13px;
    line-height: 1.6;
    color: #222;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.18);
    border-radius: 6px;
    padding: 4px 8px;
    resize: vertical;
    min-height: 220px;
    font-family: inherit;
    word-break: break-all;
    box-sizing: border-box;
    width: 100%;
    outline: none;
}
.ncard-excerpt-textarea:focus { border-color: #d4a017; box-shadow: 0 0 0 2px rgba(212,160,23,0.15); }
.ncard-excerpt-editrow {
    display: flex;
    gap: 5px;
    margin-top: 6px;
    justify-content: flex-end;
}
.ncard-excerpt-save {
    padding: 3px 11px;
    border-radius: 6px;
    border: none;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    background: #d4a017;
    color: #1c1a17;
    touch-action: manipulation;
}
.ncard-excerpt-save:hover { background: #e0bb30; }
.ncard-excerpt-cancel {
    padding: 3px 11px;
    border-radius: 6px;
    border: none;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    background: rgba(0,0,0,0.07);
    color: #444;
    touch-action: manipulation;
}
.ncard-excerpt-cancel:hover { background: rgba(0,0,0,0.12); }
.ncard-excerpt-empty {
    color: rgba(0,0,0,0.35);
    font-size: 13px;
    text-align: center;
    padding: 24px 0;
}

/* 타입 선택 라디오 */
.ncard-type-row {
    display: flex;
    gap: 8px;
    margin-bottom: 2px;
}
.ncard-type-btn {
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid rgba(0,0,0,0.18);
    background: transparent;
    color: #555;
    font-size: 11px;
    cursor: pointer;
    touch-action: manipulation;
    transition: background .15s, color .15s;
}
.ncard-type-btn.active {
    background: #d4a017;
    color: #1c1a17;
    border-color: #d4a017;
    font-weight: 600;
}

.ncard-popup-foot {
    padding: 12px 16px;
    border-top: 1px solid rgba(0,0,0,0.1);
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}
.ncard-popup-foot button {
    flex: 1;
    padding: 10px 0;
    border-radius: 10px;
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
}
.ncard-btn-clear {
    background: rgba(0,0,0,0.06);
    color: #333;
}
.ncard-btn-gen {
    background: #d4a017;
    color: #1c1a17;
}
.ncard-btn-gen:hover { background: #e0bb30; }
.ncard-btn-gen:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 카드 인라인 표시 ─────────────────────────────────────── */
.ncard-wrap {
    display: flex;
    justify-content: center;
    margin-top: 16px;
    animation: ncard-drop .4s ease;
}
@keyframes ncard-drop {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
}
.ncard-img {
    max-width: 320px;
    width: 100%;
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0,0,0,.3);
    cursor: pointer;
}

/* ── 설정 패널 ─────────────────────────────────────────── */
.ncard-settings .inline-drawer-content { padding: 10px 4px; }
.ncard-field { margin-bottom: 10px; }
.ncard-field label {
    display: block;
    font-size: 12px;
    opacity: .8;
    margin-bottom: 3px;
}
.ncard-font-size-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
.ncard-font-size-row input[type=range] { flex: 1; }
.ncard-font-size-val {
    min-width: 32px;
    font-size: 12px;
    text-align: right;
    opacity: .8;
}

/* ── 갤러리 모달 ──────────────────────────────────────── */
.ncard-modal-overlay {
    position: fixed !important;
    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
    inset: 0 !important;
    width: 100vw !important; height: 100vh !important; height: 100dvh !important;
    margin: 0 !important;
    background: transparent !important;
    z-index: 2147483647 !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    transform: none !important;
    pointer-events: none !important;
}
.ncard-modal-overlay > * { pointer-events: auto !important; }
.ncard-modal {
    position: relative;
    background: #ffffff;
    border-radius: 12px;
    width: min(92vw, 900px);
    max-height: 86vh;
    max-height: 86dvh;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.35);
    border: 1px solid rgba(0,0,0,0.08);
}
.ncard-modal-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(0,0,0,.1);
    color: #1c1a17;
}
.ncard-modal-close { cursor: pointer; opacity: .7; font-size: 22px; color: #1c1a17; line-height: 1; padding: 2px 6px; touch-action: manipulation; }
.ncard-modal-close:hover { opacity: 1; }

/* ── 캐릭터 선택 드롭다운 ─────────────────────── */
.ncard-char-filter-row {
    padding: 10px 18px;
    border-bottom: 1px solid rgba(0,0,0,.08);
    display: flex; align-items: center; gap: 8px;
    background: #fafafa;
}
.ncard-char-filter-row label { font-size: 12px; color: #555; flex-shrink: 0; }
.ncard-char-filter-row select {
    flex: 1;
    background: #fff;
    color: #1c1a17;
    border: 1px solid rgba(0,0,0,.15);
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 13px;
}

/* ── 카드 뷰어(확대) 닫기 버튼 ───────────────────── */
.ncard-viewer-close {
    position: absolute;
    top: -14px;
    right: -14px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #fff;
    color: #1c1a17;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    touch-action: manipulation;
    z-index: 2;
}
.ncard-viewer-close:hover { transform: scale(1.08); }
.ncard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    grid-auto-rows: 220px;
    gap: 14px;
    padding: 18px;
    overflow-y: auto;
    background: #ffffff;
}
.ncard-grid img {
    width: 100%;
    border-radius: 8px;
    cursor: pointer;
    transition: transform .15s;
}
.ncard-grid img:hover { transform: scale(1.03); }

/* ── 갤러리 아이템 버튼행 ────────── */
.ncard-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); grid-auto-rows: 220px; gap: 14px; padding: 18px; overflow-y: auto; }

@media (max-width: 600px) {
    .ncard-img { max-width: 240px; }
    .ncard-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; padding: 12px; }
}
`;
    document.head.appendChild(style);
}

// 모바일 중앙 고정 폴백 CSS
function ensureFallbackStyles() {
    if (document.getElementById('ncard-fallback-css')) return;
    const style = document.createElement('style');
    style.id = 'ncard-fallback-css';
    style.textContent = `
.ncard-popup-overlay{position:fixed!important;inset:0!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;margin:0!important;padding:0!important;background:transparent!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;transform:none!important;-webkit-transform:none!important;}
.ncard-popup{position:relative!important;margin:auto!important;transform:none!important;-webkit-transform:none!important;background:#ffffff;color:#1c1a17;}
.ncard-modal-overlay{position:fixed!important;inset:0!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;margin:0!important;background:transparent!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;transform:none!important;}
.ncard-modal{background:#ffffff;border-radius:12px;width:min(92vw,900px);max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.35);color:#1c1a17;}
.ncard-wrap{display:flex;justify-content:center;margin-top:14px;}
.ncard-img{max-width:320px;width:100%;border-radius:10px;cursor:pointer;}
`;
    document.head.appendChild(style);
}

// ── 상수 ──────────────────────────────────────────────────
const EXT = 'narrative_card';

const THEMES = [
    // 기존 테마
    { value: 'dark',      label: '🌑 다크 (무지 + 세리프)',       bg: '#1c1a17', text: '#ffffff', sub: 'rgba(255,255,255,0.5)',  line: 'rgba(255,255,255,0.25)', meta: 'rgba(255,255,255,0.35)' },
    { value: 'light',     label: '☀️ 라이트 (무지 + 세리프)',     bg: '#f5f3ee', text: '#1c1a17', sub: 'rgba(28,26,23,0.55)',    line: 'rgba(28,26,23,0.25)',    meta: 'rgba(28,26,23,0.4)' },
    { value: 'cream',     label: '📜 크림 / 빈티지 페이퍼',       bg: '#ece3d1', text: '#2b2418', sub: 'rgba(43,36,24,0.55)',    line: 'rgba(43,36,24,0.3)',     meta: 'rgba(43,36,24,0.45)' },
    { value: 'spring',    label: '🌸 봄 (벚꽃 파스텔)',           bg: '#fdf1f4', text: '#5a2e3a', sub: 'rgba(170,90,110,0.65)',  line: 'rgba(214,140,160,0.5)',  meta: 'rgba(170,90,110,0.55)', accent: '#e8a3b3', deco: 'petals' },
    { value: 'summer',    label: '🌊 여름 (시원한 블루)',          bg: '#0f3a4a', text: '#ffffff', sub: 'rgba(255,255,255,0.6)',  line: 'rgba(135,220,235,0.4)', meta: 'rgba(255,255,255,0.45)', accent: '#7fd8e8', deco: 'waves' },
    { value: 'autumn',    label: '🍂 가을 (단풍 브라운)',          bg: '#2e1f14', text: '#f4e3c9', sub: 'rgba(244,227,201,0.6)', line: 'rgba(214,138,73,0.5)',   meta: 'rgba(244,227,201,0.5)', accent: '#d68a49', deco: 'leaves' },
    { value: 'winter',    label: '❄️ 겨울 (눈 내리는 네이비)',    bg: '#10182a', text: '#eef2fb', sub: 'rgba(238,242,251,0.55)', line: 'rgba(180,200,235,0.4)', meta: 'rgba(238,242,251,0.45)', accent: '#aac3ec', deco: 'snow' },
    // 신규 테마
    { value: 'midnight',  label: '🌙 미드나잇 퍼플',              bg: '#0e0b1a', text: '#e8e0ff', sub: 'rgba(200,180,255,0.55)', line: 'rgba(150,100,255,0.35)', meta: 'rgba(200,180,255,0.4)', accent: '#9b6dff', deco: 'stars' },
    { value: 'rosegold',  label: '🌹 로즈 골드',                  bg: '#1a0e0e', text: '#ffd9d9', sub: 'rgba(255,180,180,0.6)',  line: 'rgba(220,130,130,0.4)', meta: 'rgba(255,180,180,0.45)', accent: '#e8a0a0', deco: 'petals' },
    { value: 'forest',    label: '🌿 포레스트 그린',              bg: '#0d1f12', text: '#d4f0c8', sub: 'rgba(180,230,160,0.6)', line: 'rgba(100,180,80,0.4)',   meta: 'rgba(180,230,160,0.45)', accent: '#7bc86a', deco: 'leaves' },
    { value: 'neon',      label: '⚡ 네온 다크',                  bg: '#08080f', text: '#ffffff', sub: 'rgba(0,255,200,0.65)',   line: 'rgba(0,255,200,0.3)',   meta: 'rgba(0,255,200,0.45)', accent: '#00ffc8', deco: 'none' },
    { value: 'parchment', label: '📖 양피지 (세피아)',             bg: '#d9c9a3', text: '#2a1e0e', sub: 'rgba(42,30,14,0.6)',    line: 'rgba(42,30,14,0.3)',    meta: 'rgba(42,30,14,0.45)' },
    { value: 'mono',      label: '🖤 모노크롬 (신문 느낌)',        bg: '#f2f2f2', text: '#111111', sub: 'rgba(17,17,17,0.55)',   line: 'rgba(17,17,17,0.3)',    meta: 'rgba(17,17,17,0.4)' },
    { value: 'dusk',      label: '🌅 황혼 (오렌지-퍼플)',         bg: '#1a0f1f', text: '#ffe8cc', sub: 'rgba(255,180,100,0.6)', line: 'rgba(220,130,70,0.4)',  meta: 'rgba(255,180,100,0.45)', accent: '#ff9b4e', deco: 'petals' },
    // 파스텔 신규 테마
    { value: 'pastel_sky',    label: '🩵 파스텔 스카이',    bg: '#e8f4fd', text: '#2d5a7a', sub: 'rgba(45,90,122,0.6)',   line: 'rgba(100,170,220,0.4)', meta: 'rgba(45,90,122,0.45)',  accent: '#7ac0e8', deco: 'snow' },
    { value: 'pastel_lilac',  label: '💜 파스텔 라일락',    bg: '#f0ebfa', text: '#5a3a7a', sub: 'rgba(90,58,122,0.6)',   line: 'rgba(170,130,220,0.4)', meta: 'rgba(90,58,122,0.45)',  accent: '#b48ae0', deco: 'stars' },
    { value: 'pastel_peach',  label: '🍑 파스텔 피치',      bg: '#fff0e8', text: '#7a3a20', sub: 'rgba(122,58,32,0.6)',   line: 'rgba(220,140,100,0.4)', meta: 'rgba(122,58,32,0.45)',  accent: '#e8a070', deco: 'petals' },
    { value: 'pastel_mint',   label: '🌿 파스텔 민트',      bg: '#e8faf4', text: '#1a5a40', sub: 'rgba(26,90,64,0.6)',    line: 'rgba(80,190,140,0.4)',  meta: 'rgba(26,90,64,0.45)',   accent: '#60c8a0', deco: 'leaves' },
    { value: 'pastel_butter', label: '🌼 파스텔 버터',      bg: '#fdfae8', text: '#6a5a10', sub: 'rgba(106,90,16,0.6)',   line: 'rgba(210,190,80,0.4)',  meta: 'rgba(106,90,16,0.45)',  accent: '#d4c040', deco: 'petals' },
    // 독특한 신규 테마
    { value: 'bubblegum',   label: '🍬 버블검 (달콤한 핑크 팝)',  bg: '#ff9ec8', text: '#4a1535', sub: 'rgba(74,21,53,0.6)',    line: 'rgba(74,21,53,0.25)',   meta: 'rgba(74,21,53,0.5)',    accent: '#fff',    accent2: '#ffdf80', deco: 'bubblegum' },
    { value: 'galaxy',      label: '🌌 갤럭시 (우주 그라디언트)', bg: '#0a0015', text: '#e8d8ff', sub: 'rgba(232,216,255,0.55)', line: 'rgba(150,100,255,0.3)', meta: 'rgba(232,216,255,0.45)', accent: '#c78fff', accent2: '#7fffd4', deco: 'galaxy' },
    { value: 'cottagecore', label: '🌾 코티지코어 (들꽃과 나무)', bg: '#f7f0e3', text: '#3b2a14', sub: 'rgba(59,42,20,0.55)',   line: 'rgba(59,42,20,0.25)',   meta: 'rgba(59,42,20,0.45)',   accent: '#c9935a', accent2: '#7ab87a', deco: 'cottagecore' },
    // 신규 테마
    { value: 'meadow',      label: '🌿 풀밭',       bg: '#d8f0b0', text: '#1a3a0e', sub: 'rgba(26,58,14,0.6)',    line: 'rgba(80,160,40,0.35)',  meta: 'rgba(26,58,14,0.45)',   accent: '#7bc84a', accent2: '#4a9a20', deco: 'meadow' },
    { value: 'ocean',       label: '🌊 파도',       bg: '#0a2240', text: '#d0f0ff', sub: 'rgba(208,240,255,0.6)', line: 'rgba(100,200,240,0.35)',meta: 'rgba(208,240,255,0.45)', accent: '#50c8f0', accent2: '#1a6aaa', deco: 'ocean' },
    { value: 'aurora',      label: '🌌 오로라',     bg: '#060d18', text: '#c8f8e8', sub: 'rgba(200,248,232,0.6)', line: 'rgba(80,220,160,0.3)',  meta: 'rgba(200,248,232,0.45)', accent: '#40e8a0', accent2: '#8844ff', deco: 'aurora' },
    { value: 'polaroid',    label: '📷 폴라로이드', bg: '#ede8df', text: '#222222', sub: 'rgba(34,34,34,0.55)',   line: 'rgba(34,34,34,0.2)',    meta: 'rgba(34,34,34,0.4)',    accent: '#888888', deco: 'polaroid' },
    { value: 'newspaper',   label: '📰 신문',       bg: '#f5f2e8', text: '#111111', sub: 'rgba(17,17,17,0.55)',   line: 'rgba(17,17,17,0.5)',    meta: 'rgba(17,17,17,0.45)',   accent: '#111111', deco: 'newspaper' },
    { value: 'soap_bubble', label: '🫧 비눗방울',   bg: '#eef8ff', text: '#1a4a6a', sub: 'rgba(26,74,106,0.6)',   line: 'rgba(100,180,240,0.3)', meta: 'rgba(26,74,106,0.45)',  accent: '#80c8f0', accent2: '#b8e4ff', deco: 'soap_bubble' },
    // 심플 & 고급스러운 신규 테마
    { value: 'ivory_serif', label: '🤍 아이보리 세리프', bg: '#f7f5f0', text: '#20201c', sub: 'rgba(32,32,28,0.55)', line: 'rgba(32,32,28,0.15)', meta: 'rgba(32,32,28,0.4)', accent: '#20201c', deco: 'hairline' },
    { value: 'graphite',    label: '🖤 그라파이트',      bg: '#232323', text: '#eceae4', sub: 'rgba(236,234,228,0.55)', line: 'rgba(236,234,228,0.15)', meta: 'rgba(236,234,228,0.4)', accent: '#c9a24b', deco: 'corner' },
    { value: 'bone_gold',   label: '📜 본 골드',         bg: '#eee7d8', text: '#2b2418', sub: 'rgba(43,36,24,0.55)', line: '#9c8248', meta: 'rgba(43,36,24,0.45)', accent: '#9c8248', deco: 'frame' },
    { value: 'deep_navy',   label: '🔷 딥 네이비',       bg: '#141b26', text: '#eef1f5', sub: 'rgba(238,241,245,0.55)', line: 'rgba(180,160,110,0.4)', meta: 'rgba(238,241,245,0.4)', accent: '#b4a06e', deco: 'hairline' },
    // 귀여운 신규 테마
    { value: 'cloud_pop',   label: '☁️ 구름팝',          bg: '#eaf3ff', text: '#2e4a68', sub: 'rgba(46,74,104,0.6)', line: 'rgba(46,74,104,0.2)', meta: 'rgba(46,74,104,0.45)', accent: '#ffffff', accent2: '#ffffff', deco: 'clouds_pretty' },
    { value: 'lemon_soda',  label: '🍋 레몬소다',        bg: '#fff8dc', text: '#6a5a10', sub: 'rgba(106,90,16,0.6)', line: 'rgba(106,90,16,0.2)', meta: 'rgba(106,90,16,0.45)', accent: '#f0d868', deco: 'bubbles_big' },
];


const RATIOS = [
    { value: 'landscape', label: '🖼️ 가로형 (4:3)', w: 760, h: 570 },
    { value: 'portrait',  label: '📱 세로형 (3:4)', w: 570, h: 760 },
    { value: 'square',    label: '⬛ 정사각형 (1:1)', w: 640, h: 640 },
    { value: 'wide',      label: '🎞️ 와이드 (16:9)', w: 800, h: 450 },
];

const TEXT_COLORS = [
    { label: '기본',    value: null },
    { label: '흰색',    value: '#ffffff' },
    { label: '아이보리', value: '#f5f0e8' },
    { label: '골드',    value: '#d4a017' },
    { label: '연청',    value: '#aac3ec' },
    { label: '연분홍',  value: '#ffb8c8' },
    { label: '연두',    value: '#a8e4a0' },
    { label: '연보라',  value: '#c9b8ff' },
    { label: '피치',    value: '#ffcba4' },
    { label: '민트',    value: '#a8e8d8' },
    { label: '라임',    value: '#d4f078' },
    { label: '스카이',  value: '#b0d8ff' },
    { label: '코랄',    value: '#ff9b7c' },
    { label: '검정',    value: '#111111' },
    { label: '커스텀',  value: 'custom' },
];

const MARK_COLORS = [
    { label: '노랑',   value: '#ffe150' },
    { label: '핑크',   value: '#ff9ec8' },
    { label: '연두',   value: '#b0f090' },
    { label: '하늘',   value: '#8fd0ff' },
    { label: '보라',   value: '#c9a8ff' },
    { label: '오렌지', value: '#ffb060' },
    { label: '민트',   value: '#7ee8c8' },
    { label: '커스텀', value: 'custom' },
];

// hex 색상을 반투명 rgba 문자열로 변환 (형광펜 배경용)
function hexToRgba(hex, alpha = 0.55) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

const BG_COLORS = [
    { label: '테마 기본', value: null },
    { label: '흰색',   value: '#ffffff' },
    { label: '아이보리', value: '#f5f0e8' },
    { label: '베이지', value: '#ece3d1' },
    { label: '연청',   value: '#d6e8f7' },
    { label: '연분홍', value: '#fce8ee' },
    { label: '연두',   value: '#e4f7e0' },
    { label: '연보라', value: '#ede8ff' },
    { label: '피치',   value: '#ffeedd' },
    { label: '민트',   value: '#e0f7f2' },
    { label: '라임',   value: '#f2fad8' },
    { label: '스카이', value: '#e2f2ff' },
    { label: '검정',   value: '#111111' },
    { label: '남색',   value: '#10182a' },
    { label: '와인',   value: '#2a0e14' },
    { label: '포레스트', value: '#0d1f12' },
    { label: '커스텀', value: 'custom' },
];

const DEFAULTS = {
    theme: 'dark',
    font_size: 100,   // 100 = 기준치 (%)
    ratio: 'landscape',
};

function getExtSettings() {
    try {
        const ctx = (typeof getContext === 'function' ? getContext : SillyTavern.getContext)();
        if (!ctx.extensionSettings) return null;
        if (!ctx.extensionSettings[EXT]) ctx.extensionSettings[EXT] = {};
        return ctx.extensionSettings[EXT];
    } catch (e) {
        return extension_settings[EXT] || null;
    }
}

function cfg() {
    const s = getExtSettings();
    if (!s) return { ...DEFAULTS };
    return Object.assign({}, DEFAULTS, s);
}

// ── 드래그 선택 → + 버튼 ─────────────────────────────────

// 현재 발췌 목록 (팝업이 열려있는 동안 공유)
// { text, type: 'narration'|'quote' }
let excerptList = [];
let _addBtn = null;
let _lastMesEl = null;

function removeAddBtn() {
    if (_addBtn) { _addBtn.remove(); _addBtn = null; }
}

function showAddBtn(x, y, selectedText, mesEl) {
    removeAddBtn();
    const btn = document.createElement('button');
    btn.className = 'ncard-add-btn';
    btn.textContent = '+';
    btn.title = '발췌에 추가';
    btn.style.left = `${Math.min(x, window.innerWidth - 50)}px`;
    btn.style.top = `${Math.max(y - 48, 6)}px`;
    document.body.appendChild(btn);
    _addBtn = btn;

    const add = (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeAddBtn();
        // 발췌 추가 (중복 방지)
        const trimmed = selectedText.trim();
        if (!excerptList.some(item => item.text === trimmed)) {
            excerptList.push({ text: trimmed });
        }
        _lastMesEl = mesEl;
        // 팝업이 이미 열려있으면 목록만 갱신, 없으면 열기
        const existing = document.getElementById('ncard-popup-overlay');
        if (existing) {
            refreshPopupList();
        } else {
            openExcerptPopup(mesEl);
        }
        window.getSelection()?.removeAllRanges();
    };

    btn.addEventListener('pointerup', add);
    btn.addEventListener('touchend', add);
    btn.addEventListener('click', add);
}

// 채팅 영역의 mouseup / touchend 이벤트로 드래그 감지
document.addEventListener('mouseup', handleSelectionEnd, true);
document.addEventListener('touchend', handleSelectionEnd, true);
// selectionchange: 드래그 중에도 즉시 + 버튼 표시 (debounce 80ms)
document.addEventListener('selectionchange', () => {
    clearTimeout(window._ncardSelTimer);
    window._ncardSelTimer = setTimeout(() => handleSelectionEnd({ target: null }), 80);
});

function handleSelectionEnd(e) {
    // + 버튼 자체 클릭이면 무시
    if (e.target?.closest?.('.ncard-add-btn')) return;

    setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) { removeAddBtn(); return; }
        const text = sel.toString().trim();
        if (!text || text.length < 2) { removeAddBtn(); return; }

        // 채팅 메시지 내부에서만 동작
        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const mesEl = (container.nodeType === Node.TEXT_NODE ? container.parentElement : container)
            ?.closest?.('.mes');
        if (!mesEl) { removeAddBtn(); return; }

        // 위치 계산
        const rect = range.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + window.scrollY;

        showAddBtn(x, rect.top - 8, text, mesEl);
    }, 30);
}

// 다른 곳 클릭 시 + 버튼 제거
document.addEventListener('pointerdown', (e) => {
    if (!e.target?.closest?.('.ncard-add-btn')) removeAddBtn();
}, true);

// ── 발췌 팝업 ─────────────────────────────────────────────

function openExcerptPopup(mesEl) {
    if (document.getElementById('ncard-popup-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ncard-popup-overlay';
    overlay.className = 'ncard-popup-overlay';

    const popup = document.createElement('div');
    popup.className = 'ncard-popup';
    popup.setAttribute('style', 'position:relative!important;margin:auto!important;transform:none!important;');

    // 헤드
    const head = document.createElement('div');
    head.className = 'ncard-popup-head';
    head.innerHTML = `
        <div class="ncard-popup-title">📜 발췌 편집</div>
        <span class="ncard-popup-close" id="ncard-popup-close">&times;</span>
    `;

    // 바디
    const body = document.createElement('div');
    body.className = 'ncard-popup-body';
    body.id = 'ncard-popup-body';

    // 푸터
    const foot = document.createElement('div');
    foot.className = 'ncard-popup-foot';
    foot.innerHTML = `
        <button class="ncard-btn-clear" id="ncard-btn-clear">전체 삭제</button>
        <button class="ncard-btn-gen" id="ncard-btn-gen">🖼️ 카드 만들기</button>
    `;

    popup.appendChild(head);
    popup.appendChild(body);
    popup.appendChild(foot);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    refreshPopupList();

    // 이벤트
    document.getElementById('ncard-popup-close')?.addEventListener('click', closePopup);
    document.getElementById('ncard-popup-close')?.addEventListener('touchend', (e) => { e.preventDefault(); closePopup(); });

    overlay.addEventListener('pointerdown', (e) => {
        if (e.target === overlay) closePopup();
    });

    document.getElementById('ncard-btn-clear')?.addEventListener('click', () => {
        excerptList = [];
        refreshPopupList();
    });

    document.getElementById('ncard-btn-gen')?.addEventListener('click', () => {
        if (excerptList.length === 0) { toastr.warning('발췌된 텍스트가 없습니다.'); return; }
        closePopup();
        openPreviewPopup(mesEl || _lastMesEl);
    });
}

// 편집 텍스트 안의 **볼드**, ==형광펜== 마커를 화면용 HTML로 변환
// (실제 카드 렌더링 시에도 동일한 마커를 파싱해서 사용)
function markerToHtml(text) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = esc(text);
    html = html.replace(/==(.+?)==/g, '<mark style="background:#fff2a8;color:inherit;padding:0 1px;">$1</mark>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    return html;
}

function refreshPopupList() {
    const body = document.getElementById('ncard-popup-body');
    if (!body) return;
    body.innerHTML = '';

    if (excerptList.length === 0) {
        body.innerHTML = '<div class="ncard-excerpt-empty">텍스트를 드래그해서 +를 누르면<br>여기에 추가됩니다.</div>';
        return;
    }

    excerptList.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'ncard-excerpt-item';

        // ── 표시 모드 ──────────────────────────────────────
        const textEl = document.createElement('div');
        textEl.className = 'ncard-excerpt-text';
        textEl.innerHTML = markerToHtml(item.text);

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex;flex-direction:column;gap:2px;flex-shrink:0;';

        const editBtn = document.createElement('span');
        editBtn.className = 'ncard-excerpt-edit';
        editBtn.title = '수정';
        editBtn.innerHTML = '✏️';

        const delBtn = document.createElement('span');
        delBtn.className = 'ncard-excerpt-del';
        delBtn.innerHTML = '&times;';
        delBtn.title = '삭제';
        delBtn.addEventListener('click', () => { excerptList.splice(idx, 1); refreshPopupList(); });

        btnGroup.appendChild(editBtn);
        btnGroup.appendChild(delBtn);

        // ── 편집 모드 ──────────────────────────────────────
        const editWrap = document.createElement('div');
        editWrap.style.cssText = 'display:none;flex-direction:column;flex:1;gap:0;';

        const textarea = document.createElement('textarea');
        textarea.className = 'ncard-excerpt-textarea';
        textarea.value = item.text;

        // 굵게 / 형광펜 툴바 — 텍스트를 드래그로 선택하고 버튼만 누르면 마커가 자동으로 붙음
        const markToolbar = document.createElement('div');
        markToolbar.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;flex-shrink:0;';

        function applyMarker(prefix, suffix) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            if (start === end) { toastr.info('굵게/형광펜 처리할 부분을 먼저 드래그해서 선택해줘'); return; }
            const val = textarea.value;
            const selected = val.slice(start, end);
            textarea.value = val.slice(0, start) + prefix + selected + suffix + val.slice(end);
            const newPos = end + prefix.length + suffix.length;
            textarea.focus();
            textarea.setSelectionRange(newPos, newPos);
        }

        const boldBtn = document.createElement('button');
        boldBtn.type = 'button';
        boldBtn.textContent = '𝐁 굵게';
        boldBtn.style.cssText = 'font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.18);background:#fff;color:#1c1a17;cursor:pointer;font-weight:700;';
        boldBtn.addEventListener('click', () => applyMarker('**', '**'));

        const markBtn = document.createElement('button');
        markBtn.type = 'button';
        markBtn.textContent = '🖍️ 형광펜';
        markBtn.style.cssText = 'font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.18);background:#fff2a8;color:#1c1a17;cursor:pointer;';
        markBtn.addEventListener('click', () => applyMarker('==', '=='));

        markToolbar.appendChild(boldBtn);
        markToolbar.appendChild(markBtn);

        const editRow = document.createElement('div');
        editRow.className = 'ncard-excerpt-editrow';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'ncard-excerpt-cancel';
        cancelBtn.textContent = '취소';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'ncard-excerpt-save';
        saveBtn.textContent = '저장';

        editRow.appendChild(cancelBtn);
        editRow.appendChild(saveBtn);
        editWrap.appendChild(markToolbar);
        editWrap.appendChild(textarea);
        editWrap.appendChild(editRow);

        // ── 모드 전환 ──────────────────────────────────────
        function enterEdit() {
            textEl.style.display = 'none';
            btnGroup.style.display = 'none';
            editWrap.style.display = 'flex';
            row.classList.add('ncard-excerpt-editing');
            textarea.focus();
            // 커서를 텍스트 끝으로
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }

        function exitEdit() {
            textEl.style.display = '';
            btnGroup.style.display = '';
            editWrap.style.display = 'none';
            row.classList.remove('ncard-excerpt-editing');
        }

        editBtn.addEventListener('click', enterEdit);

        cancelBtn.addEventListener('click', () => {
            textarea.value = item.text; // 원래 텍스트로 복원
            exitEdit();
        });

        saveBtn.addEventListener('click', () => {
            const newText = textarea.value.trim();
            if (newText) {
                excerptList[idx].text = newText;
                textEl.innerHTML = markerToHtml(newText);
            }
            exitEdit();
        });

        // Ctrl+Enter / Cmd+Enter 로 저장
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                saveBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });

        row.appendChild(textEl);
        row.appendChild(editWrap);
        row.appendChild(btnGroup);
        body.appendChild(row);
    });
}

function closePopup() {
    document.getElementById('ncard-popup-overlay')?.remove();
}

// 갤러리 "수정"으로 들어올 때, 복원할 스타일 값을 임시로 담아두는 곳
let _pendingEditMeta = null;

// ── 발췌 목록으로 카드 렌더링 ────────────────────────────


// ── 미리보기 팝업 (글씨크기/테마/비율/글자색 조절) ────────
function openPreviewPopup(mesEl) {
    const c = cfg();
    _previewState = {
        theme: c.theme,
        fontSize: c.font_size || 100,
        ratio: c.ratio || 'landscape',
        textColor: null,
        bgColor: null,
        bgImage: null,       // 로드된 Image 객체 (배경 사진)
        overlayOpacity: 50,  // 사진 위 오버레이 투명도 (%)
        charName: getCharacterName(), // 카드 하단에 표시될 이름 (수정 가능)
        markColor: null, // 형광펜 색 (null이면 기본 노랑)
    };
    // 갤러리에서 "수정"으로 들어온 경우, 저장돼 있던 스타일 값을 덮어씀
    // (옛날 카드는 style 정보가 없을 수 있으므로 undefined 값은 기본값을 유지)
    if (_pendingEditMeta) {
        Object.entries(_pendingEditMeta).forEach(([k, v]) => {
            if (v !== undefined) _previewState[k] = v;
        });
        _pendingEditMeta = null;
    }

    const overlay = document.createElement('div');
    overlay.className = 'ncard-popup-overlay';
    overlay.style.cssText = 'position:fixed!important;inset:0!important;background:transparent!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;transform:none!important;overflow-y:auto!important;';

    const modal = document.createElement('div');
    modal.className = 'ncard-popup';
    modal.style.cssText = 'position:relative!important;margin:auto!important;width:min(96vw,520px)!important;max-height:94vh!important;';

    // 헤드
    const head = document.createElement('div');
    head.className = 'ncard-popup-head';
    head.innerHTML = '<div class="ncard-popup-title">🎨 카드 옵션 &amp; 미리보기</div>';
    const hClose = document.createElement('span');
    hClose.className = 'ncard-popup-close';
    hClose.innerHTML = '&times;';
    hClose.addEventListener('click', () => overlay.remove());
    head.appendChild(hClose);

    // 미리보기 이미지
    const prevWrap = document.createElement('div');
    prevWrap.style.cssText = 'display:flex;justify-content:center;align-items:center;padding:14px;background:#f2f2f2;min-height:140px;';
    const prevImg = document.createElement('img');
    prevImg.id = 'ncard-prev-img';
    prevImg.style.cssText = 'max-width:100%;max-height:240px;border-radius:8px;object-fit:contain;';
    prevWrap.appendChild(prevImg);

    // 컨트롤 바디
    const body = document.createElement('div');
    body.className = 'ncard-popup-body';
    body.style.gap = '12px';

    // 헬퍼: 라벨+컨텐츠 행
    function ctrlRow(labelText, contentEl) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:12px;color:rgba(0,0,0,0.6);min-width:68px;flex-shrink:0;';
        lbl.textContent = labelText;
        row.appendChild(lbl);
        row.appendChild(contentEl);
        return row;
    }

    // 0) 캐릭터 이름 (카드 하단에 표시됨, 수정 가능)
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = _previewState.charName || '';
    nameInput.placeholder = '이름 없음';
    nameInput.style.cssText = 'flex:1;background:#ffffff;color:#1c1a17;border:1px solid rgba(0,0,0,0.18);border-radius:8px;padding:5px 8px;font-size:12px;';
    let nameDebounce;
    nameInput.addEventListener('input', () => {
        _previewState.charName = nameInput.value;
        clearTimeout(nameDebounce);
        nameDebounce = setTimeout(doPreview, 200);
    });
    body.appendChild(ctrlRow('이름', nameInput));

    // 1) 테마
    const themeSelect = document.createElement('select');
    themeSelect.style.cssText = 'flex:1;background:#ffffff;color:#1c1a17;border:1px solid rgba(0,0,0,0.18);border-radius:8px;padding:5px 8px;font-size:12px;';
    THEMES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.value; opt.textContent = t.label;
        if (t.value === _previewState.theme) opt.selected = true;
        themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener('change', () => { _previewState.theme = themeSelect.value; doPreview(); });
    body.appendChild(ctrlRow('테마', themeSelect));

    // 1.5) 배경색 (테마 기본 or 커스텀)
    const bgColorWrap = document.createElement('div');
    bgColorWrap.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:1;';
    let _customBgColorVal = '#ffffff';
    function selectBgSwatch(targetSw, colorVal) {
        bgColorWrap.querySelectorAll('.ncard-bgsw').forEach(s => {
            s.style.borderColor = 'transparent';
            s.style.transform = '';
        });
        targetSw.style.borderColor = '#1c1a17';
        targetSw.style.transform = 'scale(1.2)';
        _previewState.bgColor = colorVal;
        doPreview();
    }
    BG_COLORS.forEach(col => {
        if (col.value === 'custom') {
            const cpWrap = document.createElement('div');
            cpWrap.className = 'ncard-bgsw';
            cpWrap.title = '커스텀 배경색';
            cpWrap.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;flex-shrink:0;position:relative;overflow:hidden;transition:transform .12s;background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);';
            const cpInput = document.createElement('input');
            cpInput.type = 'color';
            cpInput.value = _customBgColorVal;
            cpInput.style.cssText = 'position:absolute;inset:-4px;opacity:0.001;width:calc(100%+8px);height:calc(100%+8px);cursor:pointer;border:none;padding:0;margin:0;';
            cpInput.addEventListener('change', () => {
                _customBgColorVal = cpInput.value;
                cpWrap.style.background = cpInput.value;
                selectBgSwatch(cpWrap, cpInput.value);
            });
            cpInput.addEventListener('input', () => {
                _customBgColorVal = cpInput.value;
                cpWrap.style.background = cpInput.value;
                selectBgSwatch(cpWrap, cpInput.value);
            });
            cpWrap.appendChild(cpInput);
            bgColorWrap.appendChild(cpWrap);
        } else {
            const sw = document.createElement('div');
            sw.className = 'ncard-bgsw';
            sw.title = col.label;
            const isDefault = col.value === null;
            sw.style.cssText = 'width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid transparent;flex-shrink:0;transition:transform .12s;';
            sw.style.background = isDefault
                ? 'linear-gradient(135deg,#d4a017 50%,#1c1a17 50%)'
                : col.value;
            if (col.value !== null) sw.style.border = '2px solid rgba(0,0,0,0.15)';
            if (_previewState.bgColor === col.value) {
                sw.style.borderColor = '#1c1a17';
                sw.style.transform = 'scale(1.2)';
            }
            sw.addEventListener('click', () => selectBgSwatch(sw, col.value));
            bgColorWrap.appendChild(sw);
        }
    });
    body.appendChild(ctrlRow('배경색', bgColorWrap));

    // 1.6) 배경 사진 (기기 갤러리에서 선택)
    const bgPhotoWrap = document.createElement('div');
    bgPhotoWrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;flex-wrap:wrap;';

    const bgPhotoInput = document.createElement('input');
    bgPhotoInput.type = 'file';
    bgPhotoInput.accept = 'image/*';
    bgPhotoInput.style.display = 'none';

    const bgPhotoBtn = document.createElement('button');
    bgPhotoBtn.type = 'button';
    bgPhotoBtn.className = 'ncard-type-btn';
    bgPhotoBtn.style.fontSize = '11px';
    bgPhotoBtn.textContent = '🖼️ 사진 선택';
    bgPhotoBtn.addEventListener('click', () => bgPhotoInput.click());

    const bgPhotoThumb = document.createElement('img');
    bgPhotoThumb.style.cssText = 'width:26px;height:26px;border-radius:6px;object-fit:cover;display:none;border:1px solid rgba(0,0,0,0.15);flex-shrink:0;';

    const bgPhotoClear = document.createElement('span');
    bgPhotoClear.textContent = '✕ 제거';
    bgPhotoClear.style.cssText = 'font-size:11px;color:#d34848;cursor:pointer;display:none;touch-action:manipulation;';

    bgPhotoInput.addEventListener('change', () => {
        const file = bgPhotoInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                _previewState.bgImage = img;
                bgPhotoThumb.src = reader.result;
                bgPhotoThumb.style.display = 'block';
                bgPhotoClear.style.display = 'inline';
                opacitySlider.disabled = false;
                opacityRow.style.opacity = '1';
                doPreview();
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });

    bgPhotoClear.addEventListener('click', () => {
        _previewState.bgImage = null;
        bgPhotoInput.value = '';
        bgPhotoThumb.style.display = 'none';
        bgPhotoClear.style.display = 'none';
        opacitySlider.disabled = true;
        opacityRow.style.opacity = '0.4';
        doPreview();
    });

    bgPhotoWrap.appendChild(bgPhotoBtn);
    bgPhotoWrap.appendChild(bgPhotoThumb);
    bgPhotoWrap.appendChild(bgPhotoClear);
    bgPhotoWrap.appendChild(bgPhotoInput);
    body.appendChild(ctrlRow('배경 사진', bgPhotoWrap));

    // 1.7) 오버레이 투명도 (사진 위에 톤을 깔아서 글씨 가독성 확보)
    const opacityWrap = document.createElement('div');
    opacityWrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;';
    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = 0; opacitySlider.max = 90; opacitySlider.step = 5;
    opacitySlider.value = _previewState.overlayOpacity;
    opacitySlider.disabled = true;
    opacitySlider.style.flex = '1';
    const opacityVal = document.createElement('span');
    opacityVal.style.cssText = 'font-size:12px;color:rgba(0,0,0,0.55);min-width:32px;text-align:right;';
    opacityVal.textContent = _previewState.overlayOpacity + '%';
    opacitySlider.addEventListener('input', () => {
        _previewState.overlayOpacity = parseInt(opacitySlider.value, 10);
        opacityVal.textContent = opacitySlider.value + '%';
        doPreview();
    });
    opacityWrap.appendChild(opacitySlider);
    opacityWrap.appendChild(opacityVal);
    const opacityRow = ctrlRow('오버레이', opacityWrap);
    opacityRow.style.opacity = '0.4';
    body.appendChild(opacityRow);

    // 수정 모드로 들어온 경우, 저장돼 있던 배경 사진/오버레이 상태 복원
    if (_previewState.bgImage) {
        bgPhotoThumb.src = _previewState.bgImage.src;
        bgPhotoThumb.style.display = 'block';
        bgPhotoClear.style.display = 'inline';
        opacitySlider.disabled = false;
        opacitySlider.value = _previewState.overlayOpacity;
        opacityVal.textContent = _previewState.overlayOpacity + '%';
        opacityRow.style.opacity = '1';
    }

    // 2) 카드 비율
    const ratioWrap = document.createElement('div');
    ratioWrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;flex:1;';
    RATIOS.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'ncard-type-btn' + (r.value === _previewState.ratio ? ' active' : '');
        btn.textContent = r.label;
        btn.style.fontSize = '11px';
        btn.addEventListener('click', () => {
            _previewState.ratio = r.value;
            ratioWrap.querySelectorAll('.ncard-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            doPreview();
        });
        ratioWrap.appendChild(btn);
    });
    body.appendChild(ctrlRow('카드 크기', ratioWrap));

    // 3) 글씨 크기
    const fsWrap = document.createElement('div');
    fsWrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;';
    const fsSlider = document.createElement('input');
    fsSlider.type = 'range'; fsSlider.min = 60; fsSlider.max = 300; fsSlider.step = 5;
    fsSlider.value = _previewState.fontSize;
    fsSlider.style.flex = '1';
    const fsVal = document.createElement('span');
    fsVal.style.cssText = 'font-size:12px;color:rgba(0,0,0,0.55);min-width:36px;text-align:right;';
    fsVal.textContent = _previewState.fontSize + '%';
    fsSlider.addEventListener('input', () => {
        _previewState.fontSize = parseInt(fsSlider.value);
        fsVal.textContent = fsSlider.value + '%';
        doPreview();
    });
    fsWrap.appendChild(fsSlider);
    fsWrap.appendChild(fsVal);
    body.appendChild(ctrlRow('글씨 크기', fsWrap));

    // 4) 글자색
    const colorWrap = document.createElement('div');
    colorWrap.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:1;';
    let _customColorVal = '#ffffff';
    function selectSwatch(targetSw, colorVal) {
        colorWrap.querySelectorAll('.ncard-sw').forEach(s => {
            s.style.borderColor = 'transparent';
            s.style.transform = '';
        });
        targetSw.style.borderColor = '#1c1a17';
        targetSw.style.transform = 'scale(1.2)';
        _previewState.textColor = colorVal;
        doPreview();
    }
    TEXT_COLORS.forEach(col => {
        if (col.value === 'custom') {
            // 커스텀: 진짜 컬러피커 (전체 색상 선택 가능)
            const cpWrap = document.createElement('div');
            cpWrap.className = 'ncard-sw';
            cpWrap.title = '커스텀 색상';
            cpWrap.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;flex-shrink:0;position:relative;overflow:hidden;transition:transform .12s;background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);';
            // input을 완전히 덮어서 클릭 시 OS 네이티브 컬러피커가 열리게
            const cpInput = document.createElement('input');
            cpInput.type = 'color';
            cpInput.value = _customColorVal;
            cpInput.style.cssText = 'position:absolute;inset:-4px;opacity:0.001;width:calc(100%+8px);height:calc(100%+8px);cursor:pointer;border:none;padding:0;margin:0;';
            cpInput.addEventListener('change', () => {
                _customColorVal = cpInput.value;
                cpWrap.style.background = cpInput.value;
                selectSwatch(cpWrap, cpInput.value);
            });
            cpInput.addEventListener('input', () => {
                _customColorVal = cpInput.value;
                cpWrap.style.background = cpInput.value;
                selectSwatch(cpWrap, cpInput.value);
            });
            cpWrap.appendChild(cpInput);
            colorWrap.appendChild(cpWrap);
        } else {
            const sw = document.createElement('div');
            sw.className = 'ncard-sw';
            sw.title = col.label;
            const isDefault = col.value === null;
            sw.style.cssText = 'width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid transparent;flex-shrink:0;transition:transform .12s;';
            sw.style.background = isDefault
                ? 'linear-gradient(135deg,#d4a017 50%,#1c1a17 50%)'
                : col.value;
            if (_previewState.textColor === col.value) {
                sw.style.borderColor = '#1c1a17';
                sw.style.transform = 'scale(1.2)';
            }
            sw.addEventListener('click', () => selectSwatch(sw, col.value));
            colorWrap.appendChild(sw);
        }
    });
    body.appendChild(ctrlRow('글자색', colorWrap));

    // 4.5) 형광펜 색
    const markWrap = document.createElement('div');
    markWrap.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:1;';
    let _customMarkColorVal = '#ffe150';
    function selectMarkSwatch(targetSw, colorVal) {
        markWrap.querySelectorAll('.ncard-marksw').forEach(s => {
            s.style.borderColor = 'transparent';
            s.style.transform = '';
        });
        targetSw.style.borderColor = '#1c1a17';
        targetSw.style.transform = 'scale(1.2)';
        _previewState.markColor = colorVal;
        doPreview();
    }
    MARK_COLORS.forEach(col => {
        if (col.value === 'custom') {
            const cpWrap = document.createElement('div');
            cpWrap.className = 'ncard-marksw';
            cpWrap.title = '커스텀 형광펜 색';
            cpWrap.style.cssText = 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;flex-shrink:0;position:relative;overflow:hidden;transition:transform .12s;background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);';
            const cpInput = document.createElement('input');
            cpInput.type = 'color';
            cpInput.value = _customMarkColorVal;
            cpInput.style.cssText = 'position:absolute;inset:-4px;opacity:0.001;width:calc(100%+8px);height:calc(100%+8px);cursor:pointer;border:none;padding:0;margin:0;';
            cpInput.addEventListener('change', () => {
                _customMarkColorVal = cpInput.value;
                cpWrap.style.background = cpInput.value;
                selectMarkSwatch(cpWrap, cpInput.value);
            });
            cpInput.addEventListener('input', () => {
                _customMarkColorVal = cpInput.value;
                cpWrap.style.background = cpInput.value;
                selectMarkSwatch(cpWrap, cpInput.value);
            });
            cpWrap.appendChild(cpInput);
            markWrap.appendChild(cpWrap);
        } else {
            const sw = document.createElement('div');
            sw.className = 'ncard-marksw';
            sw.title = col.label;
            sw.style.cssText = 'width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid transparent;flex-shrink:0;transition:transform .12s;';
            sw.style.background = col.value;
            if (_previewState.markColor === col.value) {
                sw.style.borderColor = '#1c1a17';
                sw.style.transform = 'scale(1.2)';
            }
            sw.addEventListener('click', () => selectMarkSwatch(sw, col.value));
            markWrap.appendChild(sw);
        }
    });
    body.appendChild(ctrlRow('형광펜', markWrap));

    // 푸터
    const foot = document.createElement('div');
    foot.className = 'ncard-popup-foot';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'ncard-btn-clear';
    btnCancel.textContent = '취소';
    btnCancel.addEventListener('click', () => overlay.remove());
    const btnGen = document.createElement('button');
    btnGen.className = 'ncard-btn-gen';
    btnGen.textContent = '✅ 카드 생성';
    btnGen.addEventListener('click', async () => {
        overlay.remove();
        await runGenerate(mesEl);
    });
    foot.appendChild(btnCancel);
    foot.appendChild(btnGen);

    modal.appendChild(head);
    modal.appendChild(prevWrap);
    modal.appendChild(body);
    modal.appendChild(foot);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) overlay.remove(); });

    async function doPreview() {
        await ensureFontReady();
        const charName = _previewState.charName;
        const mesId = mesEl?.getAttribute('mesid');
        const cardData = {
            speaker: charName, location: '',
            lines: excerptList.map(item => ({ text: item.text })),
        };
        const url = renderCard(cardData, _previewState.theme, charName, mesId,
            _previewState.fontSize, _previewState.ratio, _previewState.textColor, _previewState.bgColor,
            _previewState.bgImage, _previewState.overlayOpacity, _previewState.markColor);
        document.getElementById('ncard-prev-img').src = url;
    }
    doPreview();
}

// 현재 미리보기/생성 옵션 상태
let _previewState = null;
// 갤러리에서 "수정"으로 들어온 경우, 새로 저장하지 않고 이 id의 카드를 덮어씀
let _editingCardId = null;

async function runGenerate(mesEl) {
    try {
        await ensureFontReady();
        const c = cfg();
        const state = _previewState || {};
        // 빈 문자열(이름 없음)도 유효한 값으로 취급 — state 자체가 없을 때만 기본 이름 사용
        const charName = (state.charName !== undefined && state.charName !== null)
            ? state.charName
            : getCharacterName();
        const mesId = mesEl?.getAttribute('mesid');

        const cardData = {
            speaker: charName,
            location: '',
            lines: excerptList.map(item => ({ text: item.text })),
        };

        const dataUrl = renderCard(
            cardData,
            state.theme || c.theme,
            charName,
            mesId,
            state.fontSize || c.font_size,
            state.ratio || c.ratio || 'landscape',
            state.textColor || null,
            state.bgColor || null,
            state.bgImage || null,
            state.overlayOpacity ?? 50,
            state.markColor || null
        );

        // 갤러리 저장/수정용 meta (스타일 옵션 전체 포함 — 나중에 수정 시 복원용)
        const metaToSave = {
            timestamp: new Date().toISOString(),
            cardData,
            style: {
                theme: state.theme || c.theme,
                fontSize: state.fontSize || c.font_size,
                markColor: state.markColor || null,
                ratio: state.ratio || c.ratio || 'landscape',
                textColor: state.textColor || null,
                bgColor: state.bgColor || null,
                overlayOpacity: state.overlayOpacity ?? 50,
                bgImageDataUrl: state.bgImage ? state.bgImage.src : null,
            },
        };

        let savedId;
        if (_editingCardId) {
            await updateGalleryItem(_editingCardId, dataUrl, metaToSave, charName);
            savedId = _editingCardId;
            _editingCardId = null;
        } else {
            savedId = await saveToGallery(charName, dataUrl, metaToSave);
        }

        // 초기화
        excerptList = [];
        _lastMesEl = null;
        _previewState = null;

        // 생성 완료 팝업
        openResultPopup(dataUrl, savedId);

        toastr.success('📜 카드 생성 완료!', '', { timeOut: 1500 });
    } catch (e) {
        console.error('[NarrativeCard] 오류:', e);
        toastr.error(e.message || '카드 생성 실패', '', { timeOut: 5000 });
    }
}

function openResultPopup(dataUrl, savedId) {
    const overlay = document.createElement('div');
    overlay.className = 'ncard-popup-overlay';
    overlay.style.cssText = 'position:fixed!important;inset:0!important;background:transparent!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;transform:none!important;';

    const modal = document.createElement('div');
    modal.className = 'ncard-popup';
    modal.style.cssText = 'position:relative!important;margin:auto!important;width:min(92vw,460px)!important;';

    const head = document.createElement('div');
    head.className = 'ncard-popup-head';
    head.innerHTML = '<div class="ncard-popup-title">📜 카드 생성 완료</div>';
    const hClose = document.createElement('span');
    hClose.className = 'ncard-popup-close';
    hClose.innerHTML = '&times;';
    hClose.addEventListener('click', () => overlay.remove());
    head.appendChild(hClose);

    const imgWrap = document.createElement('div');
    imgWrap.style.cssText = 'display:flex;justify-content:center;padding:14px;background:#f2f2f2;';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'max-width:100%;max-height:300px;border-radius:8px;object-fit:contain;';
    imgWrap.appendChild(img);

    const foot = document.createElement('div');
    foot.className = 'ncard-popup-foot';

    const btnDel = document.createElement('button');
    btnDel.className = 'ncard-btn-clear';
    btnDel.style.color = '#d34848';
    btnDel.textContent = '🗑️ 삭제';
    btnDel.addEventListener('click', async () => {
        // 확인창 없이 바로 삭제
        await deleteCard(savedId);
        overlay.remove();
    });

    const btnDl = document.createElement('button');
    btnDl.className = 'ncard-btn-gen';
    btnDl.textContent = '💾 이미지 저장';
    btnDl.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'narrative_card_' + Date.now() + '.png';
        a.click();
    });

    foot.appendChild(btnDel);
    foot.appendChild(btnDl);
    modal.appendChild(head);
    modal.appendChild(imgWrap);
    modal.appendChild(foot);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ── 캐릭터 이름 ──────────────────────────────────────────
function getCharacterName() {
    try {
        const ctx = getContext();
        if (ctx.characters && ctx.characterId !== undefined) {
            return ctx.characters[ctx.characterId]?.name || '';
        }
    } catch (_) {}
    return '';
}

// ── 계절/테마 장식 그리기 ───────────────────────────────
function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

function drawDecoration(ctx, W, H, theme) {
    if (!theme.deco || theme.deco === 'none') return;
    const rand = seededRandom(42);
    ctx.save();

    if (theme.deco === 'petals') {
        for (let i = 0; i < 14; i++) {
            const x = rand() * W;
            const y = rand() * H * 0.35 + (rand() > 0.5 ? H * 0.65 : 0);
            const r = 4 + rand() * 5;
            const rot = rand() * Math.PI * 2;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rot);
            ctx.fillStyle = theme.accent;
            ctx.globalAlpha = 0.18 + rand() * 0.15;
            ctx.beginPath();
            ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    } else if (theme.deco === 'waves') {
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 1.5;
        for (let row = 0; row < 3; row++) {
            const baseY = H - 40 - row * 14;
            ctx.beginPath();
            for (let x = 0; x <= W; x += 8) {
                const y = baseY + Math.sin((x / 40) + row) * 4;
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 0.08;
        for (let row = 0; row < 2; row++) {
            const baseY = 30 + row * 12;
            ctx.beginPath();
            for (let x = 0; x <= W; x += 8) {
                const y = baseY + Math.sin((x / 35) + row + 1) * 3;
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    } else if (theme.deco === 'leaves') {
        for (let i = 0; i < 10; i++) {
            const x = rand() * W;
            const y = rand() * H * 0.3 + (rand() > 0.5 ? H * 0.7 : 0);
            const r = 5 + rand() * 6;
            const rot = rand() * Math.PI * 2;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rot);
            ctx.fillStyle = theme.accent;
            ctx.globalAlpha = 0.16 + rand() * 0.14;
            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.quadraticCurveTo(r * 0.8, 0, 0, r);
            ctx.quadraticCurveTo(-r * 0.8, 0, 0, -r);
            ctx.fill();
            ctx.restore();
        }
    } else if (theme.deco === 'snow') {
        for (let i = 0; i < 26; i++) {
            const x = rand() * W;
            const y = rand() * H;
            const r = 1 + rand() * 2.2;
            ctx.fillStyle = theme.accent;
            ctx.globalAlpha = 0.2 + rand() * 0.25;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (theme.deco === 'stars') {
        // 별: 미드나잇 퍼플 테마
        for (let i = 0; i < 30; i++) {
            const x = rand() * W;
            const y = rand() * H;
            const r = 0.8 + rand() * 1.8;
            ctx.fillStyle = theme.accent || '#fff';
            ctx.globalAlpha = 0.15 + rand() * 0.3;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

    } else if (theme.deco === 'bubblegum') {
        // ── 버블검: 핑크 그라디언트 + 물방울 + 별 반짝이 ──
        const grd = ctx.createLinearGradient(0, 0, W, H);
        grd.addColorStop(0, '#ffb3d9');
        grd.addColorStop(0.5, '#ff9ec8');
        grd.addColorStop(1, '#ffd6ec');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);

        // 물방울 도트
        const dots = [
            { c: '#fff', r: 14, x: 0.08, y: 0.10, a: 0.18 }, { c: '#fff', r: 8,  x: 0.18, y: 0.22, a: 0.13 },
            { c: '#ffdf80', r: 10, x: 0.88, y: 0.08, a: 0.22 }, { c: '#fff', r: 6,  x: 0.95, y: 0.20, a: 0.16 },
            { c: '#ffdf80', r: 18, x: 0.04, y: 0.85, a: 0.14 }, { c: '#fff', r: 9,  x: 0.15, y: 0.92, a: 0.20 },
            { c: '#ffdf80', r: 12, x: 0.90, y: 0.88, a: 0.18 }, { c: '#fff', r: 7,  x: 0.78, y: 0.95, a: 0.14 },
            { c: '#fff', r: 5,  x: 0.50, y: 0.06, a: 0.15 }, { c: '#ffdf80', r: 7,  x: 0.60, y: 0.94, a: 0.18 },
            { c: '#fff', r: 11, x: 0.35, y: 0.05, a: 0.12 }, { c: '#ffdf80', r: 5,  x: 0.72, y: 0.07, a: 0.19 },
        ];
        dots.forEach(d => {
            ctx.globalAlpha = d.a;
            ctx.fillStyle = d.c;
            ctx.beginPath();
            ctx.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // 별 반짝이
        const sparkles = [[0.12,0.18],[0.85,0.14],[0.05,0.75],[0.92,0.82],[0.45,0.08],[0.58,0.92]];
        sparkles.forEach(([sx, sy]) => {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.round(W * 0.025)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✦', sx * W, sy * H);
        });

        // 상단 흰 물결 장식
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
            const wy = 18 + Math.sin(x / 18) * 6;
            if (x === 0) ctx.moveTo(x, 0); else ctx.lineTo(x, wy);
        }
        ctx.lineTo(W, 0);
        ctx.closePath();
        ctx.fill();

    } else if (theme.deco === 'galaxy') {
        // ── 갤럭시: 딥 스페이스 방사형 그라디언트 + 성운 + 별 ──
        const grd = ctx.createRadialGradient(W * 0.35, H * 0.35, 0, W * 0.5, H * 0.5, W * 0.75);
        grd.addColorStop(0, '#2d005a');
        grd.addColorStop(0.4, '#14003a');
        grd.addColorStop(0.8, '#0a0015');
        grd.addColorStop(1, '#030008');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);

        // 작은 별
        for (let i = 0; i < 70; i++) {
            const x = rand() * W, y = rand() * H, r = 0.5 + rand() * 1.5;
            ctx.globalAlpha = 0.2 + rand() * 0.6;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // 성운 광채
        [
            { x: 0.25, y: 0.30, c: '#c78fff', r: W * 0.22, a: 0.12 },
            { x: 0.75, y: 0.65, c: '#7fffd4', r: W * 0.18, a: 0.09 },
            { x: 0.50, y: 0.50, c: '#ff88cc', r: W * 0.14, a: 0.07 },
        ].forEach(n => {
            const ng = ctx.createRadialGradient(n.x * W, n.y * H, 0, n.x * W, n.y * H, n.r);
            ng.addColorStop(0, n.c);
            ng.addColorStop(1, 'transparent');
            ctx.globalAlpha = n.a;
            ctx.fillStyle = ng;
            ctx.beginPath();
            ctx.arc(n.x * W, n.y * H, n.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // 큰 별 반짝이
        [[0.10,0.10],[0.90,0.15],[0.05,0.88],[0.88,0.85],[0.50,0.05]].forEach(([sx, sy]) => {
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#fff';
            ctx.font = `${Math.round(W * 0.028)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✦', sx * W, sy * H);
        });

    } else if (theme.deco === 'cottagecore') {
        // ── 코티지코어: 크림 그라디언트 + 작은 꽃 + 잎사귀 + 테두리 ──
        const grd = ctx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, '#f7f0e3');
        grd.addColorStop(1, '#ede0c8');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);

        // 꽃 그리기 헬퍼
        const drawFlower = (fx, fy, r, petC, cenC, alpha) => {
            ctx.globalAlpha = alpha;
            for (let p = 0; p < 5; p++) {
                const a = (p / 5) * Math.PI * 2;
                ctx.fillStyle = petC;
                ctx.beginPath();
                ctx.ellipse(fx + Math.cos(a) * r * 0.85, fy + Math.sin(a) * r * 0.85, r * 0.55, r * 0.35, a, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = cenC;
            ctx.beginPath();
            ctx.arc(fx, fy, r * 0.38, 0, Math.PI * 2);
            ctx.fill();
        };

        const flowers = [
            { x: 0.06, y: 0.08, r: 9,  p: '#e8a0b8', c: '#f5d070' },
            { x: 0.15, y: 0.05, r: 6,  p: '#b8d8a0', c: '#f5d070' },
            { x: 0.90, y: 0.07, r: 8,  p: '#f0c0a0', c: '#f5d070' },
            { x: 0.82, y: 0.12, r: 5,  p: '#e8a0b8', c: '#fff'    },
            { x: 0.05, y: 0.88, r: 7,  p: '#b8d8a0', c: '#f5d070' },
            { x: 0.14, y: 0.94, r: 5,  p: '#f0c0a0', c: '#fff'    },
            { x: 0.88, y: 0.90, r: 9,  p: '#e8a0b8', c: '#f5d070' },
            { x: 0.78, y: 0.95, r: 5,  p: '#b8d8a0', c: '#f5d070' },
            { x: 0.50, y: 0.04, r: 6,  p: '#f0c0a0', c: '#f5d070' },
            { x: 0.42, y: 0.96, r: 7,  p: '#e8a0b8', c: '#fff'    },
        ];
        flowers.forEach(f => drawFlower(f.x * W, f.y * H, f.r, f.p, f.c, 0.55 + rand() * 0.2));

        // 잎사귀
        [[0.10,0.07],[0.87,0.10],[0.08,0.91],[0.85,0.93]].forEach(([lx, ly]) => {
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#7ab87a';
            ctx.save();
            ctx.translate(lx * W, ly * H);
            ctx.rotate(rand() * Math.PI);
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.quadraticCurveTo(6, 0, 0, 8);
            ctx.quadraticCurveTo(-6, 0, 0, -8);
            ctx.fill();
            ctx.restore();
        });

        // 얇은 테두리 장식선
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = '#c9935a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(12, 12, W - 24, H - 24);

    } else if (theme.deco === 'meadow') {
        // ── 풀밭: 연초록 그라디언트 + 하단 풀잎 실루엣 ──
        const grd = ctx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, '#e8f5d0');
        grd.addColorStop(1, '#c0e890');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
        // 풀잎 레이어 1
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#4a9a20';
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
            const gy = H - 48 + Math.sin(x / 22) * 14 + Math.sin(x / 9) * 6;
            if (x === 0) ctx.moveTo(x, gy); else ctx.lineTo(x, gy);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
        // 풀잎 레이어 2
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#6abf30';
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
            const gy = H - 30 + Math.sin(x / 18 + 1) * 10 + Math.sin(x / 7 + 2) * 5;
            if (x === 0) ctx.moveTo(x, gy); else ctx.lineTo(x, gy);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
        // 작은 꽃 점
        [[0.12,0.88],[0.28,0.92],[0.55,0.87],[0.72,0.91],[0.88,0.89],[0.42,0.94]].forEach(([fx, fy]) => {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#ffe0f0';
            ctx.beginPath();
            ctx.arc(fx * W, fy * H, 3 + rand() * 2, 0, Math.PI * 2);
            ctx.fill();
        });

    } else if (theme.deco === 'ocean') {
        // ── 파도: 딥 네이비 그라디언트 + 파도 레이어 ──
        const grd = ctx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, '#081828');
        grd.addColorStop(1, '#0d3050');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
        // 파도 레이어
        [
            { yBase: H * 0.78, amp: 10, freq: 55, color: '#1a5a90', alpha: 0.45 },
            { yBase: H * 0.84, amp:  7, freq: 42, color: '#2278b8', alpha: 0.40 },
            { yBase: H * 0.90, amp:  5, freq: 30, color: '#3090d0', alpha: 0.35 },
        ].forEach(wl => {
            ctx.globalAlpha = wl.alpha;
            ctx.fillStyle = wl.color;
            ctx.beginPath();
            for (let x = 0; x <= W; x += 4) {
                const wy = wl.yBase + Math.sin(x / wl.freq) * wl.amp + Math.sin(x / (wl.freq * 0.6) + 1) * (wl.amp * 0.4);
                if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
            }
            ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
        });
        // 상단 잔물결
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = '#80d0f0';
        ctx.lineWidth = 1;
        for (let row = 0; row < 3; row++) {
            const baseY = 28 + row * 14;
            ctx.beginPath();
            for (let x = 0; x <= W; x += 6) {
                const wy = baseY + Math.sin(x / 38 + row) * 3;
                if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
            }
            ctx.stroke();
        }

    } else if (theme.deco === 'aurora') {
        // ── 오로라: 딥 다크 + 녹/보라 글로우 + 별 ──
        const grd = ctx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, '#040a10');
        grd.addColorStop(1, '#08141c');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
        // 오로라 글로우
        [
            { x: 0.25, y: 0.28, rx: W * 0.45, ry: H * 0.18, c: '#00ff88', a: 0.07 },
            { x: 0.65, y: 0.22, rx: W * 0.40, ry: H * 0.15, c: '#8844ff', a: 0.08 },
            { x: 0.45, y: 0.35, rx: W * 0.35, ry: H * 0.12, c: '#00ddff', a: 0.06 },
            { x: 0.15, y: 0.40, rx: W * 0.30, ry: H * 0.10, c: '#44ff88', a: 0.05 },
            { x: 0.80, y: 0.38, rx: W * 0.28, ry: H * 0.10, c: '#aa66ff', a: 0.06 },
        ].forEach(g => {
            const maxR = Math.max(g.rx, g.ry);
            const ng = ctx.createRadialGradient(g.x * W, g.y * H, 0, g.x * W, g.y * H, maxR);
            ng.addColorStop(0, g.c);
            ng.addColorStop(1, 'transparent');
            ctx.globalAlpha = g.a;
            ctx.fillStyle = ng;
            ctx.save();
            ctx.translate(g.x * W, g.y * H);
            ctx.scale(g.rx / maxR, g.ry / maxR);
            ctx.beginPath();
            ctx.arc(0, 0, maxR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        // 별
        for (let i = 0; i < 50; i++) {
            const x = rand() * W, y = rand() * H * 0.7, r = 0.5 + rand() * 1.5;
            ctx.globalAlpha = 0.15 + rand() * 0.45;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

    } else if (theme.deco === 'polaroid') {
        // ── 폴라로이드: 크림 외부 + 흰 사진 영역 ──
        ctx.fillStyle = '#ede8df';
        ctx.fillRect(0, 0, W, H);
        const padH = Math.round(W * 0.045);
        const captionH = Math.round(H * 0.14);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(padH, padH, W - padH * 2, H - padH * 2 - captionH);
        // 사진 영역 상단/좌측 미세 그림자
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#000000';
        ctx.fillRect(padH, padH, W - padH * 2, 3);
        ctx.fillRect(padH, padH, 3, H - padH * 2 - captionH);

    } else if (theme.deco === 'newspaper') {
        // ── 신문: 크림 배경 + 마스트헤드 ──
        ctx.fillStyle = '#f5f2e8';
        ctx.fillRect(0, 0, W, H);
        const mastH = Math.round(H * 0.18);
        const padX = Math.round(W * 0.07);
        // 마스트헤드 배경
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#c8c0a0';
        ctx.fillRect(0, 0, W, mastH);
        // 상단 굵은 선
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, W, Math.round(H * 0.012));
        // 마스트헤드 하단 이중선
        const lineY = mastH - Math.round(H * 0.012);
        ctx.fillRect(0, lineY, W, Math.round(H * 0.006));
        ctx.globalAlpha = 0.4;
        ctx.fillRect(0, lineY + Math.round(H * 0.009), W, Math.round(H * 0.003));
        // 제목 텍스트
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#111111';
        ctx.font = `bold ${Math.round(H * 0.065)}px "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('THE NARRATIVE', W / 2, mastH * 0.52);
        ctx.font = `${Math.round(H * 0.022)}px "Times New Roman", serif`;
        ctx.globalAlpha = 0.6;
        ctx.fillText('SPECIAL EDITION', W / 2, mastH * 0.82);
        // 본문 위 구분선
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#111111';
        ctx.fillRect(padX, mastH + Math.round(H * 0.04), W - padX * 2, 1);
        // 하단 구분선
        ctx.globalAlpha = 0.2;
        ctx.fillRect(padX, H - Math.round(H * 0.1), W - padX * 2, 1);

    } else if (theme.deco === 'hairline') {
        // ── 아이보리 세리프 / 딥 네이비: 상단 좌측 얇은 헤어라인 ──
        ctx.strokeStyle = theme.line;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        const m = Math.round(W * 0.085);
        ctx.beginPath();
        ctx.moveTo(m, 44);
        ctx.lineTo(m + 36, 44);
        ctx.stroke();

    } else if (theme.deco === 'corner') {
        // ── 그라파이트: 미니멀 코너 브라켓 ──
        ctx.strokeStyle = theme.accent;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.2;
        const m = 22, s = 18;
        ctx.beginPath(); ctx.moveTo(m, m + s); ctx.lineTo(m, m); ctx.lineTo(m + s, m); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W - m, H - m - s); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m - s, H - m); ctx.stroke();

    } else if (theme.deco === 'frame') {
        // ── 본 골드: 뮤지엄 라벨 스타일 얇은 프레임 ──
        ctx.strokeStyle = theme.accent;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.strokeRect(16, 16, W - 32, H - 32);

    } else if (theme.deco === 'clouds_pretty') {
        // ── 구름팝: 또렷한 흰 구름 (코너 배치) ──
        const drawCloud = (cx, cy, s, alpha) => {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = theme.accent2 || '#ffffff';
            [[-0.5, 0, 0.5], [0, -0.25, 0.6], [0.55, 0, 0.5], [0.15, 0.15, 0.55], [-0.15, 0.15, 0.5]].forEach(([dx, dy, r]) => {
                ctx.beginPath();
                ctx.arc(cx + dx * s, cy + dy * s, r * s * 0.5, 0, Math.PI * 2);
                ctx.fill();
            });
        };
        drawCloud(W * 0.14, H * 0.11, 40, 0.85);
        drawCloud(W * 0.85, H * 0.90, 46, 0.75);
        drawCloud(W * 0.90, H * 0.12, 26, 0.6);
        drawCloud(W * 0.08, H * 0.88, 22, 0.55);

    } else if (theme.deco === 'bubbles_big') {
        // ── 레몬소다: 크고 또렷한 탄산 기포 ──
        const sizes = [7, 10, 14, 6, 9, 12, 5, 8, 11, 6, 15, 7, 9, 13, 6, 10];
        for (let i = 0; i < sizes.length; i++) {
            const x = rand() * W, y = rand() * H, r = sizes[i];
            ctx.globalAlpha = 0.22 + rand() * 0.22;
            ctx.strokeStyle = theme.accent;
            ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = theme.accent;
            ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, Math.PI * 2); ctx.fill();
        }

    } else if (theme.deco === 'soap_bubble') {
        // ── 비눗방울: 흰+하늘색 그라디언트 + 반투명 버블 ──
        const grd = ctx.createLinearGradient(0, 0, W * 0.5, H);
        grd.addColorStop(0, '#f0f9ff');
        grd.addColorStop(0.5, '#e4f4ff');
        grd.addColorStop(1, '#f8fcff');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
        [
            { x: 0.88, y: 0.12, r: 0.10, c: '#a8d8f8', a: 0.18 },
            { x: 0.10, y: 0.82, r: 0.13, c: '#90ccf0', a: 0.16 },
            { x: 0.82, y: 0.85, r: 0.08, c: '#b8e0ff', a: 0.18 },
            { x: 0.42, y: 0.06, r: 0.06, c: '#c0e8ff', a: 0.16 },
            { x: 0.07, y: 0.18, r: 0.07, c: '#a0d0f0', a: 0.14 },
            { x: 0.92, y: 0.55, r: 0.05, c: '#b0dcff', a: 0.14 },
            { x: 0.55, y: 0.92, r: 0.07, c: '#c8ecff', a: 0.15 },
        ].forEach(b => {
            const br = b.r * Math.min(W, H);
            ctx.globalAlpha = b.a * 1.8;
            ctx.strokeStyle = b.c;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(b.x * W, b.y * H, br, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = b.a * 0.5;
            ctx.fillStyle = b.c;
            ctx.fill();
            // 하이라이트
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(b.x * W - br * 0.28, b.y * H - br * 0.28, br * 0.18, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    ctx.restore();
}

// ── Canvas 카드 렌더링 ────────────────────────────────────
// **볼드**, ==형광펜== 마커를 파싱해 문자 단위 토큰 배열로 변환
// (한 글자씩 {ch, bold, mark} 형태로 만들어 줄바꿈/렌더링에 사용)
function parseMarkerTokens(text) {
    const tokens = [];
    let i = 0;
    let bold = false, mark = false;
    while (i < text.length) {
        if (text.startsWith('**', i)) { bold = !bold; i += 2; continue; }
        if (text.startsWith('==', i)) { mark = !mark; i += 2; continue; }
        tokens.push({ ch: text[i], bold, mark });
        i++;
    }
    return tokens;
}

// 토큰 배열(문자+스타일)을 maxWidth 안에 들어가도록 줄바꿈.
// 볼드 글자는 폭이 달라질 수 있어 문자별로 알맞은 폰트를 적용해 측정함.
function wrapTokens(ctx, normalFont, boldFont, tokens, maxWidth) {
    const lines = [];
    let cur = [];
    let curWidth = 0;
    for (const t of tokens) {
        if (t.ch === '\n') { lines.push(cur); cur = []; curWidth = 0; continue; }
        ctx.font = t.bold ? boldFont : normalFont;
        const w = ctx.measureText(t.ch).width;
        if (curWidth + w > maxWidth && cur.length) {
            lines.push(cur);
            cur = [t];
            curWidth = w;
        } else {
            cur.push(t);
            curWidth += w;
        }
    }
    lines.push(cur);
    return lines;
}

// 토큰 한 줄을 캔버스에 그림 (볼드/형광펜 스타일 반영), 그린 폭을 반환
function drawTokenLine(ctx, tokens, x, y, normalFont, boldFont, markColor) {
    let cx = x;
    let i = 0;
    while (i < tokens.length) {
        const t = tokens[i];
        // 같은 스타일이 이어지는 구간을 묶어서 한 번에 측정/그리기 (성능 + 자간 정확도)
        let j = i + 1;
        while (j < tokens.length && tokens[j].bold === t.bold && tokens[j].mark === t.mark) j++;
        const run = tokens.slice(i, j).map(tk => tk.ch).join('');
        ctx.font = t.bold ? boldFont : normalFont;
        const runWidth = ctx.measureText(run).width;

        if (t.mark) {
            const metrics = ctx.measureText(run);
            const ascent = metrics.actualBoundingBoxAscent || parseInt(ctx.font, 10) * 0.8;
            const descent = metrics.actualBoundingBoxDescent || parseInt(ctx.font, 10) * 0.25;
            ctx.save();
            ctx.fillStyle = markColor;
            ctx.fillRect(cx - 1, y - ascent - 1, runWidth + 2, ascent + descent + 2);
            ctx.restore();
        }

        const prevFill = ctx.fillStyle;
        ctx.fillText(run, cx, y);
        ctx.fillStyle = prevFill;

        cx += runWidth;
        i = j;
    }
    return cx - x;
}

function wrapText(ctx, text, maxWidth) {
    const result = [];
    // 줄바꿈 문자 기준으로 먼저 분리 (드래그 발췌 시 엔터 보존)
    const paragraphs = text.split(/\r?\n/);
    for (const para of paragraphs) {
        if (para.trim() === '') {
            // 빈 줄은 빈 문자열로 추가해 간격 유지
            result.push('');
            continue;
        }
        const lines = [];
        let cur = '';
        for (const ch of para) {
            const test = cur + ch;
            if (ctx.measureText(test).width > maxWidth && cur) {
                lines.push(cur);
                cur = ch;
            } else {
                cur = test;
            }
        }
        if (cur) lines.push(cur);
        result.push(...lines);
    }
    return result;
}

// 사진을 카드 비율에 맞춰 크롭해서 꽉 채우기 (object-fit: cover와 동일한 동작)
function drawCoverImage(ctx, img, W, H) {
    const ir = img.width / img.height;
    const cr = W / H;
    let sx, sy, sw, sh;
    if (ir > cr) {
        sh = img.height;
        sw = sh * cr;
        sx = (img.width - sw) / 2;
        sy = 0;
    } else {
        sw = img.width;
        sh = sw / cr;
        sx = 0;
        sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}

function renderCard(cardData, themeKey, charName, mesId, fontSizePct = 100, ratioKey = 'landscape', textColorOverride = null, bgColorOverride = null, bgImage = null, overlayOpacity = 50, markColorOverride = null) {
    const theme = THEMES.find(t => t.value === themeKey) || THEMES[0];
    const ratioConf = RATIOS.find(r => r.value === ratioKey) || RATIOS[0];
    const W = ratioConf.w;
    const _baseH = ratioConf.h;
    const PAD_X = Math.round(W * 0.085);
    const PAD_BOTTOM = 70;
    const PAD_TOP = 60;

    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    const maxTextWidth = W - PAD_X * 2;

    let scale = (fontSizePct || 100) / 100;

    function computeBlocks(s) {
        const narrPx  = Math.round(13 * s);
        const font    = `${narrPx}px Georgia, "Noto Serif KR", serif`;
        const boldFont = `bold ${narrPx}px Georgia, "Noto Serif KR", serif`;
        return cardData.lines.map(line => {
            const tokens = parseMarkerTokens(line.text);
            const wrapped = wrapTokens(mctx, font, boldFont, tokens, maxTextWidth);
            return { wrapped, lineHeight: Math.round(26 * s), gap: Math.round(20 * s) };
        });
    }

    function totalHeight(blocks) {
        let h = 0;
        blocks.forEach((b, i) => {
            h += b.wrapped.length * b.lineHeight;
            if (i < blocks.length - 1) h += b.gap;
        });
        return h;
    }

    let blocks = computeBlocks(scale);
    let contentHeight = totalHeight(blocks);

    // 텍스트가 많으면 카드 높이를 동적으로 늘림 (글씨 크기는 유지)
    const neededH = contentHeight + PAD_TOP + PAD_BOTTOM + 20;
    const H = Math.max(_baseH, neededH);

    const baseNarr = Math.round(13 * scale);
    const baseQuote = Math.round(18 * scale);
    const baseMeta = Math.round(11 * scale);

    const FONT_NARR  = `${baseNarr}px Georgia, "Noto Serif KR", serif`;
    const FONT_NARR_BOLD = `bold ${baseNarr}px Georgia, "Noto Serif KR", serif`;
    const FONT_QUOTE = `bold ${baseQuote}px Georgia, "Noto Serif KR", serif`;
    const FONT_META  = `${baseMeta}px Georgia, "Noto Serif KR", serif`;
    const MARK_COLOR = hexToRgba(markColorOverride || '#ffe150', 0.55);

    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    if (bgImage) {
        // 사진을 카드 비율에 맞춰 꽉 채우기(cover) + 그 위에 톤 오버레이를 깔아 글씨 가독성 확보
        drawCoverImage(ctx, bgImage, W, H);
        ctx.fillStyle = bgColorOverride || theme.bg;
        ctx.globalAlpha = Math.min(Math.max((overlayOpacity ?? 50) / 100, 0), 1);
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        // 사진 위에는 계절 장식을 그리지 않음 (사진과 겹쳐 지저분해 보이는 것 방지)
    } else {
        ctx.fillStyle = bgColorOverride || theme.bg;
        ctx.fillRect(0, 0, W, H);
        drawDecoration(ctx, W, H, theme);
    }

    let y = (H - contentHeight) / 2 - 20;
    ctx.textBaseline = 'alphabetic';

    blocks.forEach((b, i) => {
        ctx.fillStyle = textColorOverride || theme.text;
        b.wrapped.forEach(tokenLine => {
            drawTokenLine(ctx, tokenLine, PAD_X, y + b.lineHeight * 0.75, FONT_NARR, FONT_NARR_BOLD, MARK_COLOR);
            y += b.lineHeight;
        });
        if (i < blocks.length - 1) y += b.gap;
    });

    ctx.font = FONT_META;
    ctx.fillStyle = theme.meta;
    const metaLeft = [charName, cardData.location].filter(Boolean).join(' · ');
    ctx.textAlign = 'left';
    ctx.fillText(metaLeft, PAD_X, H - 32);
    // 채팅 번호 표시 제거

    return canvas.toDataURL('image/png');
}

// ── 인라인 표시 (비활성화: 갤러리에서만 보기)
function showCardInline(mesEl, dataUrl) { /* 비활성화 */ }

// ── 갤러리 저장/불러오기 ──────────────────────────────────
// extension_settings는 SillyTavern이 계정별로 서버의 settings.json에 실제로
// 저장해주는 공식 저장소라서, 같은 계정으로 접속하면 PC/폰 어디서든 동기화됨.
function galleryStore() {
    if (!extension_settings[EXT]) extension_settings[EXT] = {};
    if (!extension_settings[EXT].gallery) {
        extension_settings[EXT].gallery = { index: [], cards: {} };
    }
    return extension_settings[EXT].gallery;
}

async function saveToGallery(charName, dataUrl, meta) {
    try {
        const store = galleryStore();
        const id = Date.now() + '_' + Math.floor(Math.random() * 1e6);
        const createdAt = Date.now();
        store.cards[id] = { id, charName, dataUrl, meta, createdAt };
        store.index.unshift({ id, charName, createdAt });
        saveSettingsDebounced();
        return id;
    } catch (e) {
        console.warn('[NarrativeCard] 갤러리 저장 실패:', e);
        return null;
    }
}

async function updateGalleryItem(id, dataUrl, meta, charName) {
    try {
        const store = galleryStore();
        const existing = store.cards[id];
        const createdAt = existing ? existing.createdAt : Date.now();
        store.cards[id] = { id, charName, dataUrl, meta, createdAt };
        const entry = store.index.find(x => x.id === id);
        if (entry) entry.charName = charName;
        else store.index.unshift({ id, charName, createdAt });
        saveSettingsDebounced();
        return id;
    } catch (e) {
        console.warn('[NarrativeCard] 갤러리 수정 실패:', e);
        return null;
    }
}

async function deleteCard(id) {
    try {
        const store = galleryStore();
        delete store.cards[id];
        store.index = store.index.filter(e => e.id !== id);
        saveSettingsDebounced();
    } catch (e) {
        console.warn('[NarrativeCard] 삭제 실패:', e);
    }
}

async function getAllCards() {
    try {
        const store = galleryStore();
        return store.index
            .map(entry => store.cards[entry.id])
            .filter(Boolean);
    } catch (e) {
        console.warn('[NarrativeCard] 갤러리 불러오기 실패:', e);
        return [];
    }
}

// ── 갤러리 모달 ──────────────────────────────────────────

// ── 카드 크게 보기 팝업 ──────────────────────────────────
function openCardViewer(dataUrl) {
    const overlay = document.createElement('div');
    // 강력한 정중앙 고정: fixed + inset:0 + flex centering, transform 차단
    overlay.setAttribute('style',
        'position:fixed!important;' +
        'top:0!important;left:0!important;right:0!important;bottom:0!important;' +
        'inset:0!important;' +
        'width:100vw!important;height:100vh!important;height:100dvh!important;' +
        'margin:0!important;padding:0!important;' +
        'background:transparent!important;' +
        'z-index:2147483647!important;' +
        'display:flex!important;' +
        'flex-direction:column!important;' +
        'align-items:center!important;' +
        'justify-content:center!important;' +
        'transform:none!important;-webkit-transform:none!important;' +
        'cursor:zoom-out;' +
        'box-sizing:border-box!important;'
    );

    const inner = document.createElement('div');
    inner.setAttribute('style',
        'position:relative!important;' +
        'margin:auto!important;' +
        'display:flex;flex-direction:column;align-items:center;gap:16px;' +
        'transform:none!important;' +
        'max-width:92vw;max-height:92vh;max-height:92dvh;'
    );

    const closeBtn = document.createElement('div');
    closeBtn.className = 'ncard-viewer-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = '닫기';
    const doClose = (e) => { e.stopPropagation(); overlay.remove(); };
    closeBtn.addEventListener('click', doClose);
    closeBtn.addEventListener('touchend', doClose);

    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'max-width:90vw;max-height:80vh;max-height:80dvh;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.4);cursor:default;object-fit:contain;display:block;';
    img.addEventListener('click', (e) => e.stopPropagation());

    const dlBtn = document.createElement('button');
    dlBtn.textContent = '💾 이미지 저장';
    dlBtn.style.cssText = 'padding:10px 32px;border:none;border-radius:20px;background:#d4a017;color:#1c1a17;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.5);flex-shrink:0;';
    dlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'narrative_card_' + Date.now() + '.png';
        a.click();
    });

    inner.appendChild(closeBtn);
    inner.appendChild(img);
    inner.appendChild(dlBtn);
    overlay.appendChild(inner);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
    inner.addEventListener('click', (e) => e.stopPropagation());

    const onKey = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
}

// 갤러리에서 "✏️ 수정"을 눌렀을 때: 저장된 텍스트/스타일을 복원해서
// 카드 만들기 과정을 처음부터(발췌 편집 → 옵션) 다시 밟도록 함
async function startEditCard(c) {
    const meta = c.meta || {};
    const cardData = meta.cardData || { lines: [] };
    const style = meta.style || {};

    // 1) 발췌 텍스트 복원
    excerptList = (cardData.lines || []).map(l => ({ text: l.text }));
    _lastMesEl = null;

    // 2) 스타일 복원 준비 (배경 사진은 비동기 로드 필요)
    let bgImage = null;
    if (style.bgImageDataUrl) {
        bgImage = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = style.bgImageDataUrl;
        });
    }
    _pendingEditMeta = {
        theme: style.theme,
        fontSize: style.fontSize,
        ratio: style.ratio,
        textColor: style.textColor ?? null,
        bgColor: style.bgColor ?? null,
        overlayOpacity: style.overlayOpacity ?? 50,
        bgImage,
        charName: cardData.speaker || c.charName || '',
        markColor: style.markColor ?? null,
    };

    // 3) 이 카드를 새로 저장하지 않고 덮어쓰도록 표시
    _editingCardId = c.id;

    // 4) 발췌 편집 화면부터 다시 시작
    openExcerptPopup(null);
}

async function openGallery() {
    // 이미 갤러리가 열려있으면 중복으로 새로 열지 않음 (모바일 터치+클릭 중복 이벤트 방지)
    if (document.getElementById('ncard-gallery-modal')) return;

    const cards = await getAllCards();
    // await 중 중복 호출이 있었을 수도 있으니 한 번 더 확인
    if (document.getElementById('ncard-gallery-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ncard-gallery-modal';
    overlay.className = 'ncard-modal-overlay';
    overlay.setAttribute('style',
        'position:fixed!important;inset:0!important;top:0!important;left:0!important;right:0!important;bottom:0!important;' +
        'width:100vw!important;height:100vh!important;margin:0!important;' +
        'background:transparent!important;z-index:2147483647!important;' +
        'display:flex!important;align-items:center!important;justify-content:center!important;transform:none!important;'
    );
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const modal = document.createElement('div');
    modal.className = 'ncard-modal';

    const head = document.createElement('div');
    head.className = 'ncard-modal-head';
    head.innerHTML = `<span>Narrative Card Gallery (${cards.length})</span>`;
    const closeBtn = document.createElement('span');
    closeBtn.className = 'ncard-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    closeBtn.addEventListener('touchend', (e) => { e.preventDefault(); overlay.remove(); });
    head.appendChild(closeBtn);

    // ── 캐릭터 필터 드롭다운 ──────────────────────
    const filterRow = document.createElement('div');
    filterRow.className = 'ncard-char-filter-row';
    const filterLabel = document.createElement('label');
    filterLabel.textContent = '캐릭터';
    const charSelect = document.createElement('select');
    const charNames = Array.from(new Set(cards.map(c => c.charName).filter(Boolean))).sort();
    const allOpt = document.createElement('option');
    allOpt.value = '__all__';
    allOpt.textContent = `전체 (${cards.length})`;
    charSelect.appendChild(allOpt);
    charNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        const cnt = cards.filter(c => c.charName === name).length;
        opt.textContent = `${name} (${cnt})`;
        charSelect.appendChild(opt);
    });
    charSelect.addEventListener('change', () => {
        const sel = charSelect.value;
        const filtered = sel === '__all__' ? cards : cards.filter(c => c.charName === sel);
        renderGrid(filtered);
    });
    filterRow.appendChild(filterLabel);
    filterRow.appendChild(charSelect);

    const grid = document.createElement('div');
    grid.className = 'ncard-grid';
    const countSpan = head.querySelector('span');
    function renderGrid(cardList) {
        grid.innerHTML = '';
        if (cardList.length === 0) {
            grid.innerHTML = '<p style="color:#666;font-size:13px;grid-column:1/-1;text-align:center;padding:40px 0;">아직 생성된 카드가 없습니다.</p>';
            return;
        }
        cardList.forEach(c => {
            const item = document.createElement('div');
            item.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;background:#f5f5f5;box-shadow:0 2px 8px rgba(0,0,0,0.1);display:flex;flex-direction:column;';

            const img = document.createElement('img');
            img.src = c.dataUrl;
            img.style.cssText = 'width:100%;flex:1;min-height:0;object-fit:cover;display:block;cursor:pointer;transition:transform .15s;border-radius:8px 8px 0 0;';
            img.addEventListener('mouseover', () => { img.style.transform = 'scale(1.03)'; });
            img.addEventListener('mouseout', () => { img.style.transform = ''; });
            img.addEventListener('click', () => openCardViewer(c.dataUrl));

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:4px;padding:6px;background:rgba(0,0,0,0.6);flex-shrink:0;';

            const btnEdit = document.createElement('button');
            btnEdit.textContent = '✏️ 수정';
            btnEdit.style.cssText = 'flex:1;padding:4px 0;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.18);color:#fff;';
            btnEdit.addEventListener('click', () => {
                overlay.remove();
                startEditCard(c);
            });

            const btnDl = document.createElement('button');
            btnDl.textContent = '💾 저장';
            btnDl.style.cssText = 'flex:1;padding:4px 0;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;background:#d4a017;color:#1c1a17;';
            btnDl.addEventListener('click', () => {
                const a = document.createElement('a');
                a.href = c.dataUrl;
                a.download = 'narrative_card_' + (c.createdAt || Date.now()) + '.png';
                a.click();
            });

            const btnDel = document.createElement('button');
            btnDel.textContent = '🗑️ 삭제';
            btnDel.style.cssText = 'flex:1;padding:4px 0;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;background:rgba(255,80,80,0.2);color:#ff8080;';
            btnDel.addEventListener('click', async () => {
                await deleteCard(c.id);
                item.remove();
                // 전체 목록 및 캐릭터 드롭다운 카운트 갱신
                const cardIdx = cards.findIndex(x => x.id === c.id);
                if (cardIdx !== -1) cards.splice(cardIdx, 1);
                if (countSpan) countSpan.textContent = 'Narrative Card Gallery (' + cards.length + ')';
                if (charSelect.options[0]) charSelect.options[0].textContent = `전체 (${cards.length})`;
                const optForChar = Array.from(charSelect.options).find(o => o.value === c.charName);
                if (optForChar) {
                    const remCnt = cards.filter(x => x.charName === c.charName).length;
                    optForChar.textContent = `${c.charName} (${remCnt})`;
                }
                if (grid.children.length === 0) grid.innerHTML = '<p style="color:#666;font-size:13px;grid-column:1/-1;text-align:center;padding:40px 0;">아직 생성된 카드가 없습니다.</p>';
            });

            btnRow.appendChild(btnEdit);
            btnRow.appendChild(btnDl);
            btnRow.appendChild(btnDel);
            item.appendChild(img);
            item.appendChild(btnRow);
            grid.appendChild(item);
        });
    }
    renderGrid(cards);

    modal.appendChild(head);
    if (charNames.length > 0) modal.appendChild(filterRow);
    modal.appendChild(grid);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// ── 설정 패널 ─────────────────────────────────────────────
function buildSettingsHtml() {
    const c = cfg();
    const themeOpts = THEMES.map(t =>
        `<option value="${t.value}" ${c.theme === t.value ? 'selected' : ''}>${t.label}</option>`
    ).join('');
    const ratioOpts = RATIOS.map(r =>
        `<option value="${r.value}" ${(c.ratio||'landscape') === r.value ? 'selected' : ''}>${r.label}</option>`
    ).join('');
    const fs = c.font_size || 100;

    return `
<div class="ncard-settings">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>📜 Narrative Card</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">

      <div class="ncard-field">
        <label>기본 배경 / 톤</label>
        <select id="ncard-theme" class="text_pole">${themeOpts}</select>
      </div>

      <div class="ncard-field">
        <label>기본 카드 비율</label>
        <select id="ncard-ratio" class="text_pole">${ratioOpts}</select>
      </div>

      <div class="ncard-field">
        <label>기본 글씨 크기 (카드 생성 시 매번 조절 가능)</label>
        <div class="ncard-font-size-row">
          <input type="range" id="ncard-font-size" min="60" max="300" step="5" value="${fs}" />
          <span class="ncard-font-size-val" id="ncard-font-size-val">${fs}%</span>
        </div>
      </div>

      <div class="ncard-field" style="display:flex; gap:8px; width:100%;">
        <button id="ncard-save-settings" class="menu_button" style="flex:1 1 0; min-width:0; white-space:nowrap;">저장</button>
        <button id="ncard-open-gallery" class="menu_button" style="flex:1 1 0; min-width:0; white-space:nowrap;">갤러리 열기</button>
      </div>

    </div>
  </div>
</div>`;
}

function bindSettingsEvents() {
    // 슬라이더 실시간 표시
    $('#ncard-font-size').on('input', function () {
        $('#ncard-font-size-val').text($(this).val() + '%');
    });

    const save = () => {
        const s = getExtSettings();
        if (!s) return;
        s.theme = $('#ncard-theme').val();
        s.ratio = $('#ncard-ratio').val();
        s.font_size = parseInt($('#ncard-font-size').val(), 10) || 100;
        saveSettingsDebounced();
        toastr.success('설정 저장됨', '', { timeOut: 1500 });
    };

    $('#ncard-save-settings').on('click', save);
    $('#ncard-open-gallery').on('click', openGallery);
}

// ── Wand 메뉴 주입 ────────────────────────────────────────
function injectWandMenu() {
    const injectItem = () => {
        const menu = document.getElementById('extensionsMenu');
        if (!menu) return false;
        if (menu.querySelector('#ncard-wand-item')) return true;

        // SillyTavern 확장들이 공통으로 쓰는 표준 마법봉 메뉴 마크업
        // (list-group-item 클래스로 테마의 폰트/색/간격을 그대로 상속받음)
        const li = document.createElement('div');
        li.id = 'ncard-wand-item';
        li.className = 'list-group-item flex-container flexGap5 interactable';
        li.tabIndex = 0;
        li.innerHTML = `<i class="fa-solid fa-quote-right extensionsMenuExtensionButton"></i><span>Narrative Card</span>`;

        const openG = (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('extensionsMenu')?.classList.remove('open');
            openGallery();
        };
        li.addEventListener('click', openG);
        li.addEventListener('touchend', openG);

        const firstItem = menu.firstElementChild;
        if (firstItem) menu.insertBefore(li, firstItem);
        else menu.appendChild(li);
        return true;
    };

    injectItem();
    const bodyObserver = new MutationObserver(() => injectItem());
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', (e) => {
        if (e.target?.closest?.('#extensionsMenuButton')) setTimeout(injectItem, 50);
    });

    let tries = 0;
    const pollId = setInterval(() => {
        tries++;
        if (injectItem() || tries > 20) clearInterval(pollId);
    }, 500);
}

// ── 초기화 ───────────────────────────────────────────────
// ── 예전 IndexedDB 갤러리 → 새 서버(계정) 저장소로 마이그레이션 ───
// (예전 버전에서 브라우저 로컬(IndexedDB)에만 저장되던 카드들을
//  extension_settings 기반 서버 저장소로 한 번만 복사해옴)
async function migrateOldIndexedDbGallery() {
    const OLD_DB_NAME = 'NarrativeCardGallery';
    const OLD_STORE_NAME = 'cards';
    const MIGRATION_FLAG = 'ncard_idb_migrated';

    if (extension_settings[EXT]?.[MIGRATION_FLAG]) return; // 이미 마이그레이션 완료

    let dbExists = true;
    try {
        // 기존 DB가 없으면 여기서 새로 생성돼버리므로, databases() 목록으로 먼저 존재 여부 확인
        if (indexedDB.databases) {
            const dbs = await indexedDB.databases();
            dbExists = dbs.some(d => d.name === OLD_DB_NAME);
        }
    } catch (_) { /* databases() 미지원 브라우저면 그냥 진행 */ }

    if (!dbExists) {
        if (!extension_settings[EXT]) extension_settings[EXT] = {};
        extension_settings[EXT][MIGRATION_FLAG] = true;
        saveSettingsDebounced();
        return;
    }

    try {
        const oldItems = await new Promise((resolve, reject) => {
            const req = indexedDB.open(OLD_DB_NAME, 1);
            req.onupgradeneeded = () => {
                // 옛 스토어가 없는 상태로 새로 열리는 경우 → 마이그레이션할 게 없음
                const db = req.result;
                if (!db.objectStoreNames.contains(OLD_STORE_NAME)) {
                    db.createObjectStore(OLD_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(OLD_STORE_NAME)) { resolve([]); return; }
                const tx = db.transaction(OLD_STORE_NAME, 'readonly');
                const getAllReq = tx.objectStore(OLD_STORE_NAME).getAll();
                getAllReq.onsuccess = () => resolve(getAllReq.result || []);
                getAllReq.onerror = () => reject(getAllReq.error);
            };
            req.onerror = () => reject(req.error);
        });

        if (oldItems.length > 0) {
            const store = galleryStore();
            let migrated = 0;
            oldItems.forEach(old => {
                const id = 'migrated_' + old.id + '_' + Date.now();
                if (store.cards[id]) return;
                store.cards[id] = {
                    id, charName: old.charName, dataUrl: old.dataUrl,
                    meta: old.meta, createdAt: old.createdAt || Date.now(),
                };
                store.index.push({ id, charName: old.charName, createdAt: old.createdAt || Date.now() });
                migrated++;
            });
            // 최신순 정렬 유지
            store.index.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            if (migrated > 0) {
                saveSettingsDebounced();
                console.log(`[NarrativeCard] 이전 기기 로컬 저장소에서 카드 ${migrated}개를 서버로 옮겼어`);
                toastr.success(`이전에 저장된 카드 ${migrated}개를 서버로 옮겼어요`, 'Narrative Card', { timeOut: 4000 });
            }
        }
    } catch (e) {
        console.warn('[NarrativeCard] 이전 갤러리 마이그레이션 실패:', e);
    }

    if (!extension_settings[EXT]) extension_settings[EXT] = {};
    extension_settings[EXT][MIGRATION_FLAG] = true;
    saveSettingsDebounced();
}

jQuery(async () => {
    injectStyles();
    ensureFallbackStyles();
    ensureFontReady(); // 미리 로딩 시작 (완료 대기는 실제 렌더링 시점에)

    $('#extensions_settings2').append(buildSettingsHtml());
    bindSettingsEvents();

    injectWandMenu();
    migrateOldIndexedDbGallery();

    console.log('[NarrativeCard] 확장 로드 완료 (드래그 발췌 모드)');
});
