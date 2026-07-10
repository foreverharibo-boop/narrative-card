/**
 * 📜 Narrative Card - SillyTavern Extension
 * 사용자가 직접 드래그한 텍스트를 발췌해 카드 이미지로 만듭니다.
 */

import { getContext, extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

// ── CSS 주입 ──────────────────────────────────────────────
function injectStyles() {
    if (document.getElementById('ncard-injected-css')) return;
    const style = document.createElement('style');
    style.id = 'ncard-injected-css';
    style.textContent = `
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

/* ── 메시지 버튼 ─────────────────────────────────────────── */
.ncard-msg-btn {
    cursor: pointer;
    opacity: 0.55;
    transition: opacity .2s, color .2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    font-size: 14px;
    color: var(--SmartThemeBodyColor, #ccc);
    flex-shrink: 0;
    touch-action: manipulation;
}
.ncard-msg-btn:hover { opacity: 1; color: #d4a017 !important; }

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
.ncard-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; padding: 18px; overflow-y: auto; }

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
.ncard-msg-btn{cursor:pointer;touch-action:manipulation;}
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

        const typeRow = document.createElement('div');
        const textEl = document.createElement('div');
        textEl.className = 'ncard-excerpt-text';
        textEl.style.flex = '1';
        textEl.textContent = item.text;

        const delBtn = document.createElement('span');
        delBtn.className = 'ncard-excerpt-del';
        delBtn.innerHTML = '&times;';
        delBtn.title = '삭제';
        delBtn.addEventListener('click', () => { excerptList.splice(idx, 1); refreshPopupList(); });

        row.appendChild(textEl);
        row.appendChild(delBtn);
        body.appendChild(row);
    });
}

function closePopup() {
    document.getElementById('ncard-popup-overlay')?.remove();
}

// ── 발췌 목록으로 카드 렌더링 ────────────────────────────


// ── 미리보기 팝업 (글씨크기/테마/비율/글자색 조절) ────────
function openPreviewPopup(mesEl) {
    const c = cfg();
    _previewState = {
        theme: c.theme,
        fontSize: c.font_size || 100,
        ratio: c.ratio || 'landscape',
        textColor: null,
    };

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
    fsSlider.type = 'range'; fsSlider.min = 60; fsSlider.max = 180; fsSlider.step = 5;
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

    function doPreview() {
        const charName = getCharacterName();
        const mesId = mesEl?.getAttribute('mesid');
        const cardData = {
            speaker: charName, location: '',
            lines: excerptList.map(item => ({ text: item.text })),
        };
        const url = renderCard(cardData, _previewState.theme, charName, mesId,
            _previewState.fontSize, _previewState.ratio, _previewState.textColor);
        document.getElementById('ncard-prev-img').src = url;
    }
    doPreview();
}

// 현재 미리보기/생성 옵션 상태
let _previewState = null;

async function runGenerate(mesEl) {
    try {
        const c = cfg();
        const state = _previewState || {};
        const charName = getCharacterName();
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
            state.textColor || null
        );

        // 갤러리 저장
        const savedId = await saveToGallery(charName, dataUrl, {
            timestamp: new Date().toISOString(),
            cardData,
        });

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
    }

    ctx.restore();
}

// ── Canvas 카드 렌더링 ────────────────────────────────────
function wrapText(ctx, text, maxWidth) {
    const lines = [];
    let cur = '';
    for (const ch of text) {
        const test = cur + ch;
        if (ctx.measureText(test).width > maxWidth && cur) {
            lines.push(cur);
            cur = ch;
        } else {
            cur = test;
        }
    }
    if (cur) lines.push(cur);
    return lines;
}

function renderCard(cardData, themeKey, charName, mesId, fontSizePct = 100, ratioKey = 'landscape', textColorOverride = null) {
    const theme = THEMES.find(t => t.value === themeKey) || THEMES[0];
    const ratioConf = RATIOS.find(r => r.value === ratioKey) || RATIOS[0];
    const W = ratioConf.w;
    const _baseH = ratioConf.h;
    const PAD_X = Math.round(W * 0.085);
    const PAD_BOTTOM = 70;

    const scale = (fontSizePct || 100) / 100;
    const baseNarr = Math.round(13 * scale);
    const baseQuote = Math.round(18 * scale);
    const baseMeta = Math.round(11 * scale);

    const FONT_NARR  = `${baseNarr}px Georgia, "Noto Serif KR", serif`;
    const FONT_QUOTE = `bold ${baseQuote}px Georgia, "Noto Serif KR", serif`;
    const FONT_META  = `${baseMeta}px Georgia, "Noto Serif KR", serif`;

    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    const maxTextWidth = W - PAD_X * 2;

    const blocks = cardData.lines.map(line => {
        mctx.font = FONT_NARR;
        const wrapped = wrapText(mctx, line.text, maxTextWidth);
        const lineHeight = Math.round(26 * scale);
        return { wrapped, lineHeight, gap: Math.round(20 * scale) };
    });

    let contentHeight = 0;
    blocks.forEach((b, i) => {
        contentHeight += b.wrapped.length * b.lineHeight;
        if (i < blocks.length - 1) contentHeight += b.gap;
    });

    const H = Math.max(_baseH, contentHeight + 200 + PAD_BOTTOM);

    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);

    drawDecoration(ctx, W, H, theme);

    let y = (H - contentHeight) / 2 - 20;
    ctx.textBaseline = 'alphabetic';

    blocks.forEach((b, i) => {
        ctx.font = FONT_NARR;
        ctx.fillStyle = textColorOverride || theme.text;
        b.wrapped.forEach(line => {
            ctx.fillText(line, PAD_X, y + b.lineHeight * 0.75);
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
const NCARD_DIR = 'user/narrative_card';
const NCARD_INDEX_FILE = `${NCARD_DIR}/index.json`;

async function serverSave(path, data) {
    const res = await fetch('/api/userdata/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, data: typeof data === 'string' ? data : JSON.stringify(data) }),
    });
    if (!res.ok) {
        const msg = await res.text().catch(() => res.status);
        throw new Error(`서버 저장 실패 [${res.status}]: ${path} — ${msg}`);
    }
}

async function serverLoad(path) {
    const res = await fetch('/api/userdata/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
    });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) {
        const msg = await res.text().catch(() => res.status);
        throw new Error(`서버 읽기 실패 [${res.status}]: ${path} — ${msg}`);
    }
    const text = await res.text();
    try {
        const outer = JSON.parse(text);
        if (outer && typeof outer.data === 'string') return JSON.parse(outer.data);
        return outer;
    } catch { return null; }
}

let _ncardUseServer = null;
async function checkServerAvailable() {
    if (_ncardUseServer !== null) return _ncardUseServer;
    try {
        const res = await fetch('/api/userdata/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: NCARD_INDEX_FILE }),
        });
        _ncardUseServer = (res.status !== 403 && res.status !== 405 && res.status !== 501);
    } catch (_) {
        _ncardUseServer = false;
    }
    return _ncardUseServer;
}

// IndexedDB 폴백
const DB_NAME = 'NarrativeCardGallery';
const STORE_NAME = 'cards';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveToGallery(charName, dataUrl, meta) {
    if (await checkServerAvailable()) {
        const id = Date.now() + '_' + Math.floor(Math.random() * 1e6);
        const item = { id, charName, dataUrl, meta, createdAt: Date.now() };
        await serverSave(`${NCARD_DIR}/cards/${id}.json`, item);
        const index = (await serverLoad(NCARD_INDEX_FILE)) || [];
        index.unshift({ id, charName, createdAt: item.createdAt });
        await serverSave(NCARD_INDEX_FILE, index);
        return id;
    } else {
        try {
            const db = await openDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const req = tx.objectStore(STORE_NAME).add({ charName, dataUrl, meta, createdAt: Date.now() });
                tx.oncomplete = () => resolve(req.result);
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) {
            console.warn('[NarrativeCard] 갤러리 저장 실패:', e);
            return null;
        }
    }
}

async function deleteCard(id) {
    if (await checkServerAvailable()) {
        try {
            await fetch('/api/userdata/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: `${NCARD_DIR}/cards/${id}.json`, data: '' }),
            });
        } catch (_) {}
        const index = (await serverLoad(NCARD_INDEX_FILE)) || [];
        await serverSave(NCARD_INDEX_FILE, index.filter(e => e.id !== id));
    } else {
        try {
            const db = await openDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).delete(id);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) { console.warn('[NarrativeCard] 삭제 실패:', e); }
    }
}

async function getAllCards() {
    if (await checkServerAvailable()) {
        const index = (await serverLoad(NCARD_INDEX_FILE)) || [];
        const items = [];
        for (const entry of index) {
            const item = await serverLoad(`${NCARD_DIR}/cards/${entry.id}.json`);
            if (item) items.push(item);
        }
        return items;
    } else {
        try {
            const db = await openDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).getAll();
                req.onsuccess = () => resolve((req.result || []).reverse());
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            return [];
        }
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

async function openGallery() {
    const cards = await getAllCards();

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
            item.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;background:#f5f5f5;box-shadow:0 2px 8px rgba(0,0,0,0.1);';

            const img = document.createElement('img');
            img.src = c.dataUrl;
            img.style.cssText = 'width:100%;display:block;cursor:pointer;transition:transform .15s;border-radius:8px 8px 0 0;';
            img.addEventListener('mouseover', () => { img.style.transform = 'scale(1.03)'; });
            img.addEventListener('mouseout', () => { img.style.transform = ''; });
            img.addEventListener('click', () => openCardViewer(c.dataUrl));

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:4px;padding:6px;background:rgba(0,0,0,0.6);';

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
          <input type="range" id="ncard-font-size" min="60" max="180" step="5" value="${fs}" />
          <span class="ncard-font-size-val" id="ncard-font-size-val">${fs}%</span>
        </div>
      </div>

      <div class="ncard-field" style="display:flex; gap:8px;">
        <button id="ncard-save-settings" class="menu_button">저장</button>
        <button id="ncard-open-gallery" class="menu_button">갤러리 열기</button>
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

// ── 메시지 버튼 (발췌 팝업 열기) ─────────────────────────
function attachButton(mesEl) {
    if (mesEl.getAttribute('is_user') === 'true' || mesEl.classList.contains('is_user')) return;
    if (mesEl.querySelector('.ncard-msg-btn')) return;

    const btn = document.createElement('div');
    btn.className = 'ncard-msg-btn fa-solid fa-quote-right';
    btn.title = '발췌 카드 만들기 (드래그 후 +)';
    btn.style.cssText += 'touch-action:manipulation;cursor:pointer;';

    const handleTap = (e) => {
        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();
        _lastMesEl = mesEl;
        if (document.getElementById('ncard-popup-overlay')) {
            refreshPopupList();
        } else {
            openExcerptPopup(mesEl);
        }
    };

    btn.addEventListener('pointerup', handleTap);
    btn.addEventListener('touchend', handleTap);
    btn.addEventListener('click', handleTap);

    const extraBtns = mesEl.querySelector('.extraMesButtons');
    if (extraBtns) { extraBtns.appendChild(btn); return; }
    const hint = mesEl.querySelector('.extraMesButtonsHint');
    if (hint) { hint.insertAdjacentElement('beforebegin', btn); return; }
    const mesButtons = mesEl.querySelector('.mes_buttons');
    if (mesButtons) mesButtons.appendChild(btn);
}

function attachAllButtons() {
    document.querySelectorAll('.mes').forEach(attachButton);
}

// ── Wand 메뉴 주입 ────────────────────────────────────────
function injectWandMenu() {
    const injectItem = () => {
        const menu = document.getElementById('extensionsMenu');
        if (!menu) return false;
        if (menu.querySelector('#ncard-wand-item')) return true;

        const li = document.createElement('li');
        li.id = 'ncard-wand-item';
        li.innerHTML = `<i class="fa-solid fa-quote-right"></i> Narrative Card`;
        li.style.cssText = 'cursor:pointer; padding: 5px 16px; display:flex; align-items:center; gap:8px;';
        const openG = (e) => {
            e.stopPropagation();
            document.getElementById('extensionsMenu')?.classList.remove('open');
            openGallery();
        };
        li.addEventListener('click', openG);
        li.addEventListener('touchend', openG);

        const firstItem = menu.querySelector('li');
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
jQuery(async () => {
    injectStyles();
    ensureFallbackStyles();

    $('#extensions_settings2').append(buildSettingsHtml());
    bindSettingsEvents();

    attachAllButtons();

    const observer = new MutationObserver(() => attachAllButtons());
    const chatEl = document.getElementById('chat');
    if (chatEl) observer.observe(chatEl, { childList: true, subtree: true });

    injectWandMenu();

    console.log('[NarrativeCard] 확장 로드 완료 (드래그 발췌 모드)');
});
