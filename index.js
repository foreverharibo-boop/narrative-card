/**
 * 📜 Narrative Card - SillyTavern Extension
 * 채팅 출력에서 핵심 서술+대사를 AI로 추출해 텍스트 카드 이미지로 만듭니다.
 * (Polaroid 확장의 API 호출/설정 패턴을 재사용)
 */

import { getContext, extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

// ── CSS 주입 ──────────────────────────────────────────────
function injectStyles() {
    if (document.getElementById('ncard-injected-css')) return;
    const style = document.createElement('style');
    style.id = 'ncard-injected-css';
    style.textContent = `
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

/* ── 모달(갤러리) ──────────────────────────────────────── */
.ncard-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.7);
    z-index: 99998;
    display: flex; align-items: center; justify-content: center;
}
.ncard-modal {
    background: #1c1a17;
    border-radius: 12px;
    width: min(92vw, 900px);
    max-height: 86vh;
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
.ncard-grid img {
    width: 100%;
    border-radius: 8px;
    cursor: pointer;
    transition: transform .15s;
}
.ncard-grid img:hover { transform: scale(1.03); }

/* ── 지시 팝업 ──────────────────────────────────────────── */
.ncard-dir-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.6);
    z-index: 99999;
    display: flex; align-items: center; justify-content: center;
}
.ncard-dir-box {
    background: #232017;
    border-radius: 14px;
    padding: 22px 20px 16px;
    width: min(90vw, 360px);
    color: #eee;
}
.ncard-dir-box h3 { margin: 0 0 12px; font-size: 15px; font-weight: 500; }
.ncard-dir-box textarea {
    width: 100%;
    min-height: 70px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,.15);
    background: rgba(255,255,255,.05);
    color: #eee;
    padding: 8px 10px;
    font-size: 13px;
    resize: vertical;
    box-sizing: border-box;
}
.ncard-dir-btns { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }
.ncard-dir-btns button {
    padding: 7px 16px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    cursor: pointer;
}
.ncard-dir-cancel { background: rgba(255,255,255,.1); color: #ccc; }
.ncard-dir-ok { background: #d4a017; color: #1c1a17; font-weight: 500; }
.ncard-dir-ok:hover { background: #e0ab1f; }

@media (max-width: 600px) {
    .ncard-img { max-width: 240px; }
    .ncard-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; padding: 12px; }
}
`;
    document.head.appendChild(style);
}

const EXT = 'narrative_card';

const TEXT_MODELS = [
    { value: 'gemini-3.5-flash',      label: '✨ Gemini 3.5 Flash' },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
    { value: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
];

const LAYOUTS = [
    { value: '3',  label: '서술 + 대사 + 서술 (3단)' },
    { value: '5',  label: '서술 + 대사 + 서술 + 대사 + 서술 (5단)' },
    { value: 'q',  label: '대사만 단독' },
];

const THEMES = [
    { value: 'dark',   label: '다크 (무지 배경 + 세리프)', bg: '#1c1a17', text: '#ffffff', sub: 'rgba(255,255,255,0.5)', line: 'rgba(255,255,255,0.25)', meta: 'rgba(255,255,255,0.35)' },
    { value: 'light',  label: '라이트 (무지 배경 + 세리프)', bg: '#f5f3ee', text: '#1c1a17', sub: 'rgba(28,26,23,0.55)', line: 'rgba(28,26,23,0.25)', meta: 'rgba(28,26,23,0.4)' },
    { value: 'cream',  label: '크림톤 / 빈티지 페이퍼', bg: '#ece3d1', text: '#2b2418', sub: 'rgba(43,36,24,0.55)', line: 'rgba(43,36,24,0.3)', meta: 'rgba(43,36,24,0.45)' },
];

const DEFAULTS = {
    api_mode: 'direct',
    direct_api_key: '',
    direct_project_id: '',
    direct_region: 'global',
    profile_id: '',
    text_model: 'gemini-3.5-flash',
    layout: '5',
    theme: 'dark',
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

// ── Vertex AI Express 호출 (Polaroid와 동일 패턴) ─────────
async function vertexPost(apiKey, projectId, region, model, body) {
    const regions = region === 'global' ? ['global', 'us-central1'] : [region];
    let lastErr;
    for (const r of regions) {
        const isLast = r === regions[regions.length - 1];
        const base = r === 'global'
            ? 'https://aiplatform.googleapis.com/v1'
            : `https://${r}-aiplatform.googleapis.com/v1`;
        const url = `${base}/projects/${projectId}/locations/${r}/publishers/google/models/${model}:generateContent`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.text();
                lastErr = new Error(`Vertex API [${res.status}] (${r}/${model}): ${err.slice(0, 300)}`);
                if ((res.status === 404 || res.status === 400) && !isLast) continue;
                throw lastErr;
            }
            return await res.json();
        } catch (e) {
            lastErr = e;
            if (!isLast) continue;
            throw e;
        }
    }
    throw lastErr || new Error('Vertex API 호출 실패');
}

async function apiPost(model, body) {
    const c = cfg();
    let apiKey = '';
    let projectId = c.direct_project_id || '';
    let region = c.direct_region || 'global';

    if (c.api_mode === 'profile' && c.profile_id) {
        apiKey = c.direct_api_key || '';
        if (!apiKey) {
            try {
                const svc = SillyTavern.getContext().ConnectionManagerRequestService;
                const profile = svc.getSupportedProfiles().find(p => p.id === c.profile_id);
                if (profile) {
                    const secretId = profile['secret-id'];
                    const res = await fetch('/api/secrets/view', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ key: secretId }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        apiKey = data.value || data[secretId] || '';
                    }
                }
            } catch (_) {}
        }
    } else {
        apiKey = c.direct_api_key || '';
    }

    if (!apiKey) throw new Error('API 키가 없습니다. 설정 패널에서 Vertex AI Express 키(AIza...)를 입력해주세요.');
    if (!projectId) throw new Error('Project ID가 없습니다. 설정 패널에서 입력해주세요.');

    return vertexPost(apiKey, projectId, region, model, body);
}

// ── 최근 채팅 맥락 수집 ────────────────────────────────────
function getRecentChatContext(mesEl, maxMessages = 3) {
    const targetId = parseInt(mesEl.getAttribute('mesid') || '-1', 10);
    const allMes = Array.from(document.querySelectorAll('.mes'));
    const targetIdx = allMes.findIndex(el => parseInt(el.getAttribute('mesid') || '-1', 10) === targetId);
    const endIdx = targetIdx >= 0 ? targetIdx : allMes.length - 1;
    const slice = allMes.slice(Math.max(0, endIdx - maxMessages + 1), endIdx + 1);

    const lines = slice.map(el => {
        const isUser = el.getAttribute('is_user') === 'true' || el.classList.contains('is_user');
        const name = el.querySelector('.name_text')?.innerText?.trim() || (isUser ? 'User' : 'Character');
        const text = el.querySelector('.mes_text')?.innerText?.trim() || '';
        if (!text) return null;
        return `[${isUser ? 'USER' : 'CHARACTER'} — ${name}]: ${text}`;
    }).filter(Boolean);

    return lines.join('\n\n');
}

function getCharacterName() {
    try {
        const ctx = getContext();
        if (ctx.characters && ctx.characterId !== undefined) {
            return ctx.characters[ctx.characterId]?.name || '';
        }
    } catch (_) {}
    return '';
}

// ── 1단계: AI로 서술/대사 발췌 ──────────────────────────────
const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'OFF' },
];

// layout: '3' | '5' | 'q' → 반환 형식: { lines: [{type:'narration'|'quote', text}], speaker, location }
async function extractCard(sceneText, chatContext, layout, charName) {
    const c = cfg();

    const structureSpec = layout === 'q'
        ? `정확히 1개 항목: 가장 인상적인 대사 1줄.`
        : layout === '3'
            ? `정확히 3개 항목, 순서대로: 서술, 대사, 서술.`
            : `정확히 5개 항목, 순서대로: 서술, 대사, 서술, 대사, 서술.`;

    const prompt = `당신은 롤플레이 채팅에서 가장 인상적인 순간을 발췌하는 편집자입니다.

아래 LATEST MESSAGE(마지막 메시지)를 중심으로, 가장 임팩트 있는 서술(지문)과 대사를 골라 카드용 텍스트를 만드세요.

규칙:
- ${structureSpec}
- "서술"은 지문/행동 묘사 문장 1개 (원문에서 거의 그대로 가져오되, 너무 길면 자연스럽게 다듬어 1문장으로 압축. 25단어/60자 이내)
- "대사"는 따옴표 안의 실제 대사 1줄 그대로 (의역하지 말고 원문 그대로, 따옴표는 빼고 텍스트만)
- 화자 이름과 장소/상황을 짧게 1개씩 뽑아주세요 (예: 화자 "로카스", 장소 "스트리밍 룸")
- 반드시 LATEST MESSAGE 안의 내용만 사용하세요. 이전 메시지는 인물/맥락 파악용으로만 참고.
- 과장하거나 새로운 내용을 창작하지 마세요.

이전 대화 맥락:
${(chatContext || sceneText).slice(0, 2000)}

LATEST MESSAGE (여기서 발췌):
${sceneText.slice(0, 1500)}

캐릭터 이름 참고: ${charName || '(알 수 없음)'}

다음 JSON 형식으로만 응답하세요. 다른 설명이나 마크다운 코드블록 없이 순수 JSON만:
{
  "speaker": "화자 이름",
  "location": "장소/상황 짧은 설명",
  "lines": [
    {"type": "narration", "text": "..."},
    {"type": "quote", "text": "..."}
  ]
}`;

    const data = await apiPost(c.text_model, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 20000 },
        safetySettings: SAFETY_SETTINGS,
    });

    const finishReason = data?.candidates?.[0]?.finishReason;
    console.log('[NarrativeCard] extract finishReason:', finishReason);

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!raw) {
        console.warn('[NarrativeCard] 추출 응답 비정상:', JSON.stringify(data?.candidates?.[0] || data));
        throw new Error('카드 내용 추출 실패 (응답 없음)');
    }

    // AI가 코드블록으로 감싸는 경우 제거
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (e) {
        console.warn('[NarrativeCard] JSON 파싱 실패, 원문:', cleaned);
        throw new Error('카드 내용 파싱 실패');
    }

    if (!Array.isArray(parsed.lines) || parsed.lines.length === 0) {
        throw new Error('추출된 카드 내용이 비어있습니다.');
    }

    return parsed;
}

// ── 2단계: Canvas로 카드 이미지 합성 ────────────────────────
function wrapText(ctx, text, maxWidth) {
    const words = text.split('');
    const lines = [];
    let cur = '';
    for (const ch of words) {
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

function renderCard(cardData, themeKey, charName, mesId) {
    const theme = THEMES.find(t => t.value === themeKey) || THEMES[0];
    const W = 760, PAD_X = 64, PAD_BOTTOM = 70;
    const FONT_NARR = '13px Georgia, "Noto Serif KR", serif';
    const FONT_QUOTE = 'bold 18px Georgia, "Noto Serif KR", serif';
    const FONT_META = '11px Georgia, "Noto Serif KR", serif';

    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    const maxTextWidth = W - PAD_X * 2;

    // 줄 단위 높이 계산
    const blocks = cardData.lines.map(line => {
        const isQuote = line.type === 'quote';
        mctx.font = isQuote ? FONT_QUOTE : FONT_NARR;
        const text = isQuote ? `"${line.text}"` : line.text;
        const wrapped = wrapText(mctx, text, maxTextWidth);
        const lineHeight = isQuote ? 30 : 24;
        return { isQuote, wrapped, lineHeight, gap: 22 };
    });

    const dividerHeight = 1, dividerGap = 22;
    let contentHeight = 0;
    blocks.forEach((b, i) => {
        contentHeight += b.wrapped.length * b.lineHeight;
        if (i < blocks.length - 1) contentHeight += b.gap;
    });

    const H = Math.max(600, contentHeight + 220 + PAD_BOTTOM);

    const canvas = document.createElement('canvas');
    canvas.width = W * 2; // retina
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // 배경
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);

    // 텍스트 블록 그리기 (세로 중앙 정렬)
    let y = (H - contentHeight) / 2 - 20;
    ctx.textBaseline = 'alphabetic';

    blocks.forEach((b, i) => {
        ctx.font = b.isQuote ? FONT_QUOTE : FONT_NARR;
        ctx.fillStyle = b.isQuote ? theme.text : theme.sub;
        b.wrapped.forEach(line => {
            ctx.fillText(line, PAD_X, y + b.lineHeight * 0.7);
            y += b.lineHeight;
        });
        if (i < blocks.length - 1) y += b.gap;
    });

    // 하단 메타 정보
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

// ── IndexedDB 갤러리 저장 ───────────────────────────────────
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
    try {
        const db = await openDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).add({ charName, dataUrl, meta, createdAt: Date.now() });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        console.log('[NarrativeCard] IndexedDB 저장 완료');
    } catch (e) {
        console.warn('[NarrativeCard] 갤러리 저장 실패:', e);
    }
}

async function getAllCards() {
    try {
        const db = await openDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result.reverse());
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return [];
    }
}

// ── 메시지에 카드로 표시 ─────────────────────────────────────
function showCardInline(btn, dataUrl) {
    const mesEl = btn.closest('.mes');
    const mesText = mesEl?.querySelector('.mes_text');
    if (!mesText) return;

    let wrap = mesEl.querySelector('.ncard-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'ncard-wrap';
        mesText.insertAdjacentElement('afterend', wrap);
    }
    wrap.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'ncard-img';
    img.src = dataUrl;
    img.addEventListener('click', () => window.open(dataUrl, '_blank'));
    wrap.appendChild(img);
}

// ── 버튼 클릭 → 카드 생성 ────────────────────────────────────
async function runGenerate(messageText, btn, mesEl) {
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        toastr.info('📜 장면 발췌 중...', '', { timeOut: 3000 });
        const c = cfg();
        const charName = getCharacterName();
        const chatContext = mesEl ? getRecentChatContext(mesEl, 3) : messageText;

        const cardData = await extractCard(messageText, chatContext, c.layout, charName);
        console.log('[NarrativeCard] cardData:', cardData);

        const mesId = mesEl?.getAttribute('mesid');
        const dataUrl = renderCard(cardData, c.theme, cardData.speaker || charName, mesId);

        showCardInline(btn, dataUrl);

        await saveToGallery(charName, dataUrl, {
            timestamp: new Date().toISOString(),
            snippet: messageText.slice(0, 120),
            cardData,
        });

        toastr.success('📜 카드 생성 완료!');
    } catch (e) {
        console.error('[NarrativeCard] 오류:', e);
        toastr.error(e.message || '카드 생성 실패', '', { timeOut: 5000 });
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

// ── 메시지 버튼 부착 ─────────────────────────────────────────
function attachButton(mesEl) {
    if (mesEl.querySelector('.ncard-msg-btn')) return;

    const btn = document.createElement('div');
    btn.className = 'ncard-msg-btn fa-solid fa-quote-right';
    btn.title = '서술 카드 만들기';

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = mesEl.querySelector('.mes_text')?.innerText?.trim() || '';
        if (!text) return;
        runGenerate(text, btn, mesEl);
    });

    const hint = mesEl.querySelector('.extraMesButtonsHint');
    if (hint) {
        hint.insertAdjacentElement('beforebegin', btn);
        return;
    }
    const mesButtons = mesEl.querySelector('.mes_buttons');
    if (mesButtons) mesButtons.appendChild(btn);
}

function attachAllButtons() {
    document.querySelectorAll('.mes').forEach(attachButton);
}

// ── 갤러리 모달 ───────────────────────────────────────────────
async function openGallery() {
    const cards = await getAllCards();

    const overlay = document.createElement('div');
    overlay.className = 'ncard-modal-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const modal = document.createElement('div');
    modal.className = 'ncard-modal';

    const head = document.createElement('div');
    head.className = 'ncard-modal-head';
    head.innerHTML = `<span>📜 서술 카드 갤러리 (${cards.length})</span>`;
    const closeBtn = document.createElement('span');
    closeBtn.className = 'ncard-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => overlay.remove());
    head.appendChild(closeBtn);

    const grid = document.createElement('div');
    grid.className = 'ncard-grid';
    if (cards.length === 0) {
        grid.innerHTML = '<p style="color:#999;font-size:13px;">아직 생성된 카드가 없습니다.</p>';
    } else {
        cards.forEach(c => {
            const img = document.createElement('img');
            img.src = c.dataUrl;
            img.addEventListener('click', () => window.open(c.dataUrl, '_blank'));
            grid.appendChild(img);
        });
    }

    modal.appendChild(head);
    modal.appendChild(grid);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// ── 설정 패널 ───────────────────────────────────────────────
function buildSettingsHtml() {
    const c = cfg();
    const textModelOpts = TEXT_MODELS.map(m =>
        `<option value="${m.value}" ${c.text_model === m.value ? 'selected' : ''}>${m.label}</option>`
    ).join('');
    const layoutOpts = LAYOUTS.map(l =>
        `<option value="${l.value}" ${c.layout === l.value ? 'selected' : ''}>${l.label}</option>`
    ).join('');
    const themeOpts = THEMES.map(t =>
        `<option value="${t.value}" ${c.theme === t.value ? 'selected' : ''}>${t.label}</option>`
    ).join('');

    return `
<div class="ncard-settings">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>📜 Narrative Card</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">

      <div class="ncard-field">
        <label>API 모드</label>
        <select id="ncard-api-mode" class="text_pole">
          <option value="direct" ${c.api_mode === 'direct' ? 'selected' : ''}>직접 입력</option>
          <option value="profile" ${c.api_mode === 'profile' ? 'selected' : ''}>연결 프로필 사용</option>
        </select>
      </div>

      <div class="ncard-field">
        <label>Vertex AI Express API Key</label>
        <input type="text" id="ncard-api-key" class="text_pole" value="${c.direct_api_key}" placeholder="AIza..." />
      </div>

      <div class="ncard-field">
        <label>Project ID</label>
        <input type="text" id="ncard-project-id" class="text_pole" value="${c.direct_project_id}" />
      </div>

      <div class="ncard-field">
        <label>Region</label>
        <input type="text" id="ncard-region" class="text_pole" value="${c.direct_region}" placeholder="global" />
      </div>

      <div class="ncard-field">
        <label>텍스트 생성 모델</label>
        <select id="ncard-text-model" class="text_pole">${textModelOpts}</select>
      </div>

      <div class="ncard-field">
        <label>카드 구성</label>
        <select id="ncard-layout" class="text_pole">${layoutOpts}</select>
      </div>

      <div class="ncard-field">
        <label>배경 / 톤</label>
        <select id="ncard-theme" class="text_pole">${themeOpts}</select>
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
    const save = () => {
        const s = getExtSettings();
        if (!s) return;
        s.api_mode = $('#ncard-api-mode').val();
        s.direct_api_key = $('#ncard-api-key').val().trim();
        s.direct_project_id = $('#ncard-project-id').val().trim();
        s.direct_region = ($('#ncard-region').val() || 'global').trim();
        s.text_model = $('#ncard-text-model').val();
        s.layout = $('#ncard-layout').val();
        s.theme = $('#ncard-theme').val();
        saveSettingsDebounced();
        toastr.success('설정 저장됨', '', { timeOut: 1500 });
    };

    $('#ncard-save-settings').on('click', save);
    $('#ncard-open-gallery').on('click', openGallery);
}

// ── 초기화 ──────────────────────────────────────────────────
jQuery(async () => {
    injectStyles();

    $('#extensions_settings2').append(buildSettingsHtml());
    bindSettingsEvents();

    attachAllButtons();

    const observer = new MutationObserver(() => attachAllButtons());
    const chatEl = document.getElementById('chat');
    if (chatEl) observer.observe(chatEl, { childList: true, subtree: true });

    console.log('[NarrativeCard] 확장 로드 완료');
});
