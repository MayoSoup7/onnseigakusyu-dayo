const DB='eigomimi-v9',VER=2;let db;
const $=id=>document.getElementById(id);
let state={lesson:1,view:'lesson',current:null,queue:[],idx:-1,repeat:false,A:null,B:null,ab:false,editing:null,recording:null,dark:true};
const audio=new Audio();audio.preload='metadata';
const ownAudio=$('ownAudio');
function req(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
async function all(store){return req(tx(store).getAll())}async function get(store,key){return req(tx(store).get(key))}async function put(store,v){return req(tx(store,'readwrite').put(v))}async function del(store,key){return req(tx(store,'readwrite').delete(key))}
function uid(){return crypto.randomUUID()}function fmt(s){if(!isFinite(s))return'0:00';s=Math.max(0,s);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
function blobUrl(blob){return blob?URL.createObjectURL(blob):''}
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,VER);r.onupgradeneeded=e=>{const d=e.target.result;for(const s of ['lessons','pages','audios','practices','recordings','pageStates'])if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})};r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
async function seed(){for(let i=1;i<=26;i++)if(!await get('lessons','L'+i))await put('lessons',{id:'L'+i,num:i,title:`Lesson ${String(i).padStart(2,'0')}`})}
async function ensurePageStates(){const pages=await all('pages');for(const p of pages){if(!await get('pageStates',p.id))await put('pageStates',{id:p.id,visible:p.visible!==false})}}
async function withVisibility(pages){return Promise.all(pages.map(async p=>{const st=await get('pageStates',p.id);return Object.assign({},p,{visible:st?st.visible:(p.visible!==false)})}))}
function lessonLabel(n){return`Lesson ${String(n).padStart(2,'0')}`}function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function normalizeAudioLibrary(){
  const audios=await all('audios'); if(!audios.length)return;
  const sorted=[...audios].sort((a,b)=>{const al=a.lesson??999,bl=b.lesson??999;if(al!==bl)return al-bl;return (a.order??0)-(b.order??0)});
  for(let i=0;i<sorted.length;i++){const a=sorted[i];if(a.order!==i||a.lesson!==null){a.order=i;a.lesson=null;await put('audios',a)}}
}
async function init(){await openDB();await seed();await ensurePageStates();await normalizeAudioLibrary();fillLessons();loadTheme();bind();await renderLesson()}
function fillLessons(){const el=$('lessonSelect');if(!el)return;el.innerHTML=Array.from({length:26},(_,i)=>`<option value="${i+1}">${lessonLabel(i+1)}</option>`).join('');el.value=String(state.lesson);if(!el.value)el.selectedIndex=0}
function pageHTML(p){const hidden=p.visible===false;const url=blobUrl(p.blob);return `<article class="page ${hidden?'hiddenPage':''}" ${hidden?'hidden':''} data-page="${p.id}"><div class="pageHead"><span class="pageNum">P.${esc(p.pageNo||'—')}</span><div class="pageActions"><button onclick="addPractice('${p.id}')">＋Practice</button><button class="danger" onclick="deletePage('${p.id}')">🗑 画像削除</button></div></div>${url?`<img src="${url}" alt="${esc(p.name||'ページ画像')}">`:''}<div id="prs-${p.id}"></div></article>`}
async function renderLesson(){state.view='lesson';$('bookView').hidden=true;$('pages').hidden=false;$('editToolbar').hidden=false;$('audioLibraryView').hidden=true;$('audioManager').hidden=true;$('bookBtn').textContent='📖 本を読む';$('audioLibraryBtn').textContent='🎵 音声ライブラリ';const lesson=await get('lessons','L'+state.lesson);let pages=(await all('pages')).filter(p=>p.lesson===state.lesson).sort((a,b)=>a.order-b.order);pages=await withVisibility(pages);$('lessonTitle').innerHTML=`<h2>${lessonLabel(state.lesson)}</h2><div class="editHint">「🙈 非表示」でこのLessonの2ページ目以降をまとめて非表示。「👁 再表示」でまとめて戻せます。1ページ目は常に表示されます。</div>`;$('pages').innerHTML=pages.map(pageHTML).join('')||`<div class="page empty">このLessonにはまだページがありません。<br>「＋ページ画像」から追加してください。</div>`;updateLessonVisibilityButton(pages);await loadPractices()}
async function loadPractices(){const prs=(await all('practices')).filter(p=>p.lesson===state.lesson);for(const p of prs){const el=document.querySelector(`#prs-${p.pageId}`);if(!el)continue;const au=p.audioId?await get('audios',p.audioId):null;el.insertAdjacentHTML('beforeend',`<div class="practice"><div class="practiceTop"><span class="practiceName">${esc(p.name)}</span><div class="practiceBtns"><button onclick="playPractice('${p.id}')">▶️</button><button onclick="editPractice('${p.id}')">編集</button><button onclick="recordPractice('${p.id}')">🎙️</button><button class="danger" onclick="deletePractice('${p.id}')">🗑</button></div></div><div class="audioChip">${au?esc(au.name):'音声未登録'}</div></div>`)}}
async function addPages(files){if(!files?.length)return;let pages=(await all('pages')).filter(p=>p.lesson===state.lesson);let order=pages.length;for(const f of files){await put('pages',{id:uid(),lesson:state.lesson,order:order,pageNo:guessPageNo(f.name,order+1),visible:true,blob:f,name:f.name});order++}$('pageFiles').value='';await renderLesson()}
function guessPageNo(name,n){const m=name.match(/(?:P|p|page|ページ)[ _-]?(\d+)/);return m?m[1]:n}
async function deletePage(id){if(!confirm('このページ画像を削除しますか？\nこのページのPracticeも削除されます。'))return;const prs=(await all('practices')).filter(p=>p.pageId===id);for(const p of prs)await del('practices',p.id);await del('pages',id);await renderLesson()}
async function toggleLessonVisibility(){
  let pages=(await all('pages')).filter(p=>p.lesson===state.lesson).sort((a,b)=>a.order-b.order);
  pages=await withVisibility(pages);
  if(pages.length<=1)return alert('このLessonには2ページ目以降がありません。');
  const hasHidden=pages.slice(1).some(p=>p.visible===false);
  const makeVisible=hasHidden;
  for(const p of pages.slice(1)){await put('pageStates',{id:p.id,visible:makeVisible})}
  await put('pageStates',{id:pages[0].id,visible:true});
  await renderCurrentView();
}
function updateLessonVisibilityButton(pages){
  const btn=$('hideInfoBtn');
  if(!btn)return;
  const hasHidden=pages.slice(1).some(p=>p.visible===false);
  btn.textContent=hasHidden?'👁 再表示':'🙈 非表示';
  btn.title=hasHidden?'非表示にした2ページ目以降をすべて再表示':'このLessonの2ページ目以降をすべて非表示';
}
async function addPractice(pageId){
  state.practicePageId=pageId;
  const audios=(await all('audios')).sort((a,b)=>a.order-b.order);
  $('practiceAudioList').innerHTML=audios.length?audios.map((a,i)=>`<label class="audioPick"><input type="checkbox" value="${a.id}"><span class="audioPickNo">${i+1}</span><span>${esc(a.name)}</span></label>`).join(''):'<div class="empty">先に「🎵 音声ライブラリ」から音声を登録してください。</div>';
  $('practiceAudioDialog').showModal();
}
async function savePracticeSelection(){
  const page=await get('pages',state.practicePageId);if(!page)return;
  const ids=[...document.querySelectorAll('#practiceAudioList input[type=checkbox]:checked')].map(x=>x.value);
  if(!ids.length){await put('practices',{id:uid(),pageId:page.id,lesson:page.lesson,name:'Practice',audioId:null});}
  else{const allAudios=await all('audios');for(const id of ids){const a=allAudios.find(x=>x.id===id);if(a)await put('practices',{id:uid(),pageId:page.id,lesson:page.lesson,name:a.name.replace(/\.[^/.]+$/,''),audioId:a.id})}}
  $('practiceAudioDialog').close();await renderCurrentView();
}
async function editPractice(id){state.editing=id;const p=await get('practices',id);$('practiceName').value=p.name;const audios=(await all('audios')).sort((a,b)=>a.order-b.order);$('audioSelect').innerHTML='<option value="">音声なし</option>'+audios.map(a=>`<option value="${a.id}" ${a.id===p.audioId?'selected':''}>${esc(a.name)}</option>`).join('');$('editDialog').showModal()}
async function savePractice(){const p=await get('practices',state.editing);p.name=$('practiceName').value.trim()||'Practice';p.audioId=$('audioSelect').value||null;await put('practices',p);$('editDialog').close();await renderCurrentView()}
async function deletePractice(id){if(!confirm('このPracticeを削除しますか？（音声ファイル自体は削除しません）'))return;await del('practices',id);await renderCurrentView()}
async function addAudios(files){if(!files?.length)return;const audios=await all('audios');let order=audios.length;for(const f of files){await put('audios',{id:uid(),lesson:null,order:order++,name:f.name,blob:f})}$('audioFiles').value='';await openAudioLibrary()}
async function renderAudioLibrary(){const list=(await all('audios')).sort((a,b)=>a.order-b.order);$('audioList').innerHTML=list.length?list.map((a,i)=>`<div class="audioRow"><span class="audioOrder"><input type="number" min="1" max="${list.length}" value="${i+1}" onchange="setAudioOrder('${a.id}',this.value)"></span><span class="name">${esc(a.name)}</span><div><button onclick="renameAudio('${a.id}')">✏️ 名前</button><button onclick="moveAudio('${a.id}',-1)">↑</button><button onclick="moveAudio('${a.id}',1)">↓</button><button onclick="playAudioById('${a.id}')">▶️</button><button class="danger" onclick="deleteAudio('${a.id}')">🗑</button></div></div>`).join(''):'<div class="empty">まだ音声がありません。<br>「＋音声を追加」からまとめて登録できます。</div>'}
async function openAudioLibrary(){state.view='audio';$('editToolbar').hidden=true;$('pages').hidden=true;$('lessonTitle').innerHTML='';$('bookView').hidden=true;$('audioManager').hidden=true;$('audioLibraryView').hidden=false;$('bookBtn').textContent='📖 本を読む';$('audioLibraryBtn').textContent='← Lessonに戻る';await renderAudioLibrary()}
async function closeAudioLibrary(){state.view='lesson';$('audioLibraryView').hidden=true;$('audioLibraryBtn').textContent='🎵 音声ライブラリ';await renderLesson()}
async function renameAudio(id){const a=await get('audios',id);if(!a)return;const name=prompt('音声タイトルを入力してください',a.name)||'';if(!name.trim())return;a.name=name.trim();await put('audios',a);await renderAudioLibrary()}
async function playAudioById(id){const a=await get('audios',id);if(a)await startAudio(a,a.name)}
async function deleteAudio(id){const a=await get('audios',id);if(!a)return;if(!confirm(`「${a.name}」を音声ライブラリから削除しますか？\nこの音声を使っているPracticeは「音声未登録」になります。`))return;const prs=(await all('practices')).filter(p=>p.audioId===id);for(const p of prs){p.audioId=null;await put('practices',p)}await del('audios',id);await normalizeAudioLibrary();if(state.view==='audio')await renderAudioLibrary();else await renderCurrentView()}
async function reorderAudios(list){for(let i=0;i<list.length;i++){list[i].order=i;list[i].lesson=null;await put('audios',list[i])}}
async function moveAudio(id,dir){const list=(await all('audios')).sort((a,b)=>a.order-b.order);const i=list.findIndex(a=>a.id===id),j=i+dir;if(i<0||j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];await reorderAudios(list);await renderAudioLibrary()}
async function setAudioOrder(id,value){const list=(await all('audios')).sort((a,b)=>a.order-b.order);const from=list.findIndex(a=>a.id===id);let to=Math.max(1,Math.min(list.length,Number(value)||1))-1;if(from<0||to===from){await renderAudioLibrary();return}const [item]=list.splice(from,1);list.splice(to,0,item);await reorderAudios(list);await renderAudioLibrary()}
async function renderCurrentView(){if(state.view==='book')await openBook();else if(state.view==='audio')await openAudioLibrary();else await renderLesson()}
async function startAudio(a,label){state.current=a;state.queue=[a];state.idx=0;state.A=null;state.B=null;state.ab=false;updateAB();audio.src=blobUrl(a.blob);audio.playbackRate=Number($('speed').value);audio.currentTime=0;$('now').textContent=label||a.name;await audio.play()}
async function playPractice(id){const p=await get('practices',id);if(!p?.audioId)return alert('このPracticeには音声がありません。編集から音声を選んでください。');const a=await get('audios',p.audioId);await startAudio(a,p.name)}
audio.ontimeupdate=()=>{$('cur').textContent=fmt(audio.currentTime);$('dur').textContent=fmt(audio.duration);$('seek').value=audio.duration?audio.currentTime/audio.duration*1000:0;if(state.ab&&state.B!==null&&audio.currentTime>=state.B){audio.currentTime=state.A??0;audio.play()}};
audio.onended=async()=>{if(state.ab)return;if(state.repeat){audio.currentTime=state.A??0;await audio.play()}};
function updateAB(){$('markA').textContent='A:'+(state.A===null?'—':fmt(state.A));$('markB').textContent='B:'+(state.B===null?'—':fmt(state.B));$('ab').textContent=state.ab?'A-B ON':'A-B OFF'}
async function recordPractice(id){state.recording=id;const p=await get('practices',id);$('recordTarget').textContent=p.name;const rs=(await all('recordings')).filter(r=>r.practiceId===id).sort((a,b)=>b.created-a.created)[0];if(rs){ownAudio.src=blobUrl(rs.blob);ownAudio.hidden=false;$('deleteRecording').hidden=false}else{ownAudio.removeAttribute('src');ownAudio.hidden=true;$('deleteRecording').hidden=true}$('recordState').textContent='待機中';$('recordDialog').showModal()}
let rec,chunks=[];function bestMime(){return ['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported?.(x))||''}
$('recordStart').onclick=async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const mime=bestMime();rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});const old=(await all('recordings')).filter(r=>r.practiceId===state.recording);for(const r of old)await del('recordings',r.id);await put('recordings',{id:uid(),practiceId:state.recording,created:Date.now(),blob});ownAudio.src=blobUrl(blob);ownAudio.hidden=false;$('deleteRecording').hidden=false;$('recordState').textContent='保存しました'};rec.start();$('recordStart').disabled=true;$('recordStop').disabled=false;$('recordState').textContent='録音中…';const p=await get('practices',state.recording);if(p?.audioId){const a=await get('audios',p.audioId);audio.src=blobUrl(a.blob);audio.currentTime=0;audio.playbackRate=Number($('speed').value);await audio.play()}}catch(e){alert('マイクを許可できませんでした。iPhoneではHTTPSページでマイクを許可してください。')}};
$('recordStop').onclick=()=>{if(rec&&rec.state!=='inactive')rec.stop();$('recordStart').disabled=false;$('recordStop').disabled=true};$('refOnly').onclick=()=>audio.play();$('ownOnly').onclick=()=>ownAudio.play();$('bothPlay').onclick=()=>{audio.play();ownAudio.play()};$('deleteRecording').onclick=async()=>{for(const r of (await all('recordings')).filter(r=>r.practiceId===state.recording))await del('recordings',r.id);ownAudio.removeAttribute('src');ownAudio.hidden=true;$('deleteRecording').hidden=true};$('closeRecord').onclick=()=>$('recordDialog').close();
async function openBook(){
  state.view='book';$('editToolbar').hidden=true;$('pages').hidden=true;$('lessonTitle').innerHTML='';$('audioManager').hidden=true;$('audioLibraryView').hidden=true;$('bookView').hidden=false;$('bookBtn').textContent='✏️ 本を編集';$('audioLibraryBtn').textContent='🎵 音声ライブラリ';
  const pages=await withVisibility((await all('pages')).sort((a,b)=>a.lesson-b.lesson||a.order-b.order));
  const groups=new Map();for(const p of pages){if(!groups.has(p.lesson))groups.set(p.lesson,[]);groups.get(p.lesson).push(p)}
  let html='';
  for(const [lesson,allPages] of groups){const hasHidden=allPages.slice(1).some(p=>p.visible===false);html+=`<div class="lessonHeader"><span>${lessonLabel(lesson)}</span><button class="bookHideBtn" onclick="toggleBookLessonVisibility(${lesson})">${hasHidden?'👁 再表示':'🙈 2ページ目以降を非表示'}</button></div>`;for(const pg of allPages){if(pg.visible===false)continue;html+=pageHTMLBook(pg)}}
  $('bookView').innerHTML=html||'<div class="page empty">ページがありません。</div>';await loadPracticesBook()
}
async function toggleBookLessonVisibility(lesson){const pages=await withVisibility((await all('pages')).filter(p=>p.lesson===lesson).sort((a,b)=>a.order-b.order));if(pages.length<=1)return;const hasHidden=pages.slice(1).some(p=>p.visible===false);const visible=hasHidden;for(const pg of pages.slice(1))await put('pageStates',{id:pg.id,visible});await openBook()}
function closeBook(){state.view='lesson';$('bookBtn').textContent='📖 本を読む';renderLesson()}
function pageHTMLBook(p){return `<article class="page" data-page="${p.id}"><div class="pageHead"><span class="pageNum">P.${esc(p.pageNo||'—')}</span></div>${p.blob?`<img src="${blobUrl(p.blob)}" alt="${esc(p.name||'ページ画像')}">`:''}<div id="bookprs-${p.id}"></div></article>`}
async function loadPracticesBook(){for(const p of await all('practices')){const el=document.querySelector(`#bookprs-${p.pageId}`);if(!el)continue;const a=p.audioId?await get('audios',p.audioId):null;el.insertAdjacentHTML('beforeend',`<div class="practice"><div class="practiceTop"><span class="practiceName">${esc(p.name)}</span><div class="practiceBtns"><button onclick="playPractice('${p.id}')">▶️</button><button onclick="recordPractice('${p.id}')">🎙️</button></div></div><div class="audioChip">${a?esc(a.name):'音声未登録'}</div></div>`)}}
function loadTheme(){const saved=localStorage.getItem('eigomimi-theme');state.dark=saved!=='light';applyTheme()}function applyTheme(){document.body.classList.toggle('light',!state.dark);$('themeBtn').textContent=state.dark?'☀️':'🌙';localStorage.setItem('eigomimi-theme',state.dark?'dark':'light')}
function bind(){$('themeBtn').onclick=()=>{state.dark=!state.dark;applyTheme()};$('addPageBtn').onclick=()=>$('pageFiles').click();$('pageFiles').onchange=e=>addPages(e.target.files);$('addAudioBtn').onclick=()=>$('audioFiles').click();$('audioFiles').onchange=e=>addAudios(e.target.files);$('audioLibraryBtn').onclick=()=>state.view==='audio'?closeAudioLibrary():openAudioLibrary();$('cancelPracticePick').onclick=()=>$('practiceAudioDialog').close();$('savePracticePick').onclick=e=>{e.preventDefault();savePracticeSelection()};$('lessonSelect').onchange=async e=>{state.lesson=Number(e.target.value)||1;await renderLesson()};$('bookBtn').onclick=()=>state.view==='book'?closeBook():openBook();$('hideInfoBtn').onclick=toggleLessonVisibility;$('savePractice').onclick=e=>{e.preventDefault();savePractice()};$('play').onclick=()=>audio.paused?audio.play():audio.pause();audio.onplay=()=>$('play').textContent='⏸';audio.onpause=()=>$('play').textContent='▶️';$('seek').oninput=()=>{if(audio.duration)audio.currentTime=Number($('seek').value)/1000*audio.duration};$('restart').onclick=()=>{audio.currentTime=state.A??0;audio.play()};$('repeat').onclick=()=>{state.repeat=!state.repeat;$('repeat').style.background=state.repeat?'#e91e8c':''};$('speed').onchange=()=>audio.playbackRate=Number($('speed').value);$('setA').onclick=()=>{state.A=audio.currentTime;updateAB()};$('setB').onclick=()=>{state.B=audio.currentTime;updateAB()};$('ab').onclick=()=>{state.ab=!state.ab;if(state.ab&&state.A===null)state.A=audio.currentTime;if(state.ab&&state.B===null&&isFinite(audio.duration))state.B=audio.duration;updateAB()}}
window.addPractice=addPractice;window.editPractice=editPractice;window.playPractice=playPractice;window.recordPractice=recordPractice;window.deletePage=deletePage;window.deletePractice=deletePractice;window.playAudioById=playAudioById;window.deleteAudio=deleteAudio;window.renameAudio=renameAudio;window.savePracticeSelection=savePracticeSelection;window.moveAudio=moveAudio;window.setAudioOrder=setAudioOrder;window.toggleBookLessonVisibility=toggleBookLessonVisibility;
init().catch(e=>alert('初期化に失敗しました: '+e.message));
