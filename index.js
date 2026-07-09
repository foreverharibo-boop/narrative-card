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
    background: #d4a017;
    color: #1c1a17;
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
    box-shadow: 0 3px 12px rgba(0,0,0,0.45);
    transition: transform .15s, background .15s;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
}
.ncard-add-btn:hover,
.ncard-add-btn:active { background: #e0bb30; transform: scale(1.12); }

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

/* ── 발췌 팝업 (편집) ─────────────────────────────────────── */
.ncard-popup-overlay {
    position: fixed !important;
    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
    inset: 0 !important;
    width: 100vw !important; height: 100vh !important; height: 100dvh !important;
    min-width: 100vw !important; min-height: 100vh !important;
    margin: 0 !important; padding: 0 !important;
    transform: none !important; -webkit-transform: none !important;
    background: rgba(0,0,0,0.72) !important;
    z-index: 2147483647 !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    box-sizing: border-box !important; overflow: hidden !important;
}
.ncard-popup {
    position: relative !important;
    margin: auto !important;
    background: #1e1c19;
    border-radius: 16px;
    width: min(92vw, 420px) !important;
    max-height: 88vh !important; max-height: 88dvh !important;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    transform: none !important; -webkit-transform: none !important;
}
.ncard-popup-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    flex-shrink: 0;
}
.ncard-popup-title { color: #fff; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.ncard-popup-close { cursor: pointer; opacity: 0.6; font-size: 20px; color: #fff; line-height: 1; padding: 4px; touch-action: manipulation; }
.ncard-popup-close:hover { opacity: 1; }
.ncard-popup-body { overflow-y: auto; padding: 14px 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
.ncard-excerpt-item { background: rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px; }
.ncard-excerpt-text { flex: 1; color: #ddd; font-size: 13px; line-height: 1.6; word-break: break-all; }
.ncard-excerpt-del { flex-shrink: 0; cursor: pointer; opacity: 0.45; color: #ff7070; font-size: 16px; touch-action: manipulation; padding: 2px 4px; }
.ncard-excerpt-del:hover { opacity: 1; }
.ncard-excerpt-empty { color: rgba(255,255,255,0.3); font-size: 13px; text-align: center; padding: 24px 0; }

/* 타입 선택 */
.ncard-type-row { display: flex; gap: 8px; margin-bottom: 2px; }
.ncard-type-btn { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.18); background: transparent; color: #aaa; font-size: 11px; cursor: pointer; touch-action: manipulation; transition: background .15s, color .15s; }
.ncard-type-btn.active { background: #d4a017; color: #1c1a17; border-color: #d4a017; font-weight: 600; }

.ncard-popup-foot { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 8px; flex-shrink: 0; }
.ncard-popup-foot button { flex: 1; padding: 10px 0; border-radius: 10px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; touch-action: manipulation; }
.ncard-btn-clear { background: rgba(255,255,255,0.08); color: #ccc; }
.ncard-btn-gen { background: #d4a017; color: #1c1a17; }
.ncard-btn-gen:hover { background: #e0bb30; }
.ncard-btn-gen:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 미리보기 팝업 ────────────────────────────────────────── */
.ncard-preview-overlay {
    position: fixed !important;
    inset: 0 !important;
    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
    width: 100vw !important; height: 100vh !important; height: 100dvh !important;
    margin: 0 !important; padding: 0 !important;
    background: rgba(0,0,0,0.82) !important;
    z-index: 2147483647 !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    transform: none !important;
    overflow-y: auto !important;
}
.ncard-preview-modal {
    position: relative;
    background: #1a1814;
    border-radius: 18px;
    width: min(96vw, 640px);
    max-height: 94vh;
    max-height: 94dvh;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 70px rgba(0,0,0,0.8);
    margin: auto;
}
.ncard-preview-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    flex-shrink: 0;
}
.ncard-preview-head .title { color: #fff; font-size: 14px; font-weight: 600; }
.ncard-preview-close { cursor: pointer; opacity: 0.6; font-size: 20px; color: #fff; padding: 4px; }
.ncard-preview-close:hover { opacity: 1; }
.ncard-preview-canvas-wrap {
    display: flex; justify-content: center; align-items: center;
    padding: 16px 16px 8px;
    background: #111;
    flex-shrink: 0;
    min-height: 160px;
}
.ncard-preview-canvas-wrap canvas,
.ncard-preview-canvas-wrap img {
    max-width: 100%;
    max-height: 260px;
    border-radius: 8px;
    object-fit: contain;
}
.ncard-preview-controls {
    padding: 14px 18px;
    display: flex; flex-direction: column; gap: 12px;
    overflow-y: auto;
    flex: 1;
}
.ncard-ctrl-row {
    display: flex; align-items: center; gap: 10px;
}
.ncard-ctrl-label {
    font-size: 12px; color: rgba(255,255,255,0.6);
    min-width: 72px; flex-shrink: 0;
}
.ncard-ctrl-row select,
.ncard-ctrl-row input[type=range] { flex: 1; }
.ncard-ctrl-row select {
    background: #2a2723; color: #ddd;
    border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
    padding: 5px 8px; font-size: 12px;
}
.ncard-ctrl-val { font-size: 12px; color: rgba(255,255,255,0.55); min-width: 36px; text-align: right; }

/* 카드 비율 토글 */
.ncard-ratio-row { display: flex; gap: 8px; flex-wrap: wrap; }
.ncard-ratio-btn {
    padding: 5px 14px; border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.18);
    background: transparent; color: #aaa;
    font-size: 11px; cursor: pointer; touch-action: manipulation;
    transition: background .15s, color .15s;
}
.ncard-ratio-btn.active { background: #d4a017; color: #1c1a17; border-color: #d4a017; font-weight: 600; }

/* 글자색 스와치 */
.ncard-color-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ncard-color-swatch {
    width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
    border: 2px solid transparent;
    flex-shrink: 0; transition: transform .12s;
}
.ncard-color-swatch.active { border-color: #fff; transform: scale(1.2); }
.ncard-color-custom {
    width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
    border: 2px solid rgba(255,255,255,0.3);
    overflow: hidden; position: relative;
}
.ncard-color-custom input[type=color] {
    position: absolute; inset: 0; opacity: 0;
    width: 100%; height: 100%; cursor: pointer;
}

.ncard-preview-foot {
    padding: 12px 16px;
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex; gap: 8px; flex-shrink: 0;
}
.ncard-preview-foot button {
    flex: 1; padding: 10px 0; border-radius: 10px; border: none;
    font-size: 13px; font-weight: 600; cursor: pointer;
}
.ncard-preview-foot .btn-cancel { background: rgba(255,255,255,0.08); color: #ccc; }
.ncard-preview-foot .btn-save { background: #d4a017; color: #1c1a17; }
.ncard-preview-foot .btn-save:hover { background: #e0bb30; }

/* ── 생성 완료 팝업 ──────────────────────────────────────── */
.ncard-result-overlay {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important; height: 100vh !important;
    background: rgba(0,0,0,0.8) !important;
    z-index: 2147483647 !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    transform: none !important;
}
.ncard-result-modal {
    background: #1a1814;
    border-radius: 16px;
    width: min(92vw, 480px);
    overflow: hidden;
    display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.8);
}
.ncard-result-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    color: #fff; font-size: 14px; font-weight: 600;
}
.ncard-result-close { cursor: pointer; opacity: 0.6; font-size: 20px; }
.ncard-result-close:hover { opacity: 1; }
.ncard-result-img-wrap { display: flex; justify-content: center; padding: 16px; background: #111; }
.ncard-result-img-wrap img { max-width: 100%; max-height: 300px; border-radius: 8px; object-fit: contain; }
.ncard-result-foot {
    padding: 12px 16px;
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex; gap: 8px;
}
.ncard-result-foot button {
    flex: 1; padding: 10px 0; border-radius: 10px; border: none;
    font-size: 13px; font-weight: 600; cursor: pointer;
}
.ncard-result-foot .btn-delete { background: rgba(255,80,80,0.18); color: #ff8080; }
.ncard-result-foot .btn-delete:hover { background: rgba(255,80,80,0.35); }
.ncard-result-foot .btn-dl { background: #d4a017; color: #1c1a17; }
.ncard-result-foot .btn-dl:hover { background: #e0bb30; }

/* ── 갤러리 모달 ──────────────────────────────────────── */
.ncard-modal-overlay {
    position: fixed !important;
    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
    inset: 0 !important;
    width: 100vw !important; height: 100vh !important; height: 100dvh !important;
    margin: 0 !important;
    background: rgba(0,0,0,.7) !important;
    z-index: 2147483647 !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    transform: none !important;
}
.ncard-modal {
    position: relative;
    background: #1c1a17;
    border-radius: 12px;
    width: min(92vw, 900px);
    max-height: 86vh; max-height: 86dvh;
    display: flex; flex-direction: column;
    overflow: hidden;
}
.ncard-modal-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255,255,255,.1);
    color: #fff;
}
.ncard-modal-close { cursor: pointer; opacity: .7; font-size: 20px; }
.ncard-modal-close:hover { opacity: 1; }
.ncard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 14px;
    padding: 18px;
    overflow-y: auto;
}
/* 갤러리 카드 아이템 */
.ncard-gallery-item {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(255,255,255,0.04);
}
.ncard-gallery-item img {
    width: 100%; display: block;
    cursor: pointer;
    transition: transform .15s;
}
.ncard-gallery-item img:hover { transform: scale(1.03); }
.ncard-gallery-item-btns {
    display: flex; gap: 4px;
    padding: 6px;
    background: rgba(0,0,0,0.6);
}
.ncard-gallery-item-btns button {
    flex: 1; padding: 4px 0; border: none; border-radius: 6px;
    font-size: 11px; font-weight: 600; cursor: pointer;
}
.ncard-gi-dl { background: #d4a017; color: #1c1a17; }
.ncard-gi-del { background: rgba(255,80,80,0.2); color: #ff8080; }
.ncard-gi-del:hover { background: rgba(255,80,80,0.4); }

/* ── 설정 패널 ─────────────────────────────────────────── */
.ncard-settings .inline-drawer-content { padding: 10px 4px; }
.ncard-field { margin-bottom: 10px; }
.ncard-field label { display: block; font-size: 12px; opacity: .8; margin-bottom: 3px; }
.ncard-font-size-row { display: flex; align-items: center; gap: 10px; }
.ncard-font-size-row input[type=range] { flex: 1; }
.ncard-font-size-val { min-width: 32px; font-size: 12px; text-align: right; opacity: .8; }

@media (max-width: 600px) {
    .ncard-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; padding: 12px; }
}
`;
    document.head.appendChild(style);
}

function ensureFallbackStyles() {
    if (document.getElementById('ncard-fallback-css')) return;
    const style = document.createElement('style');
    style.id = 'ncard-fallback-css';
    style.textContent = `
.ncard-popup-overlay{position:fixed!important;inset:0!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;margin:0!important;padding:0!important;background:rgba(0,0,0,.72)!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;transform:none!important;}
.ncard-popup{position:relative!important;margin:auto!important;transform:none!important;}
.ncard-modal-overlay{position:fixed!important;inset:0!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;margin:0!important;background:rgba(0,0,0,.7)!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;transform:none!important;}
.ncard-modal{background:#1c1a17;border-radius:12px;width:min(92vw,900px);max-height:86vh;display:flex;flex-direction:column;overflow:hidden;}
.ncard-msg-btn{cursor:pointer;touch-action:manipulation;}
`;
    document.head.appendChild(style);
}

// ── 상수 ──────────────────────────────────────────────────
const EXT = 'narrative_card';

const THEMES = [
    { value: 'dark',      label: '🌑 다크 (무지 + 세리프)',       bg: '#1c1a17', text: '#ffffff', sub: 'rgba(255,255,255,0.5)',  line: 'rgba(255,255,255,0.25)', meta: 'rgba(255,255,255,0.35)' },
    { value: 'light',     label: '☀️ 라이트 (무지 + 세리프)',     bg: '#f5f3ee', text: '#1c1a17', sub: 'rgba(28,26,23,0.55)',    line: 'rgba(28,26,23,0.25)',    meta: 'rgba(28,26,23,0.4)' },
    { value: 'cream',     label: '📜 크림 / 빈티지 페이퍼',       bg: '#ece3d1', text: '#2b2418', sub: 'rgba(43,36,24,0.55)',    line: 'rgba(43,36,24,0.3)',     meta: 'rgba(43,36,24,0.45)' },
    { value: 'spring',    label: '🌸 봄 (벚꽃 파스텔)',           bg: '#fdf1f4', text: '#5a2e3a', sub: 'rgba(170,90,110,0.65)',  line: 'rgba(214,140,160,0.5)',  meta: 'rgba(170,90,110,0.55)', accent: '#e8a3b3', deco: 'petals' },
    { value: 'summer',    label: '🌊 여름 (시원한 블루)',          bg: '#0f3a4a', text: '#ffffff', sub: 'rgba(255,255,255,0.6)',  line: 'rgba(135,220,235,0.4)', meta: 'rgba(255,255,255,0.45)', accent: '#7fd8e8', deco: 'waves' },
    { value: 'autumn',    label: '🍂 가을 (단풍 브라운)',          bg: '#2e1f14', text: '#f4e3c9', sub: 'rgba(244,227,201,0.6)', line: 'rgba(214,138,73,0.5)',   meta: 'rgba(244,227,201,0.5)', accent: '#d68a49', deco: 'leaves' },
    { value: 'winter',    label: '❄️ 겨울 (눈 내리는 네이비)',    bg: '#10182a', text: '#eef2fb', sub: 'rgba(238,242,251,0.55)', line: 'rgba(180,200,235,0.4)', meta: 'rgba(238,242,251,0.45)', accent: '#aac3ec', deco: 'snow' },
    { value: 'midnight',  label: '🌙 미드나잇 퍼플',              bg: '#0e0b1a', text: '#e8e0ff', sub: 'rgba(200,180,255,0.55)', line: 'rgba(150,100,255,0.35)', meta: 'rgba(200,180,255,0.4)', accent: '#9b6dff', deco: 'stars' },
    { value: 'rosegold',  label: '🌹 로즈 골드',                  bg: '#1a0e0e', text: '#ffd9d9', sub: 'rgba(255,180,180,0.6)',  line: 'rgba(220,130,130,0.4)', meta: 'rgba(255,180,180,0.45)', accent: '#e8a0a0', deco: 'petals' },
    { value: 'forest',    label: '🌿 포레스트 그린',              bg: '#0d1f12', text: '#d4f0c8', sub: 'rgba(180,230,160,0.6)', line: 'rgba(100,180,80,0.4)',   meta: 'rgba(180,230,160,0.45)', accent: '#7bc86a', deco: 'leaves' },
    { value: 'neon',      label: '⚡ 네온 다크',                  bg: '#08080f', text: '#ffffff', sub: 'rgba(0,255,200,0.65)',   line: 'rgba(0,255,200,0.3)',   meta: 'rgba(0,255,200,0.45)', accent: '#00ffc8', deco: 'none' },
    { value: 'parchment', label: '📖 양피지 (세피아)',             bg: '#d9c9a3', text: '#2a1e0e', sub: 'rgba(42,30,14,0.6)',    line: 'rgba(42,30,14,0.3)',    meta: 'rgba(42,30,14,0.45)' },
    { value: 'mono',      label: '🖤 모노크롬 (신문 느낌)',        bg: '#f2f2f2', text: '#111111', sub: 'rgba(17,17,17,0.55)',   line: 'rgba(17,17,17,0.3)',    meta: 'rgba(17,17,17,0.4)' },
    { value: 'dusk',      label: '🌅 황혼 (오렌지-퍼플)',         bg: '#1a0f1f', text: '#ffe8cc', sub: 'rgba(255,180,100,0.6)', line: 'rgba(220,130,70,0.4)',  meta: 'rgba(255,180,100,0.45)', accent: '#ff9b4e', deco: 'petals' },
];

// 카드 비율 옵션
const RATIOS = [
    { value: 'landscape', label: '🖼️ 가로형 (4:3)', w: 760, h: 570 },
    { value: 'portrait',  label: '📱 세로형 (3:4)', w: 570, h: 760 },
    { value: 'square',    label: '⬛ 정사각형 (1:1)', w: 640, h: 640 },
    { value: 'wide',      label: '🎞️ 와이드 (16:9)', w: 800, h: 450 },
];

// 텍스트 색상 프리셋
const TEXT_COLORS = [
    { label: '기본', value: null },   // null = 테마 기본색
    { label: '흰색', value: '#ffffff' },
    { label: '아이보리', value: '#f5f0e8' },
    { label: '골드', value: '#d4a017' },
    { label: '연청', value: '#aac3ec' },
    { label: '연분홍', value: '#ffb8c8' },
    { label: '연두', value: '#a8e4a0' },
    { label: '검정', value: '#111111' },
    { label: '커스텀', value: 'custom' },
];

const DEFAULTS = {
    theme: 'dark',
    font_size: 100,
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
        const trimmed = selectedText.trim();
        // 중복 방지 (6번 요구사항)
        if (!excerptList.some(item => item.text === trimmed)) {
            excerptList.push({ text: trimmed, type: 'narration' });
        }
        _lastMesEl = mesEl;
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

// 드래그만 해도 + 버튼 표시 (mouseup/touchend 즉시 반응, 7번 요구사항)
document.addEventListener('selectionchange', () => {
    // selectionchange는 드래그 중에도 발화 — 짧은 debounce
    clearTimeout(window._ncardSelTimer);
    window._ncardSelTimer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const text = sel.toString().trim();
        if (!text || text.length < 2) { removeAddBtn(); return; }

        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const mesEl = (container.nodeType === Node.TEXT_NODE ? container.parentElement : container)
            ?.closest?.('.mes');
        if (!mesEl) { removeAddBtn(); return; }
        if (mesEl.getAttribute('is_user') === 'true' || mesEl.classList.contains('is_user')) { removeAddBtn(); return; }

        const rect = range.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        showAddBtn(x, rect.top - 8, text, mesEl);
    }, 80);
});

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

    const head = document.createElement('div');
    head.className = 'ncard-popup-head';
    head.innerHTML = `
        <div class="ncard-popup-title">📜 발췌 편집</div>
        <span class="ncard-popup-close" id="ncard-popup-close">&times;</span>
    `;

    const body = document.createElement('div');
    body.className = 'ncard-popup-body';
    body.id = 'ncard-popup-body';

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

    document.getElementById('ncard-popup-close')?.addEventListener('click', closePopup);
    document.getElementById('ncard-popup-close')?.addEventListener('touchend', (e) => { e.preventDefault(); closePopup(); });
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) closePopup(); });
    document.getElementById('ncard-btn-clear')?.addEventListener('click', () => { excerptList = []; refreshPopupList(); });
    document.getElementById('ncard-btn-gen')?.addEventListener('click', async () => {
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
        typeRow.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:1;';

        const btnRow = document.createElement('div');
        btnRow.className = 'ncard-type-row';

        const btnNarr = document.createElement('button');
        btnNarr.className = 'ncard-type-btn' + (item.type === 'narration' ? ' active' : '');
        btnNarr.textContent = '서술';
        btnNarr.addEventListener('click', () => { excerptList[idx].type = 'narration'; refreshPopupList(); });

        const btnQuote = document.createElement('button');
        btnQuote.className = 'ncard-type-btn' + (item.type === 'quote' ? ' active' : '');
        btnQuote.textContent = '대사';
        btnQuote.addEventListener('click', () => { excerptList[idx].type = 'quote'; refreshPopupList(); });

        btnRow.appendChild(btnNarr);
        btnRow.appendChild(btnQuote);

        const textEl = document.createElement('div');
        textEl.className = 'ncard-excerpt-text';
        textEl.textContent = item.text;

        typeRow.appendChild(btnRow);
        typeRow.appendChild(textEl);

        const delBtn = document.createElement('span');
        delBtn.className = 'ncard-excerpt-del';
        delBtn.innerHTML = '&times;';
        delBtn.title = '삭제';
        delBtn.addEventListener('click', () => { excerptList.splice(idx, 1); refreshPopupList(); });

        row.appendChild(typeRow);
        row.appendChild(delBtn);
        body.appendChild(row);
    });
}

function closePopup() {
    document.getElementById('ncard-popup-overlay')?.remove();
}

// ── 미리보기 팝업 (8번 요구사항) ─────────────────────────
// 현재 미리보기 설정 상태
let _previewState = null;

function openPreviewPopup(mesEl) {
    const c = cfg();
    _previewState = {
        theme: c.theme,
        fontSize: c.font_size || 100,
        ratio: c.ratio || 'landscape',
        textColor: null,     // null = 테마 기본색
        customColor: '#ffffff',
    };

    const overlay = document.createElement('div');
    overlay.id = 'ncard-preview-overlay';
    overlay.className = 'ncard-preview-overlay';

    const modal = document.createElement('div');
    modal.className = 'ncard-preview-modal';

    // 헤드
    const head = document.createElement('div');
    head.className = 'ncard-preview-head';
    head.innerHTML = `<span class="title">🎨 카드 미리보기 & 옵션</span>`;
    const hClose = document.createElement('span');
    hClose.className = 'ncard-preview-close';
    hClose.innerHTML = '&times;';
    hClose.addEventListener('click', () => overlay.remove());
    head.appendChild(hClose);

    // 캔버스 미리보기
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'ncard-preview-canvas-wrap';
    const previewImg = document.createElement('img');
    previewImg.id = 'ncard-preview-img';
    canvasWrap.appendChild(previewImg);

    // 컨트롤 영역
    const controls = document.createElement('div');
    controls.className = 'ncard-preview-controls';

    // 1) 테마 선택
    const themeRow = document.createElement('div');
    themeRow.className = 'ncard-ctrl-row';
    const themeLabel = document.createElement('span');
    themeLabel.className = 'ncard-ctrl-label';
    themeLabel.textContent = '테마';
    const themeSelect = document.createElement('select');
    THEMES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.value;
        opt.textContent = t.label;
        if (t.value === _previewState.theme) opt.selected = true;
        themeSelect.appendChild(opt);
    });
    themeRow.appendChild(themeLabel);
    themeRow.appendChild(themeSelect);
    controls.appendChild(themeRow);

    // 2) 카드 비율
    const ratioRow = document.createElement('div');
    ratioRow.className = 'ncard-ctrl-row';
    const ratioLabel = document.createElement('span');
    ratioLabel.className = 'ncard-ctrl-label';
    ratioLabel.textContent = '카드 크기';
    const ratioBtnWrap = document.createElement('div');
    ratioBtnWrap.className = 'ncard-ratio-row';
    RATIOS.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'ncard-ratio-btn' + (r.value === _previewState.ratio ? ' active' : '');
        btn.textContent = r.label;
        btn.dataset.ratio = r.value;
        btn.addEventListener('click', () => {
            _previewState.ratio = r.value;
            ratioBtnWrap.querySelectorAll('.ncard-ratio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updatePreview(mesEl);
        });
        ratioBtnWrap.appendChild(btn);
    });
    ratioRow.appendChild(ratioLabel);
    ratioRow.appendChild(ratioBtnWrap);
    controls.appendChild(ratioRow);

    // 3) 글씨 크기
    const fsRow = document.createElement('div');
    fsRow.className = 'ncard-ctrl-row';
    const fsLabel = document.createElement('span');
    fsLabel.className = 'ncard-ctrl-label';
    fsLabel.textContent = '글씨 크기';
    const fsSlider = document.createElement('input');
    fsSlider.type = 'range'; fsSlider.min = 60; fsSlider.max = 180; fsSlider.step = 5;
    fsSlider.value = _previewState.fontSize;
    fsSlider.id = 'ncard-preview-fs';
    const fsVal = document.createElement('span');
    fsVal.className = 'ncard-ctrl-val';
    fsVal.textContent = _previewState.fontSize + '%';
    fsSlider.addEventListener('input', () => {
        _previewState.fontSize = parseInt(fsSlider.value);
        fsVal.textContent = fsSlider.value + '%';
        updatePreview(mesEl);
    });
    fsRow.appendChild(fsLabel);
    fsRow.appendChild(fsSlider);
    fsRow.appendChild(fsVal);
    controls.appendChild(fsRow);

    // 4) 글자색
    const colorRow = document.createElement('div');
    colorRow.className = 'ncard-ctrl-row';
    const colorLabel = document.createElement('span');
    colorLabel.className = 'ncard-ctrl-label';
    colorLabel.textContent = '글자색';
    const colorWrap = document.createElement('div');
    colorWrap.className = 'ncard-color-row';

    TEXT_COLORS.forEach(col => {
        if (col.value === 'custom') {
            // 커스텀 컬러피커
            const cDiv = document.createElement('div');
            cDiv.className = 'ncard-color-custom';
            cDiv.title = '커스텀';
            cDiv.style.background = _previewState.customColor;
            const input = document.createElement('input');
            input.type = 'color';
            input.value = _previewState.customColor;
            input.addEventListener('input', () => {
                _previewState.textColor = input.value;
                _previewState.customColor = input.value;
                cDiv.style.background = input.value;
                colorWrap.querySelectorAll('.ncard-color-swatch').forEach(s => s.classList.remove('active'));
                updatePreview(mesEl);
            });
            cDiv.appendChild(input);
            colorWrap.appendChild(cDiv);
        } else {
            const swatch = document.createElement('div');
            swatch.className = 'ncard-color-swatch' + (col.value === null ? ' active' : '');
            swatch.title = col.label;
            swatch.style.background = col.value || 'linear-gradient(135deg,#fff 50%,#888 50%)';
            if (col.value === null) swatch.style.background = 'linear-gradient(135deg,#d4a017 50%,#1c1a17 50%)';
            swatch.addEventListener('click', () => {
                _previewState.textColor = col.value;
                colorWrap.querySelectorAll('.ncard-color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                updatePreview(mesEl);
            });
            colorWrap.appendChild(swatch);
        }
    });

    colorRow.appendChild(colorLabel);
    colorRow.appendChild(colorWrap);
    controls.appendChild(colorRow);

    // 푸터
    const foot = document.createElement('div');
    foot.className = 'ncard-preview-foot';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn-cancel';
    btnCancel.textContent = '취소';
    btnCancel.addEventListener('click', () => overlay.remove());
    const btnSave = document.createElement('button');
    btnSave.className = 'btn-save';
    btnSave.textContent = '✅ 카드 생성';
    btnSave.addEventListener('click', async () => {
        overlay.remove();
        await runGenerate(mesEl);
    });
    foot.appendChild(btnCancel);
    foot.appendChild(btnSave);

    modal.appendChild(head);
    modal.appendChild(canvasWrap);
    modal.appendChild(controls);
    modal.appendChild(foot);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) overlay.remove(); });

    // 테마 select 이벤트
    themeSelect.addEventListener('change', () => {
        _previewState.theme = themeSelect.value;
        updatePreview(mesEl);
    });

    // 초기 미리보기
    updatePreview(mesEl);
}

function updatePreview(mesEl) {
    if (!_previewState) return;
    const img = document.getElementById('ncard-preview-img');
    if (!img) return;

    const charName = getCharacterName();
    const mesId = mesEl?.getAttribute('mesid');
    const cardData = {
        speaker: charName,
        location: '',
        lines: excerptList.map(item => ({ type: item.type, text: item.text })),
    };

    const dataUrl = renderCard(
        cardData,
        _previewState.theme,
        charName,
        mesId,
        _previewState.fontSize,
        _previewState.ratio,
        _previewState.textColor
    );
    img.src = dataUrl;
}

// ── 카드 생성 실행 ────────────────────────────────────────
async function runGenerate(mesEl) {
    try {
        const charName = getCharacterName();
        const mesId = mesEl?.getAttribute('mesid');
        const state = _previewState || {};
        const c = cfg();

        const cardData = {
            speaker: charName,
            location: '',
            lines: excerptList.map(item => ({ type: item.type, text: item.text })),
        };

        const dataUrl = renderCard(
            cardData,
            state.theme || c.theme,
            charName,
            mesId,
            state.fontSize || c.font_size,
            state.ratio || c.ratio,
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

        // 생성 완료 팝업 (4번 요구사항)
        openResultPopup(dataUrl, savedId, charName);

        toastr.success('📜 카드 생성 완료!', '', { timeOut: 1500 });
    } catch (e) {
        console.error('[NarrativeCard] 오류:', e);
        toastr.error(e.message || '카드 생성 실패', '', { timeOut: 5000 });
    }
}

// ── 생성 완료 팝업 (4번) ─────────────────────────────────
function openResultPopup(dataUrl, savedId, charName) {
    const overlay = document.createElement('div');
    overlay.className = 'ncard-result-overlay';

    const modal = document.createElement('div');
    modal.className = 'ncard-result-modal';

    const head = document.createElement('div');
    head.className = 'ncard-result-head';
    head.innerHTML = `<span>📜 카드 생성 완료</span>`;
    const hClose = document.createElement('span');
    hClose.className = 'ncard-result-close';
    hClose.innerHTML = '&times;';
    hClose.addEventListener('click', () => overlay.remove());
    head.appendChild(hClose);

    const imgWrap = document.createElement('div');
    imgWrap.className = 'ncard-result-img-wrap';
    const img = document.createElement('img');
    img.src = dataUrl;
    imgWrap.appendChild(img);

    const foot = document.createElement('div');
    foot.className = 'ncard-result-foot';

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-delete';
    btnDel.textContent = '🗑️ 삭제';
    btnDel.addEventListener('click', async () => {
        await deleteCard(savedId, charName);
        overlay.remove();
        toastr.info('카드가 삭제되었습니다.', '', { timeOut: 1500 });
    });

    const btnDl = document.createElement('button');
    btnDl.className = 'btn-dl';
    btnDl.textContent = '💾 이미지 저장';
    btnDl.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `narrative_card_${Date.now()}.png`;
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

// ── 계절/테마 장식 ────────────────────────────────────────
function seededRandom(seed) {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function drawDecoration(ctx, W, H, theme) {
    if (!theme.deco || theme.deco === 'none') return;
    const rand = seededRandom(42);
    ctx.save();

    if (theme.deco === 'petals') {
        for (let i = 0; i < 14; i++) {
            const x = rand() * W, y = rand() * H * 0.35 + (rand() > 0.5 ? H * 0.65 : 0);
            const r = 4 + rand() * 5, rot = rand() * Math.PI * 2;
            ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
            ctx.fillStyle = theme.accent; ctx.globalAlpha = 0.18 + rand() * 0.15;
            ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    } else if (theme.deco === 'waves') {
        ctx.globalAlpha = 0.15; ctx.strokeStyle = theme.accent; ctx.lineWidth = 1.5;
        for (let row = 0; row < 3; row++) {
            const baseY = H - 40 - row * 14;
            ctx.beginPath();
            for (let x = 0; x <= W; x += 8) { const y = baseY + Math.sin((x / 40) + row) * 4; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
            ctx.stroke();
        }
        ctx.globalAlpha = 0.08;
        for (let row = 0; row < 2; row++) {
            const baseY = 30 + row * 12;
            ctx.beginPath();
            for (let x = 0; x <= W; x += 8) { const y = baseY + Math.sin((x / 35) + row + 1) * 3; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
            ctx.stroke();
        }
    } else if (theme.deco === 'leaves') {
        for (let i = 0; i < 10; i++) {
            const x = rand() * W, y = rand() * H * 0.3 + (rand() > 0.5 ? H * 0.7 : 0);
            const r = 5 + rand() * 6, rot = rand() * Math.PI * 2;
            ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
            ctx.fillStyle = theme.accent; ctx.globalAlpha = 0.16 + rand() * 0.14;
            ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.8, 0, 0, r); ctx.quadraticCurveTo(-r * 0.8, 0, 0, -r); ctx.fill();
            ctx.restore();
        }
    } else if (theme.deco === 'snow') {
        for (let i = 0; i < 26; i++) {
            const x = rand() * W, y = rand() * H, r = 1 + rand() * 2.2;
            ctx.fillStyle = theme.accent; ctx.globalAlpha = 0.2 + rand() * 0.25;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
    } else if (theme.deco === 'stars') {
        for (let i = 0; i < 30; i++) {
            const x = rand() * W, y = rand() * H, r = 0.8 + rand() * 1.8;
            ctx.fillStyle = theme.accent || '#fff'; ctx.globalAlpha = 0.15 + rand() * 0.3;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
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
        if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = ch; }
        else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
}

function renderCard(cardData, themeKey, charName, mesId, fontSizePct = 100, ratioKey = 'landscape', textColorOverride = null) {
    const theme = THEMES.find(t => t.value === themeKey) || THEMES[0];
    const ratioConf = RATIOS.find(r => r.value === ratioKey) || RATIOS[0];

    const W = ratioConf.w;
    const baseH = ratioConf.h;
    const PAD_X = Math.round(W * 0.085);
    const PAD_BOTTOM = 70;

    const scale = (fontSizePct || 100) / 100;
    const baseNarr  = Math.round(13 * scale);
    const baseQuote = Math.round(18 * scale);
    const baseMeta  = Math.round(11 * scale);

    const FONT_NARR  = `${baseNarr}px Georgia, "Noto Serif KR", serif`;
    const FONT_QUOTE = `bold ${baseQuote}px Georgia, "Noto Serif KR", serif`;
    const FONT_META  = `${baseMeta}px Georgia, "Noto Serif KR", serif`;

    const mCanvas = document.createElement('canvas');
    const mctx = mCanvas.getContext('2d');
    const maxTextWidth = W - PAD_X * 2;

    const blocks = cardData.lines.map(line => {
        const isQuote = line.type === 'quote';
        mctx.font = isQuote ? FONT_QUOTE : FONT_NARR;
        const text = isQuote ? `"${line.text}"` : line.text;
        const wrapped = wrapText(mctx, text, maxTextWidth);
        const lineHeight = isQuote ? Math.round(30 * scale) : Math.round(24 * scale);
        return { isQuote, wrapped, lineHeight, gap: Math.round(22 * scale) };
    });

    let contentHeight = 0;
    blocks.forEach((b, i) => {
        contentHeight += b.wrapped.length * b.lineHeight;
        if (i < blocks.length - 1) contentHeight += b.gap;
    });

    const H = Math.max(baseH, contentHeight + 200 + PAD_BOTTOM);

    const canvas = document.createElement('canvas');
    canvas.width = W * 2; canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);
    drawDecoration(ctx, W, H, theme);

    let y = (H - contentHeight) / 2 - 20;
    ctx.textBaseline = 'alphabetic';

    blocks.forEach((b, i) => {
        ctx.font = b.isQuote ? FONT_QUOTE : FONT_NARR;
        // 글자색: override > 테마 기본
        if (textColorOverride) {
            ctx.fillStyle = textColorOverride;
        } else {
            ctx.fillStyle = b.isQuote ? theme.text : theme.sub;
        }
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
    if (mesId !== undefined && mesId !== null) {
        ctx.textAlign = 'right';
        ctx.fillText(`#${mesId}`, W - PAD_X, H - 32);
        ctx.textAlign = 'left';
    }

    return canvas.toDataURL('image/png');
}

// ── 갤러리 저장/불러오기/삭제 ────────────────────────────
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
    } catch (_) { _ncardUseServer = false; }
    return _ncardUseServer;
}

const DB_NAME = 'NarrativeCardGallery';
const STORE_NAME = 'cards';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// 반환값: savedId (삭제에 사용)
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

async function deleteCard(id, charName) {
    if (await checkServerAvailable()) {
        // 서버: 카드 파일 삭제 (인덱스에서 제거)
        try {
            await fetch('/api/userdata/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: `${NCARD_DIR}/cards/${id}.json`, data: '' }),
            });
        } catch (_) {}
        const index = (await serverLoad(NCARD_INDEX_FILE)) || [];
        const newIndex = index.filter(e => e.id !== id);
        await serverSave(NCARD_INDEX_FILE, newIndex);
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
        } catch (e) { return []; }
    }
}

// ── 갤러리 모달 (5번: 저장/삭제 버튼) ───────────────────
async function openGallery() {
    const cards = await getAllCards();

    const overlay = document.createElement('div');
    overlay.id = 'ncard-gallery-modal';
    overlay.className = 'ncard-modal-overlay';
    overlay.setAttribute('style',
        'position:fixed!important;inset:0!important;top:0!important;left:0!important;right:0!important;bottom:0!important;' +
        'width:100vw!important;height:100vh!important;margin:0!important;' +
        'background:rgba(0,0,0,.7)!important;z-index:2147483647!important;' +
        'display:flex!important;align-items:center!important;justify-content:center!important;transform:none!important;'
    );
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const modal = document.createElement('div');
    modal.className = 'ncard-modal';

    const head = document.createElement('div');
    head.className = 'ncard-modal-head';
    const countSpan = document.createElement('span');
    countSpan.id = 'ncard-gallery-count';
    countSpan.textContent = `📜 서술 카드 갤러리 (${cards.length})`;
    head.appendChild(countSpan);
    const closeBtn = document.createElement('span');
    closeBtn.className = 'ncard-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => overlay.remove());
    head.appendChild(closeBtn);

    const grid = document.createElement('div');
    grid.className = 'ncard-grid';
    grid.id = 'ncard-gallery-grid';

    function renderGrid(cardList) {
        grid.innerHTML = '';
        if (cardList.length === 0) {
            grid.innerHTML = '<p style="color:#999;font-size:13px;grid-column:1/-1;">아직 생성된 카드가 없습니다.</p>';
            return;
        }
        cardList.forEach(c => {
            const item = document.createElement('div');
            item.className = 'ncard-gallery-item';

            const img = document.createElement('img');
            img.src = c.dataUrl;
            img.addEventListener('click', () => window.open(c.dataUrl, '_blank'));

            const btnRow = document.createElement('div');
            btnRow.className = 'ncard-gallery-item-btns';

            const btnDl = document.createElement('button');
            btnDl.className = 'ncard-gi-dl';
            btnDl.textContent = '💾 저장';
            btnDl.addEventListener('click', () => {
                const a = document.createElement('a');
                a.href = c.dataUrl;
                a.download = `narrative_card_${c.createdAt || Date.now()}.png`;
                a.click();
            });

            const btnDel = document.createElement('button');
            btnDel.className = 'ncard-gi-del';
            btnDel.textContent = '🗑️ 삭제';
            btnDel.addEventListener('click', async () => {
                await deleteCard(c.id, c.charName);
                item.remove();
                const remaining = grid.querySelectorAll('.ncard-gallery-item').length;
                document.getElementById('ncard-gallery-count').textContent = `📜 서술 카드 갤러리 (${remaining})`;
                if (remaining === 0) grid.innerHTML = '<p style="color:#999;font-size:13px;grid-column:1/-1;">아직 생성된 카드가 없습니다.</p>';
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
        `<option value="${r.value}" ${(c.ratio || 'landscape') === r.value ? 'selected' : ''}>${r.label}</option>`
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
        <label>기본 글씨 크기</label>
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

// ── 메시지 버튼 ──────────────────────────────────────────
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
        if (document.getElementById('ncard-popup-overlay')) refreshPopupList();
        else openExcerptPopup(mesEl);
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

// ── Wand 메뉴 ─────────────────────────────────────────────
function injectWandMenu() {
    const injectItem = () => {
        const menu = document.getElementById('extensionsMenu');
        if (!menu) return false;
        if (menu.querySelector('#ncard-wand-item')) return true;
        const li = document.createElement('li');
        li.id = 'ncard-wand-item';
        li.innerHTML = `<i class="fa-solid fa-quote-right"></i> Narrative Card`;
        li.style.cssText = 'cursor:pointer; padding: 5px 16px; display:flex; align-items:center; gap:8px;';
        const openG = (e) => { e.stopPropagation(); document.getElementById('extensionsMenu')?.classList.remove('open'); openGallery(); };
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
    document.addEventListener('click', (e) => { if (e.target?.closest?.('#extensionsMenuButton')) setTimeout(injectItem, 50); });
    let tries = 0;
    const pollId = setInterval(() => { tries++; if (injectItem() || tries > 20) clearInterval(pollId); }, 500);
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
    console.log('[NarrativeCard] 확장 로드 완료 v2');
});
ENDOFFILE
echo "완료"
