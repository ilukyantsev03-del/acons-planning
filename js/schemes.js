'use strict';

(function () {
  const BUCKET = 'liv-schemes';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const WRITERS = new Set(['admin', 'planner']);
  const STATUSES = ['Не начато','В работе','Выполнено','Освидетельствовано','Принято','Ограничение'];
  const DONE = new Set(['Выполнено','Освидетельствовано','Принято']);
  const state = { schemeId:'', pdf:null, page:1, zoom:1, draw:false, start:null, draft:null, filter:'all', cache:new Map(), pending:null };

  const $s = id => document.getElementById(id);
  const p = () => { try { return project || null; } catch (_) { return null; } };
  const role = () => window.LIV_ACCESS?.role || window.LIV_REMOTE_SYNC?.role?.() || '';
  const canWrite = () => WRITERS.has(role());
  const now = () => new Date().toISOString();
  const clamp = (v,min=0,max=1) => Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
  const makeId = prefix => typeof uid === 'function' ? uid(prefix) : `${prefix}-${crypto.randomUUID()}`;
  const html = value => typeof esc === 'function' ? esc(value) : String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const safeName = value => String(value||'scheme.pdf').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^\.+/,'').slice(-120) || 'scheme.pdf';

  function ensure() {
    const current = p();
    if (!current) return false;
    if (!Array.isArray(current.schemes)) current.schemes=[];
    if (!Array.isArray(current.schemeMarks)) current.schemeMarks=[];
    return true;
  }

  async function rememberPdf(id, doc) {
    if (state.cache.has(id)) state.cache.delete(id);
    state.cache.set(id, doc);

    while (state.cache.size > 3) {
      const oldestId = state.cache.keys().next().value;
      if (!oldestId || String(oldestId) === String(id)) break;
      const old = state.cache.get(oldestId);
      state.cache.delete(oldestId);
      try { await old?.destroy?.(); } catch (_) {}
    }
  }

  function derivedProgress(status, frontId) {
    const current = p();
    const front = (current?.fronts || []).find(x => String(x.id) === String(frontId || ''));
    const total = Number(front?.totalQty || 0);
    const done = Number(front?.doneQty || 0);
    if (front && total > 0 && Number.isFinite(done)) {
      return Math.max(0, Math.min(100, Math.round(done / total * 100)));
    }
    return null;
  }

  const schemes = () => (p()?.schemes||[]).filter(x=>x.active!==false).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  const scheme = id => (p()?.schemes||[]).find(x=>String(x.id)===String(id))||null;
  const mark = id => (p()?.schemeMarks||[]).find(x=>String(x.id)===String(id))||null;
  const marks = (schemeId,page=null) => (p()?.schemeMarks||[]).filter(x=>x.active!==false&&String(x.schemeId)===String(schemeId)&&(page===null||Number(x.pageNo||1)===Number(page)));
  const markClass = status => DONE.has(status)?'sch-done':status==='В работе'?'sch-work':status==='Ограничение'?'sch-risk':'sch-idle';

  function options(list,selected,empty='—') {
    return `<option value="">${html(empty)}</option>`+(list||[]).filter(x=>x.active!==false).map(x=>`<option value="${html(x.id)}" ${String(x.id)===String(selected||'')?'selected':''}>${html(x.name||x.id)}</option>`).join('');
  }

  function frontOptions(selected) {
    let rows=[];
    try { rows=typeof activeFronts==='function'?activeFronts():(p()?.fronts||[]).filter(x=>x.active!==false); } catch(_) {}
    return '<option value="">—</option>'+rows.map(x=>{
      let label=x.id; try { if(typeof frontLabel==='function') label=frontLabel(x); } catch(_) {}
      return `<option value="${html(x.id)}" ${String(x.id)===String(selected||'')?'selected':''}>${html(label)}</option>`;
    }).join('');
  }

  function addStyles() {
    if ($s('liv-schemes-style')) return;
    const style=document.createElement('style'); style.id='liv-schemes-style';
    style.textContent=`
      .sch-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:4px 0 14px}.sch-head h1{margin:0;font-size:26px}.sch-head p{margin:6px 0 0;color:var(--muted);font-size:13px}
      .sch-stats{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:9px;margin-bottom:14px}.sch-stat{padding:13px;border:1px solid #dfe4eb;border-radius:10px;background:#fff}.sch-stat span{display:block;color:#667085;font-size:11px;margin-bottom:6px}.sch-stat strong{font-size:20px}
      .sch-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:14px;align-items:start}.sch-side{padding:14px;position:sticky;top:78px}.sch-side h2{margin:0 0 10px;font-size:16px}.sch-search{width:100%;height:38px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:9px}.sch-list{display:grid;gap:6px;max-height:650px;overflow:auto}.sch-item{padding:10px;border:1px solid #e3e7ed;border-radius:9px;background:#fff;text-align:left;cursor:pointer}.sch-item.active{background:#eef4ff;border-color:#829ac0}.sch-item strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}.sch-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:5px;color:#667085;font-size:10px}
      .sch-view{padding:0;overflow:hidden}.sch-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid #e6eaf0;flex-wrap:wrap}.sch-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.sch-toolbar .btn{min-height:34px;padding:6px 9px;font-size:12px}.sch-page{min-width:90px;text-align:center;font-size:12px;color:#475467}.sch-filter{height:34px;border:1px solid var(--line);border-radius:7px;padding:5px 8px;background:#fff}
      .sch-scroll{position:relative;min-height:620px;max-height:calc(100vh - 235px);overflow:auto;background:#e8edf3;padding:20px}.sch-empty{min-height:570px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:#667085;text-align:center}.sch-empty strong{font-size:17px;color:#344054}.sch-stage{position:relative;width:max-content;margin:0 auto;background:#fff;box-shadow:0 8px 28px rgba(15,23,42,.15)}.sch-stage canvas{display:block}.sch-overlay{position:absolute;inset:0;touch-action:none}.sch-overlay.draw{cursor:crosshair}
      .sch-mark{position:absolute;display:flex;align-items:center;justify-content:center;min-width:12px;min-height:12px;border:2px solid currentColor;border-radius:4px;cursor:pointer;overflow:hidden}.sch-mark span{max-width:100%;padding:2px 4px;background:rgba(255,255,255,.86);color:#182230;font-size:9px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}.sch-done{color:#16825d;background:rgba(22,130,93,.18)}.sch-work{color:#d2860b;background:rgba(210,134,11,.18)}.sch-risk{color:#c23a3a;background:rgba(194,58,58,.18)}.sch-idle{color:#667085;background:rgba(102,112,133,.16)}.sch-draft{position:absolute;border:2px dashed #2563eb;background:rgba(37,99,235,.12);pointer-events:none}
      .sch-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(232,237,243,.82);z-index:8;font-weight:700}.sch-legend{display:flex;gap:12px;flex-wrap:wrap;padding:9px 13px;border-top:1px solid #e6eaf0;background:#fff;color:#667085;font-size:10px}.sch-dot{width:8px;height:8px;border-radius:50%;display:inline-block;background:currentColor;margin-right:4px}.sch-note{padding:10px 12px;border:1px solid #dbe7ff;border-radius:8px;background:#f4f8ff;color:#475467;font-size:12px;line-height:1.45}
      @media(max-width:980px){.sch-layout{grid-template-columns:1fr}.sch-side{position:static}.sch-list{max-height:220px}.sch-stats{grid-template-columns:repeat(2,1fr)}}`;
    document.head.appendChild(style);
  }

  function addUi() {
    if ($s('tab-schemes')) return;
    const nav=document.querySelector('.tabs'), main=document.querySelector('main.container'); if(!nav||!main)return;
    const tab=document.createElement('button'); tab.className='tab'; tab.dataset.tab='schemes'; tab.textContent='Схемы'; nav.insertBefore(tab,nav.querySelector('[data-tab="import"]'));
    const panel=document.createElement('section'); panel.id='tab-schemes'; panel.className='panel hidden'; panel.innerHTML=`
      <section class="sch-head"><div><h1>Схемы</h1><p>PDF-схемы и визуальная фиксация выполнения</p></div><div class="sch-group no-print"><button id="schUpload" class="btn primary sch-write">+ Загрузить PDF</button><input id="schFile" type="file" accept="application/pdf,.pdf" hidden><button id="schDownload" class="btn" disabled>Скачать PDF</button><button id="schDelete" class="btn danger-lite sch-write" disabled>Удалить схему</button></div></section>
      <section class="sch-stats"><div class="sch-stat"><span>Отметок</span><strong id="schTotal">0</strong></div><div class="sch-stat"><span>В работе</span><strong id="schWork">0</strong></div><div class="sch-stat"><span>Выполнено</span><strong id="schDone">0</strong></div><div class="sch-stat"><span>Средняя готовность</span><strong id="schProgress">0%</strong></div></section>
      <section class="sch-layout"><aside class="card sch-side no-print"><h2>Загруженные схемы <span id="schCount" class="badge">0</span></h2><input id="schSearch" class="sch-search" type="search" placeholder="Поиск по схемам..."><div id="schList" class="sch-list"></div></aside>
      <section class="card sch-view"><div class="sch-toolbar no-print"><div class="sch-group"><button id="schPrev" class="btn" disabled>‹</button><span id="schPage" class="sch-page">Страница —</span><button id="schNext" class="btn" disabled>›</button><button id="schMinus" class="btn" disabled>−</button><button id="schFit" class="btn" disabled>По ширине</button><button id="schPlus" class="btn" disabled>+</button></div><div class="sch-group"><select id="schFilter" class="sch-filter"><option value="all">Все статусы</option>${STATUSES.map(x=>`<option>${x}</option>`).join('')}</select><button id="schDraw" class="btn primary sch-write" disabled>Отметить участок</button></div></div>
      <div id="schScroll" class="sch-scroll"><div id="schEmpty" class="sch-empty"><strong>Выбери или загрузи PDF-схему</strong><span>После загрузки можно выделять участки и отмечать выполнение.</span></div><div id="schStage" class="sch-stage hidden"><canvas id="schCanvas"></canvas><div id="schOverlay" class="sch-overlay"></div></div><div id="schLoading" class="sch-load hidden">Загрузка схемы...</div></div>
      <div class="sch-legend"><span class="sch-idle"><i class="sch-dot"></i>Не начато</span><span class="sch-work"><i class="sch-dot"></i>В работе</span><span class="sch-done"><i class="sch-dot"></i>Выполнено</span><span class="sch-risk"><i class="sch-dot"></i>Ограничение</span></div></section></section>`;
    main.insertBefore(panel,$s('tab-import'));
    tab.onclick=()=>{ typeof switchTab==='function'?switchTab('schemes'):(document.querySelectorAll('main>.panel').forEach(x=>x.classList.add('hidden')),panel.classList.remove('hidden')); render(); };
  }

  function bind() {
    $s('schUpload').onclick=()=>canWrite()&&$s('schFile').click();
    $s('schFile').onchange=e=>{ const file=e.target.files?.[0]; e.target.value=''; if(file) openUpload(file); };
    $s('schSearch').oninput=renderList; $s('schPrev').onclick=()=>page(-1); $s('schNext').onclick=()=>page(1);
    $s('schMinus').onclick=()=>zoom(-.15); $s('schPlus').onclick=()=>zoom(.15); $s('schFit').onclick=()=>{state.zoom=1;renderPage();};
    $s('schFilter').onchange=e=>{state.filter=e.target.value;renderMarks();}; $s('schDownload').onclick=download; $s('schDelete').onclick=openDelete;
    $s('schDraw').onclick=()=>{if(!canWrite()||!state.pdf)return;state.draw=!state.draw;cancelDraw();toolbar();};
    const over=$s('schOverlay'); over.onpointerdown=startDraw; over.onpointermove=moveDraw; over.onpointerup=endDraw; over.onpointercancel=cancelDraw;
  }

  function renderList() {
    if(!ensure())return; const q=String($s('schSearch')?.value||'').toLowerCase().trim(); const rows=schemes().filter(x=>!q||String(x.name||'').toLowerCase().includes(q)||String(x.fileName||'').toLowerCase().includes(q)); $s('schCount').textContent=schemes().length;
    $s('schList').innerHTML=rows.length?rows.map(x=>{const m=marks(x.id);return `<button class="sch-item ${String(x.id)===String(state.schemeId)?'active':''}" data-id="${html(x.id)}"><strong>${html(x.name||x.fileName)}</strong><span class="sch-meta"><span>${x.pageCount||'—'} стр.</span><span>${m.length} отметок</span><span>${m.filter(y=>DONE.has(y.status)).length} выполнено</span>${x.revision?`<span>Ред. ${html(x.revision)}</span>`:''}</span></button>`;}).join(''):'<div class="muted" style="padding:18px 5px;text-align:center">PDF-схемы пока не загружены.</div>';
    $s('schList').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>select(b.dataset.id));
  }

  function stats() {
    const rows=state.schemeId?marks(state.schemeId):[];
    const measurable=rows.filter(x=>x.progressPercent!==null&&x.progressPercent!==undefined&&x.progressPercent!=='');
    const avg=measurable.length?Math.round(measurable.reduce((sum,x)=>sum+Number(x.progressPercent||0),0)/measurable.length):null;
    $s('schTotal').textContent=rows.length;
    $s('schWork').textContent=rows.filter(x=>x.status==='В работе').length;
    $s('schDone').textContent=rows.filter(x=>DONE.has(x.status)).length;
    $s('schProgress').textContent=avg===null?'—':`${avg}%`;
  }

  function render() {
    if(!ensure())return; document.querySelectorAll('.sch-write').forEach(x=>x.classList.toggle('hidden',!canWrite())); renderList(); stats(); toolbar(); if(state.schemeId&&!scheme(state.schemeId))clear();
  }

  function toolbar() {
    const item=scheme(state.schemeId), pages=state.pdf?.numPages||item?.pageCount||0, has=!!state.pdf;
    $s('schDownload').disabled=!item; $s('schDelete').disabled=!item||!canWrite(); $s('schPrev').disabled=!has||state.page<=1; $s('schNext').disabled=!has||state.page>=pages; $s('schMinus').disabled=!has||state.zoom<=.4; $s('schPlus').disabled=!has||state.zoom>=3; $s('schFit').disabled=!has; $s('schDraw').disabled=!has||!canWrite(); $s('schDraw').textContent=state.draw?'Отмена отметки':'Отметить участок'; $s('schOverlay')?.classList.toggle('draw',state.draw); $s('schPage').textContent=has?`Страница ${state.page} / ${pages}`:'Страница —';
  }

  async function select(id) { state.schemeId=id; state.page=1; state.zoom=1; state.draw=false; state.filter='all'; $s('schFilter').value='all'; renderList(); stats(); await loadPdf(); }
  function clear() { state.schemeId='';state.pdf=null;state.page=1;state.zoom=1;state.draw=false;cancelDraw();$s('schStage').classList.add('hidden');$s('schEmpty').classList.remove('hidden');$s('schOverlay').innerHTML='';render(); }
  function loading(on,text='Загрузка схемы...'){const x=$s('schLoading');x.textContent=text;x.classList.toggle('hidden',!on);}

  async function pdfjs() {
    if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc=WORKER;return window.pdfjsLib;} if(window.LIV_PDFJS_PROMISE)return window.LIV_PDFJS_PROMISE;
    window.LIV_PDFJS_PROMISE=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=PDFJS;s.onload=()=>{if(!window.pdfjsLib)return reject(new Error('PDF.js не инициализирован'));window.pdfjsLib.GlobalWorkerOptions.workerSrc=WORKER;resolve(window.pdfjsLib);};s.onerror=()=>reject(new Error('Не удалось загрузить PDF.js'));document.head.appendChild(s);});return window.LIV_PDFJS_PROMISE;
  }

  async function loadPdf() {
    const item=scheme(state.schemeId); if(!item)return clear(); loading(true);
    try { let doc=state.cache.get(item.id); if(!doc){const client=window.LIV_SUPABASE;if(!client)throw new Error('Нет подключения к Supabase');const d=await client.storage.from(BUCKET).download(item.storagePath);if(d.error)throw d.error;const lib=await pdfjs();doc=await lib.getDocument({data:new Uint8Array(await d.data.arrayBuffer())}).promise;await rememberPdf(item.id,doc);} state.pdf=doc;if(item.pageCount!==doc.numPages){item.pageCount=doc.numPages;item.updatedAt=now();await syncScheme(item);await saveProject();}await renderPage(); }
    catch(error){console.error(error);state.pdf=null;$s('schStage').classList.add('hidden');$s('schEmpty').classList.remove('hidden');$s('schEmpty').innerHTML=`<strong>Не удалось открыть PDF</strong><span>${html(error.message||error)}</span>`;} finally{loading(false);toolbar();renderList();}
  }

  async function renderPage() {
    if(!state.pdf)return;loading(true,'Отрисовка страницы...');try{const page=await state.pdf.getPage(state.page),scroll=$s('schScroll'),canvas=$s('schCanvas'),stage=$s('schStage'),over=$s('schOverlay'),base=page.getViewport({scale:1}),scale=(Math.max(320,scroll.clientWidth-42)/base.width)*state.zoom,view=page.getViewport({scale}),ratio=Math.min(devicePixelRatio||1,2),ctx=canvas.getContext('2d');canvas.width=Math.floor(view.width*ratio);canvas.height=Math.floor(view.height*ratio);canvas.style.width=`${Math.floor(view.width)}px`;canvas.style.height=`${Math.floor(view.height)}px`;stage.style.width=over.style.width=canvas.style.width;stage.style.height=over.style.height=canvas.style.height;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);await page.render({canvasContext:ctx,viewport:view,transform:ratio===1?null:[ratio,0,0,ratio,0,0]}).promise;$s('schEmpty').classList.add('hidden');stage.classList.remove('hidden');renderMarks();}catch(error){alert('Не удалось отрисовать страницу: '+(error.message||error));}finally{loading(false);toolbar();}
  }

  function renderMarks() {
    const over=$s('schOverlay');if(!over)return;over.querySelectorAll('.sch-mark').forEach(x=>x.remove());marks(state.schemeId,state.page).filter(x=>state.filter==='all'||x.status===state.filter).forEach(x=>{const b=document.createElement('button');b.className=`sch-mark ${markClass(x.status)}`;b.style.left=`${clamp(x.x)*100}%`;b.style.top=`${clamp(x.y)*100}%`;b.style.width=`${clamp(x.width,.008,1)*100}%`;b.style.height=`${clamp(x.height,.008,1)*100}%`;b.innerHTML=`<span>${html(x.title||x.status||'Участок')}${x.progressPercent!==null&&x.progressPercent!==undefined&&x.progressPercent!==''?' · '+Math.round(Number(x.progressPercent||0))+'%':''}</span>`;b.onpointerdown=e=>e.stopPropagation();b.onclick=e=>{e.stopPropagation();openMark(x.id);};over.appendChild(b);});
  }

  function point(e){const r=$s('schOverlay').getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width),y:clamp((e.clientY-r.top)/r.height)};}
  function startDraw(e){if(!state.draw||!canWrite()||e.button!==0||e.target!==$s('schOverlay'))return;e.preventDefault();state.start=point(e);state.draft=document.createElement('div');state.draft.className='sch-draft';$s('schOverlay').appendChild(state.draft);}
  function moveDraw(e){if(!state.start||!state.draft)return;const q=point(e),x=Math.min(state.start.x,q.x),y=Math.min(state.start.y,q.y),w=Math.abs(q.x-state.start.x),h=Math.abs(q.y-state.start.y);Object.assign(state.draft.style,{left:`${x*100}%`,top:`${y*100}%`,width:`${w*100}%`,height:`${h*100}%`});}
  function endDraw(e){if(!state.start)return;const q=point(e);let x=Math.min(state.start.x,q.x),y=Math.min(state.start.y,q.y),w=Math.abs(q.x-state.start.x),h=Math.abs(q.y-state.start.y);if(w<.012||h<.012){w=.05;h=.05;x=clamp(q.x-w/2,0,1-w);y=clamp(q.y-h/2,0,1-h);}cancelDraw();state.draw=false;toolbar();openMark(null,{schemeId:state.schemeId,pageNo:state.page,x,y,width:w,height:h});}
  function cancelDraw(){state.start=null;state.draft?.remove();state.draft=null;}

  function openMark(id=null,geometry=null) {
    if(!canWrite())return;
    const current=p(),existing=id?mark(id):null,x=existing||geometry||{};
    openModal(existing?'Отметка выполнения':'Новая отметка на схеме',`<div class="form-grid"><div class="field"><label>Участок</label><input id="smTitle" value="${html(x.title||'')}"></div><div class="field"><label>Статус</label><select id="smStatus">${STATUSES.map(s=>`<option ${s===(x.status||'Не начато')?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>Вид работ</label><select id="smWork">${options(current.works,x.workId)}</select></div><div class="field"><label>Организация</label><select id="smOrg">${options(current.organizations,x.organizationId)}</select></div><div class="field"><label>Связанный фронт</label><select id="smFront">${frontOptions(x.frontId)}</select></div></div><div class="sch-note">Процент вручную не вводится. Если отметка связана с измеряемым фронтом, LIV рассчитает готовность из фактического и общего объёма.</div><div class="field"><label>Комментарий</label><textarea id="smComment">${html(x.comment||'')}</textarea></div><div class="liv-editor-footer">${existing?'<button id="smDelete" class="btn danger-lite">Удалить отметку</button>':''}<button id="smCancel" class="btn">Отмена</button><button id="smSave" class="btn primary">Сохранить</button></div>`);
    $s('smCancel').onclick=closeModal;
    $s('smSave').onclick=()=>saveMark(existing,x);
    if($s('smDelete'))$s('smDelete').onclick=()=>deleteMark(existing);
  }

  async function saveMark(existing,g) {
    const current=p(),t=now();if(!current)return;
    let x=existing;
    if(!x){x={id:makeId('SMK'),schemeId:g.schemeId,pageNo:g.pageNo,x:g.x,y:g.y,width:g.width,height:g.height,active:true,createdAt:t};current.schemeMarks.push(x);}
    const status=$s('smStatus').value;
    const frontId=$s('smFront').value;
    const progressPercent=derivedProgress(status,frontId);
    Object.assign(x,{title:$s('smTitle').value.trim(),status,progressPercent,workId:$s('smWork').value,organizationId:$s('smOrg').value,frontId,comment:$s('smComment').value.trim(),active:true,updatedAt:t});
    if(typeof log==='function')log(existing?'Изменено':'Создано','Отметка на схеме',x.title||'Участок',{schemeId:x.schemeId,markId:x.id,status:x.status,progress:x.progressPercent});
    await syncMark(x);await saveProject();closeModal();renderMarks();stats();renderList();
  }

  async function deleteMark(x){if(!x||!confirm('Удалить отметку со схемы?'))return;x.active=false;x.updatedAt=x.deletedAt=now();await syncMark(x);await saveProject();closeModal();renderMarks();stats();renderList();}
  async function page(d){if(!state.pdf)return;const n=Math.min(state.pdf.numPages,Math.max(1,state.page+d));if(n!==state.page){state.page=n;await renderPage();}}
  function zoom(d){if(!state.pdf)return;state.zoom=clamp(state.zoom+d,.4,3);renderPage();}

  function openUpload(file) {
    if(!canWrite())return;if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))return alert('Можно загрузить только PDF.');if(file.size>100*1024*1024)return alert('PDF превышает 100 МБ.');state.pending=file;const current=p(),name=file.name.replace(/\.pdf$/i,'');openModal('Загрузка PDF-схемы',`<div class="form-grid"><div class="field"><label>Название</label><input id="suName" value="${html(name)}"></div><div class="field"><label>Редакция</label><input id="suRevision" placeholder="Р1"></div><div class="field"><label>Здание</label><select id="suBuilding">${options(current.buildings,'')}</select></div><div class="field"><label>Шахматка</label><select id="suMatrix">${options(current.matrices,'')}</select></div></div><div class="sch-note">Файл: <b>${html(file.name)}</b><br>Размер: ${(file.size/1024/1024).toFixed(1)} МБ.<br>Отметки сохраняются отдельно от PDF и не съезжают при масштабировании.</div><div class="liv-editor-footer"><button id="suCancel" class="btn">Отмена</button><button id="suSave" class="btn primary">Загрузить</button></div>`);$s('suCancel').onclick=()=>{state.pending=null;closeModal();};$s('suSave').onclick=upload;
  }

  async function upload() {
    const file=state.pending,current=p(),client=window.LIV_SUPABASE;if(!file||!current||!client)return alert('Нет подключения к серверу.');const b=$s('suSave');b.disabled=true;b.textContent='Загрузка...';const id=makeId('SCH'),path=`schemes/${safeName(id)}/source.pdf`,t=now();try{const u=await client.storage.from(BUCKET).upload(path,file,{contentType:'application/pdf',upsert:false});if(u.error)throw u.error;const x={id,name:$s('suName').value.trim()||file.name,fileName:file.name,storagePath:path,mimeType:'application/pdf',fileSize:file.size,pageCount:0,buildingId:$s('suBuilding').value,matrixId:$s('suMatrix').value,revision:$s('suRevision').value.trim(),status:'Загружена',active:true,createdAt:t,updatedAt:t};current.schemes.push(x);try{await syncScheme(x);}catch(error){current.schemes=current.schemes.filter(y=>y.id!==x.id);await client.storage.from(BUCKET).remove([path]);throw error;}await saveProject();state.pending=null;closeModal();render();await select(x.id);}catch(error){alert('Не удалось загрузить PDF: '+(error.message||error));b.disabled=false;b.textContent='Загрузить';}
  }

  const userId=()=>window.LIV_REMOTE_SYNC?.userId?.()||null;
  async function syncScheme(x){const client=window.LIV_SUPABASE;if(!client)return;const data={external_id:x.id,name:x.name,file_name:x.fileName,storage_path:x.storagePath,mime_type:'application/pdf',page_count:Number(x.pageCount||0),revision:x.revision||null,status:x.status||'Загружена',active:x.active!==false,updated_at:x.updatedAt||now(),custom_data:{buildingExternalId:x.buildingId||'',matrixExternalId:x.matrixId||'',fileSize:Number(x.fileSize||0)}};if(x.serverId){const r=await client.from('schemes').update(data).eq('id',x.serverId);if(r.error)throw r.error;return;}const e=await client.from('schemes').select('id').eq('external_id',x.id).maybeSingle();if(e.error)throw e.error;if(e.data?.id){x.serverId=e.data.id;const r=await client.from('schemes').update(data).eq('id',x.serverId);if(r.error)throw r.error;return;}const r=await client.from('schemes').insert({...data,created_by:userId()}).select('id').single();if(r.error)throw r.error;x.serverId=r.data.id;}
  async function syncMark(x){const client=window.LIV_SUPABASE,item=scheme(x.schemeId);if(!client||!item)return;if(!item.serverId)await syncScheme(item);const data={external_id:x.id,scheme_id:item.serverId,page_no:Number(x.pageNo||1),x:clamp(x.x),y:clamp(x.y),width:clamp(x.width),height:clamp(x.height),mark_type:'area',title:x.title||null,status:x.status||'Не начато',progress_percent:x.progressPercent===null||x.progressPercent===undefined||x.progressPercent===''?null:Math.round(clamp(x.progressPercent,0,100)),comment:x.comment||null,active:x.active!==false,updated_at:x.updatedAt||now(),custom_data:{workExternalId:x.workId||'',organizationExternalId:x.organizationId||'',frontExternalId:x.frontId||''}};try{if(x.serverId){const r=await client.from('scheme_marks').update(data).eq('id',x.serverId);if(r.error)throw r.error;return;}const e=await client.from('scheme_marks').select('id').eq('external_id',x.id).maybeSingle();if(e.error)throw e.error;if(e.data?.id){x.serverId=e.data.id;const r=await client.from('scheme_marks').update(data).eq('id',x.serverId);if(r.error)throw r.error;return;}const r=await client.from('scheme_marks').insert({...data,created_by:userId()}).select('id').single();if(r.error)throw r.error;x.serverId=r.data.id;}catch(error){console.warn('LIV Schemes: sync mark failed',error);}}

  async function download(){const x=scheme(state.schemeId),client=window.LIV_SUPABASE;if(!x||!client)return;loading(true,'Подготовка файла...');try{const r=await client.storage.from(BUCKET).download(x.storagePath);if(r.error)throw r.error;const url=URL.createObjectURL(r.data),a=document.createElement('a');a.href=url;a.download=x.fileName||`${x.name}.pdf`;a.click();URL.revokeObjectURL(url);}catch(error){alert('Не удалось скачать PDF: '+(error.message||error));}finally{loading(false);}}
  function openDelete(){const x=scheme(state.schemeId);if(!x||!canWrite())return;openModal('Удаление PDF-схемы',`<div class="notice bad">Будет удалена схема <b>${html(x.name)}</b>, исходный PDF и ${marks(x.id).length} отметок. Фронты и шахматки не удаляются.</div><div class="liv-editor-footer"><button id="sdCancel" class="btn">Отмена</button><button id="sdConfirm" class="btn danger">Удалить</button></div>`);$s('sdCancel').onclick=closeModal;$s('sdConfirm').onclick=removeScheme;}
  async function removeScheme(){const x=scheme(state.schemeId),client=window.LIV_SUPABASE;if(!x)return;try{if(client){if(x.storagePath)await client.storage.from(BUCKET).remove([x.storagePath]);const r=x.serverId?await client.from('schemes').delete().eq('id',x.serverId):await client.from('schemes').delete().eq('external_id',x.id);if(r.error)throw r.error;}x.active=false;x.deletedAt=x.updatedAt=now();marks(x.id).forEach(m=>{m.active=false;m.deletedAt=m.updatedAt=x.deletedAt;});await saveProject();state.cache.delete(x.id);closeModal();clear();}catch(error){alert('Не удалось удалить схему: '+(error.message||error));}}

  function boot(){addStyles();addUi();bind();const timer=setInterval(()=>{if(ensure()){clearInterval(timer);render();}},150);setTimeout(()=>clearInterval(timer),15000);}
  window.addEventListener('liv-remote-project',()=>setTimeout(render,0));window.addEventListener('liv-auth-session',()=>setTimeout(render,0));let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.pdf&&!$s('tab-schemes')?.classList.contains('hidden'))renderPage();},250);});
  window.LIV_SCHEMES={render,select,upload:openUpload,openMark};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
