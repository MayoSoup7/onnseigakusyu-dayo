from pathlib import Path
root=Path('/mnt/data/v9inspect/eigomimi_v9')
js=root/'app.js'; css=root/'styles.css'; html=root/'index.html'
s=js.read_text()
# Replace page renderer with a safer version: no blob URL recreation for hide/show, and use hidden attribute via class only.
old="""function pageHTML(p){const url=blobUrl(p.blob);return `<article class=\"page ${p.visible===false?'hiddenPage':''}\" data-page=\"${p.id}\"><div class=\"pageHead\"><span class=\"pageNum\">P.${esc(p.pageNo||'—')}</span><div class=\"pageActions\"><button onclick=\"togglePage('${p.id}')\">${p.visible===false?'👁 再表示':'🙈 非表示'}</button><button onclick=\"addPractice('${p.id}')\">＋Practice</button><button class=\"danger\" onclick=\"deletePage('${p.id}')\">🗑 画像削除</button></div></div>${url?`<img src=\"${url}\" alt=\"${esc(p.name||'ページ画像')}\">`:''}<div id=\"prs-${p.id}\"></div></article>`}"""
new="""function pageHTML(p){const hidden=p.visible===false;const url=blobUrl(p.blob);return `<article class=\"page ${hidden?'hiddenPage':''}\" ${hidden?'hidden':''} data-page=\"${p.id}\"><div class=\"pageHead\"><span class=\"pageNum\">P.${esc(p.pageNo||'—')}</span><div class=\"pageActions\"><button onclick=\"togglePage('${p.id}')\">🙈 非表示</button><button onclick=\"addPractice('${p.id}')\">＋Practice</button><button class=\"danger\" onclick=\"deletePage('${p.id}')\">🗑 画像削除</button></div></div>${url?`<img src=\"${url}\" alt=\"${esc(p.name||'ページ画像')}\">`:''}<div id=\"prs-${p.id}\"></div></article>`}"""
if old not in s: raise SystemExit('pageHTML pattern not found')
s=s.replace(old,new)
# Replace togglePage with DOM-only hide/show + persistent DB update, avoiding full rerender and broken image URLs.
old="""async function togglePage(id){const p=await get('pages',id);if(!p)return;const pages=(await all('pages')).filter(x=>x.lesson===p.lesson).sort((a,b)=>a.order-b.order);if(p.id===pages[0]?.id)return alert('Lessonの1ページ目は常に表示されます。');p.visible=p.visible===false;await put('pages',p);await renderLesson()}"""
new="""async function togglePage(id){const p=await get('pages',id);if(!p)return;const pages=(await all('pages')).filter(x=>x.lesson===p.lesson).sort((a,b)=>a.order-b.order);if(p.id===pages[0]?.id)return alert('Lessonの1ページ目は常に表示されます。');p.visible=false;await put('pages',p);const el=document.querySelector(`[data-page=\"${id}\"]`);if(el){el.hidden=true;el.classList.add('hiddenPage')}await renderHiddenPages()}
async function restorePage(id){const p=await get('pages',id);if(!p)return;p.visible=true;await put('pages',p);const el=document.querySelector(`[data-page=\"${id}\"]`);if(el){el.hidden=false;el.classList.remove('hiddenPage')}await renderHiddenPages()} 
async function renderHiddenPages(){const list=(await all('pages')).filter(p=>p.lesson===state.lesson&&p.visible===false).sort((a,b)=>a.order-b.order);$('hiddenPageList').innerHTML=list.length?list.map(p=>`<div class=\"hiddenRow\"><span>P.${esc(p.pageNo||'—')}　${esc(p.name||'ページ画像')}</span><button onclick=\"restorePage('${p.id}')\">👁 再表示</button></div>`).join(''):'<div class=\"empty\">非表示のページはありません。</div>'}"""
if old not in s: raise SystemExit('toggle pattern not found')
s=s.replace(old,new)
# openBook should set top button to edit mode; render only visible pages.
old="""async function openBook(){state.book=true;$('editToolbar').hidden=true;$('pages').hidden=true;$('lessonTitle').innerHTML='';$('audioManager').hidden=true;$('bookView').hidden=false;const pages=(await all('pages')).filter(p=>p.visible!==false).sort((a,b)=>a.lesson-b.lesson||a.order-b.order);let last=0;$('bookView').innerHTML='<div class=\"bookToolbar\"><button id=\"bookEditInline\">✏️ 本を編集</button></div>'+pages.map(p=>{const h=p.lesson!==last?`<div class=\"lessonHeader\">${lessonLabel(p.lesson)}</div>`:'';last=p.lesson;return h+pageHTMLBook(p)}).join('')||'<div class=\"page empty\">ページがありません。</div>';await loadPracticesBook();$('bookEditInline').onclick=()=>renderLesson()}"""
new="""async function openBook(){state.book=true;$('editToolbar').hidden=true;$('pages').hidden=true;$('lessonTitle').innerHTML='';$('audioManager').hidden=true;$('bookView').hidden=false;$('bookBtn').textContent='✏️ 本を編集';const pages=(await all('pages')).filter(p=>p.visible!==false).sort((a,b)=>a.lesson-b.lesson||a.order-b.order);let last=0;$('bookView').innerHTML=pages.map(p=>{const h=p.lesson!==last?`<div class=\"lessonHeader\">${lessonLabel(p.lesson)}</div>`:'';last=p.lesson;return h+pageHTMLBook(p)}).join('')||'<div class=\"page empty\">ページがありません。</div>';await loadPracticesBook()} 
function closeBook(){state.book=false;$('bookBtn').textContent='📖 本を読む';renderLesson()}"""
if old not in s: raise SystemExit('openBook pattern not found')
s=s.replace(old,new)
# renderLesson reset top button and hidden list.
old="""async function renderLesson(){state.book=false;$('bookView').hidden=true;$('pages').hidden=false;$('editToolbar').hidden=false;$('audioManager').hidden=true;const lesson=await get('lessons','L'+state.lesson);$('lessonTitle').innerHTML=`<h2>${lessonLabel(state.lesson)}</h2><div class=\"editHint\">1ページ目は常に表示。2ページ目以降は非表示⇄再表示できます。</div>`;const pages=(await all('pages')).filter(p=>p.lesson===state.lesson).sort((a,b)=>a.order-b.order);$('pages').innerHTML=pages.map(pageHTML).join('')||`<div class=\"page empty\">このLessonにはまだページがありません。<br>「＋ページ画像」から追加してください。</div>`;await loadPractices()}"""
new="""async function renderLesson(){state.book=false;$('bookView').hidden=true;$('pages').hidden=false;$('editToolbar').hidden=false;$('audioManager').hidden=true;$('bookBtn').textContent='📖 本を読む';const lesson=await get('lessons','L'+state.lesson);$('lessonTitle').innerHTML=`<h2>${lessonLabel(state.lesson)}</h2><div class=\"editHint\">1ページ目は常に表示。2ページ目以降は非表示⇄再表示できます。</div>`;const pages=(await all('pages')).filter(p=>p.lesson===state.lesson).sort((a,b)=>a.order-b.order);$('pages').innerHTML=pages.map(pageHTML).join('')||`<div class=\"page empty\">このLessonにはまだページがありません。<br>「＋ページ画像」から追加してください。</div>`;await loadPractices();await renderHiddenPages()}"""
if old not in s: raise SystemExit('renderLesson pattern not found')
s=s.replace(old,new)
# Add bindings for hidden dialog and book toggle.
old="""function bind(){$('themeBtn').onclick=()=>{state.dark=!state.dark;applyTheme()};$('addPageBtn').onclick=()=>$('pageFiles').click();"""
new="""function bind(){$('themeBtn').onclick=()=>{state.dark=!state.dark;applyTheme()};$('addPageBtn').onclick=()=>$('pageFiles').click();"""
# no-op, then replace later exact book binding
s=s.replace("$('bookBtn').onclick=openBook;", "$('bookBtn').onclick=()=>state.book?closeBook():openBook();$('hideInfoBtn').onclick=async()=>{await renderHiddenPages();$('hiddenDialog').showModal()};$('closeHiddenDialog').onclick=()=>$('hiddenDialog').close();")
s=s.replace("window.deleteAudio=deleteAudio;", "window.deleteAudio=deleteAudio;window.restorePage=restorePage;")
js.write_text(s)

# HTML: add hidden dialog and keep existing button; add book edit state handled in JS.
h=html.read_text()
insert='''\n<dialog id="hiddenDialog">\n<div class="hiddenDialogBox"><h3>🙈 非表示ページ</h3><p class="dialogNote">ここから解説ページを再表示できます。ページ画像も音声も削除されません。</p><div id="hiddenPageList"></div><div class="dialogBtns"><button id="closeHiddenDialog">閉じる</button></div></div>\n</dialog>\n'''
h=h.replace('<dialog id="recordDialog">', insert+'\n<dialog id="recordDialog">')
html.write_text(h)

# CSS: fixed header; page hidden truly hidden; dialogs; mobile sizing.
c=css.read_text()
c=c.replace('header{position:sticky;top:0;z-index:20;', 'header{position:fixed;top:0;left:0;right:0;z-index:100;')
c=c.replace('main{padding:12px;', 'main{padding:12px;padding-top:92px;')
c=c.replace('.page.hiddenPage{opacity:.48;border-style:dashed}', '.page.hiddenPage{display:none}')
c += '''\n.hiddenDialogBox{min-width:min(92vw,520px)}\n.dialogNote{font-size:13px;opacity:.75}\n.hiddenRow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #ffffff14}\n.light .hiddenRow{border-color:#eee}\n.hiddenRow span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n@media(max-width:600px){header{padding-top:calc(10px + env(safe-area-inset-top));padding-bottom:10px}.brand{font-size:20px}.headerBtns button{padding:9px 10px}main{padding-top:calc(82px + env(safe-area-inset-top))}}\n'''
css.write_text(c)

# bump cache version and DB stays v9 to preserve current registered media.
sw=root/'sw.js'
sw.write_text(sw.read_text().replace('v9','v10'))
