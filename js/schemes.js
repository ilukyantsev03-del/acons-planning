'use strict';

(function () {
  const BUCKET = 'liv-schemes';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const WRITERS = new Set(['admin', 'planner']);
  const STATUSES = ['Не начато','В работе','Выполнено','Освидетельствовано','Принято','Ограничение'];
  const DONE = new Set(['Выполнено','Освидетельствовано','Принято']);
  const state = { schemeId:'', pdf:null, page:1, zoom:1, draw:false, tool:'area', ink:{color:'#2563eb',width:3,fill:0}, selected:'', dirty:new Map(), saving:false, start:null, draft:null, filter:'all', cache:new Map(), pending:null, linksRunning:false };

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

  function derivedProgress(status, frontId, groupId='', elementId='') {
    const current = p();
    const elements=(current?.numberedElements||[]).filter(item=>item.active!==false);
    const completed=item=>DONE.has(item.status)||item.status==='Завершено';
    if(elementId){
      const element=elements.find(item=>String(item.id)===String(elementId));
      return element?(completed(element)?100:0):null;
    }
    if(groupId){
      const group=(current?.numberedElementGroups||[]).find(item=>String(item.id)===String(groupId));
      const total=Number(group?.totalQty||0);
      if(!(total>0))return null;
      const done=elements.filter(item=>String(item.groupId)===String(groupId)&&completed(item)).length;
      return Math.min(100,Math.round(done/total*100));
    }
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
  const mark = id => state.dirty.get(String(id)) || (p()?.schemeMarks||[]).find(x=>String(x.id)===String(id))||null;
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

  function elementOptions(selected){
    return options((p()?.numberedElements||[]).map(item=>({...item,name:[item.elementType,item.groupCode||item.mark,'№'+item.elementNo].filter(Boolean).join(' ')})),selected);
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
      .sch-mark.selected{outline:2px dashed #2563eb;outline-offset:5px}.sch-overlay.draw .sch-mark,.sch-overlay.draw .sch-mark *{pointer-events:none!important}.sch-tools label{display:flex;align-items:center;gap:5px;font-size:12px}.sch-tools input[type=color]{width:38px;height:32px;padding:2px}.sch-tools input[type=number]{width:62px}.sch-hint{padding:8px 12px;font-size:12px;color:#475467;background:#f4f7fb}.sch-mark{padding:0;box-sizing:border-box;position:absolute;display:flex;align-items:center;justify-content:center;min-width:12px;min-height:12px;border:2px solid currentColor;border-radius:4px;cursor:pointer;overflow:hidden}.sch-mark span{max-width:100%;padding:2px 4px;background:rgba(255,255,255,.86);color:#182230;font-size:9px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}.sch-done{color:#16825d;background:rgba(22,130,93,.18)}.sch-work{color:#d2860b;background:rgba(210,134,11,.18)}.sch-risk{color:#c23a3a;background:rgba(194,58,58,.18)}.sch-idle{color:#667085;background:rgba(102,112,133,.16)}.sch-no-label span{display:none}.sch-draft{color:#2563eb;position:absolute;border:2px dashed #2563eb;background:rgba(37,99,235,.12);pointer-events:none}
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
      <section class="card sch-view"><div class="sch-toolbar no-print"><div class="sch-group"><button id="schPrev" class="btn" disabled>‹</button><span id="schPage" class="sch-page">Страница —</span><button id="schNext" class="btn" disabled>›</button><button id="schMinus" class="btn" disabled>−</button><button id="schFit" class="btn" disabled>По ширине</button><button id="schPlus" class="btn" disabled>+</button></div><div class="sch-group"><select id="schFilter" class="sch-filter"><option value="all">Все статусы</option>${STATUSES.map(x=>`<option>${x}</option>`).join('')}</select><select id="schTool" class="sch-filter sch-write" aria-label="Форма отметки"><option value="area">Прямоугольник</option><option value="line">Линия</option><option value="point">Точка</option><option value="circle">Круг</option></select><button id="schDraw" class="btn primary sch-write" disabled>Отметить участок</button></div></div>
      <div class="sch-toolbar sch-tools no-print sch-write"><div class="sch-group"><label>Цвет <select id="schColorMode" class="sch-filter"><option value="custom">Свой</option><option value="status">По статусу</option></select><input id="schColor" type="color" value="#2563eb" aria-label="Цвет линии"></label><label>Толщина <input id="schWidth" class="sch-filter" type="number" min="1" max="20" value="3"> пкс</label><label>Заливка <select id="schFill" class="sch-filter"><option value="0">Нет</option><option value="0.15">15%</option><option value="0.3">30%</option><option value="0.5">50%</option></select></label></div><div class="sch-group"><button id="schDetails" class="btn" disabled>Данные отметки</button><button id="schRemoveMark" class="btn danger-lite" disabled>Удалить отметку</button><button id="schSaveDrawings" class="btn primary" disabled>Сохранить рисунки</button></div></div><div id="schHint" class="sch-hint" role="status" aria-live="polite">Выбери форму и рисуй. Карточка открывается отдельно — кнопкой «Данные отметки».</div>
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
    $s('schDraw').onclick=()=>{if(!canWrite()||!state.pdf)return;state.draw=!state.draw;state.selected='';cancelDraw();renderMarks();toolbar();};
    $s('schTool').onchange=e=>{cancelDraw();state.tool=e.target.value;state.draw=true;state.selected='';renderMarks();toolbar();};
    ['schColorMode','schColor','schWidth','schFill'].forEach(id=>$s(id).onchange=changeInk);
    $s('schDetails').onclick=()=>{if(state.selected&&!state.saving)openMark(state.selected);};
    $s('schRemoveMark').onclick=removeSelected;
    $s('schSaveDrawings').onclick=saveDrawings;
    window.addEventListener('beforeunload',e=>{if(state.dirty.size){e.preventDefault();e.returnValue='';}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.draw){cancelDraw();state.draw=false;toolbar();}});
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
    $s('schDownload').disabled=!item; $s('schDelete').disabled=!item||!canWrite(); $s('schPrev').disabled=!has||state.page<=1; $s('schNext').disabled=!has||state.page>=pages; $s('schMinus').disabled=!has||state.zoom<=.4; $s('schPlus').disabled=!has||state.zoom>=3; $s('schFit').disabled=!has; $s('schDraw').disabled=!has||!canWrite(); $s('schDraw').textContent=state.draw?'Завершить рисование':'Рисовать'; $s('schOverlay')?.classList.toggle('draw',state.draw); $s('schPage').textContent=has?`Страница ${state.page} / ${pages}`:'Страница —';
    ['schTool','schDraw','schColorMode','schColor','schWidth','schFill'].forEach(id=>{$s(id).disabled=!has||!canWrite()||state.saving;});
    $s('schDetails').disabled=$s('schRemoveMark').disabled=!state.selected||state.draw||state.saving||!canWrite();
    $s('schSaveDrawings').disabled=!state.dirty.size||state.saving||!canWrite();
    $s('schSaveDrawings').textContent=state.saving?'Сохранение…':`Сохранить рисунки${state.dirty.size?' ('+state.dirty.size+')':''}`;
    const ink=state.selected&&!state.draw?appearance(mark(state.selected)):state.ink;
    $s('schColorMode').value=ink.color?'custom':'status';$s('schColor').value=ink.color||'#2563eb';
    $s('schColor').disabled=$s('schColor').disabled||!ink.color;
    $s('schWidth').value=ink.width;$s('schFill').value=String(ink.fill);
    $s('schHint').textContent=state.saving?'Сохраняем отметки…':state.dirty.size?`Есть несохранённые изменения: ${state.dirty.size}. Нажми «Сохранить рисунки».`:state.draw?'Рисуй несколько фигур подряд. Esc или «Завершить рисование» — перейти к выбору отметок.':'Щелчок выбирает отметку; «Данные отметки» или двойной щелчок открывает карточку.';

  }

  async function select(id) { state.selected='';state.schemeId=id; state.page=1; state.zoom=1; state.draw=false; state.filter='all'; $s('schFilter').value='all'; renderList(); stats(); await loadPdf(); }
  function clear() { state.schemeId='';state.pdf=null;state.page=1;state.zoom=1;state.draw=false;cancelDraw();$s('schStage').classList.add('hidden');$s('schEmpty').classList.remove('hidden');$s('schOverlay').innerHTML='';render(); }
  function loading(on,text='Загрузка схемы...'){const x=$s('schLoading');x.textContent=text;x.classList.toggle('hidden',!on);}

  async function pdfjs() {
    if(window.pdfjsLib){if(!window.pdfjsLib.GlobalWorkerOptions.workerSrc)window.pdfjsLib.GlobalWorkerOptions.workerSrc=WORKER;return window.pdfjsLib;}
    if(window.LIV_PDFJS_PROMISE)return window.LIV_PDFJS_PROMISE;

    const sources=[
      {script:PDFJS,worker:WORKER},
      {
        script:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
        worker:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
      }
    ];

    window.LIV_PDFJS_PROMISE=new Promise((resolve,reject)=>{
      let index=0;
      const attempt=()=>{
        if(index>=sources.length){
          reject(new Error('Не удалось загрузить PDF.js. Проверь доступ браузера к cdnjs/jsDelivr.'));
          return;
        }

        const source=sources[index++];
        const script=document.createElement('script');
        script.src=source.script;
        script.onload=()=>{
          if(!window.pdfjsLib){
            script.remove();
            attempt();
            return;
          }
          window.pdfjsLib.GlobalWorkerOptions.workerSrc=source.worker;
          resolve(window.pdfjsLib);
        };
        script.onerror=()=>{
          script.remove();
          attempt();
        };
        document.head.appendChild(script);
      };
      attempt();
    }).catch(error=>{
      window.LIV_PDFJS_PROMISE=null;
      throw error;
    });

    return window.LIV_PDFJS_PROMISE;
  }

  async function loadPdf() {
    const item=scheme(state.schemeId); if(!item)return clear(); loading(true);
    try { let doc=state.cache.get(item.id); if(!doc){const client=window.LIV_SUPABASE;if(!client)throw new Error('Нет подключения к Supabase');const d=await client.storage.from(BUCKET).download(item.storagePath);if(d.error)throw d.error;const lib=await pdfjs();doc=await lib.getDocument({data:new Uint8Array(await d.data.arrayBuffer())}).promise;await rememberPdf(item.id,doc);} if(state.schemeId!==item.id)return;state.pdf=doc;if(item.pageCount!==doc.numPages){item.pageCount=doc.numPages;if(canWrite()){item.updatedAt=now();await syncScheme(item);await saveProject();}}await renderPage(); }
    catch(error){console.error(error);state.pdf=null;$s('schStage').classList.add('hidden');$s('schEmpty').classList.remove('hidden');$s('schEmpty').innerHTML=`<strong>Не удалось открыть PDF</strong><span>${html(error.message||error)}</span>`;} finally{loading(false);toolbar();renderList();}
  }

  async function renderPage() {
    if(!state.pdf)return;loading(true,'Отрисовка страницы...');try{const page=await state.pdf.getPage(state.page),scroll=$s('schScroll'),canvas=$s('schCanvas'),stage=$s('schStage'),over=$s('schOverlay'),base=page.getViewport({scale:1}),scale=(Math.max(320,scroll.clientWidth-42)/base.width)*state.zoom,view=page.getViewport({scale}),ratio=Math.min(devicePixelRatio||1,2),ctx=canvas.getContext('2d');canvas.width=Math.floor(view.width*ratio);canvas.height=Math.floor(view.height*ratio);canvas.style.width=`${Math.floor(view.width)}px`;canvas.style.height=`${Math.floor(view.height)}px`;stage.style.width=over.style.width=canvas.style.width;stage.style.height=over.style.height=canvas.style.height;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);await page.render({canvasContext:ctx,viewport:view,transform:ratio===1?null:[ratio,0,0,ratio,0,0]}).promise;$s('schEmpty').classList.add('hidden');stage.classList.remove('hidden');renderMarks();}catch(error){alert('Не удалось отрисовать страницу: '+(error.message||error));}finally{loading(false);toolbar();}
  }

  function visibleMarks() {
    const merged=new Map((p()?.schemeMarks||[]).map(x=>[String(x.id),x]));
    state.dirty.forEach((x,id)=>merged.set(id,x));
    return [...merged.values()].filter(x=>x.active!==false&&x.schemeId===state.schemeId&&Number(x.pageNo||1)===state.page);
  }
  function renderMarks() {
    const over=$s('schOverlay');if(!over)return;
    over.querySelectorAll('.sch-mark').forEach(x=>x.remove());
    visibleMarks().filter(x=>state.filter==='all'||x.status===state.filter).forEach(x=>{
      const b=document.createElement('button');b.type='button';b.dataset.markId=x.id;
      b.className=`sch-mark ${markClass(x.status)}${state.selected===x.id?' selected':''}`;
      paintShape(b,x);b.title=(x.title||x.status||'Отметка')+(state.dirty.has(String(x.id))?' · не сохранено':'');
      if(x.title)b.innerHTML+=`<span>${html(x.title)}</span>`;
      b.onpointerdown=e=>e.stopPropagation();
      b.onclick=e=>{e.stopPropagation();if(state.draw||state.saving)return;state.selected=x.id;over.querySelectorAll('.sch-mark').forEach(n=>n.classList.toggle('selected',n.dataset.markId===x.id));toolbar();};
      b.ondblclick=e=>{e.stopPropagation();if(!state.draw&&!state.saving)openMark(x.id);};
      over.appendChild(b);
    });
  }
  function appearance(x) {
    const value=x?.appearance||{};
    return {color:/^#[0-9a-f]{6}$/i.test(value.color||'')?value.color:null,width:clamp(value.width??3,1,20),fill:clamp(value.fill??.15,0,1)};
  }
  function changeInk() {
    if(!canWrite()||state.saving)return;
    const ink={color:$s('schColorMode').value==='status'?null:$s('schColor').value,width:clamp($s('schWidth').value,1,20),fill:clamp($s('schFill').value)};
    if(state.selected&&!state.draw){const x=mark(state.selected);if(x)state.dirty.set(String(x.id),{...x,appearance:ink,updatedAt:now()});}
    else state.ink=ink;
    renderMarks();toolbar();
  }
  function stageDrawing(g) {
    const t=now();const x={id:makeId('SMK'),schemeId:state.schemeId,pageNo:state.page,...g,appearance:{...state.ink},status:'Не начато',progressPercent:null,active:true,createdAt:t,updatedAt:t};
    state.dirty.set(String(x.id),x);return x;
  }
  async function saveDrawings() {
    if(state.saving||!canWrite()||!state.dirty.size)return;
    state.saving=true;cancelDraw();toolbar();
    let error=null;
    try{
      for(const [id,x] of [...state.dirty]){
        await syncMark(x);
        const list=p().schemeMarks,index=list.findIndex(item=>String(item.id)===id);
        if(index<0)list.push(x);else list[index]=x;
        // Keep the entry dirty until both the row and project snapshot are saved.
        await saveProject();
        state.dirty.delete(id);
      }
    }catch(e){error=e;}
    finally{state.saving=false;renderMarks();stats();renderList();toolbar();}
    if(error)$s('schHint').textContent='Не удалось сохранить: '+(error.message||error)+'. Несохранённые отметки оставлены на схеме — повтори сохранение.';
  }
  async function removeSelected() {
    if(state.saving||!canWrite())return;
    const x=mark(state.selected);if(!x)return;
    if(!x.serverId&&state.dirty.has(String(x.id))){state.dirty.delete(String(x.id));state.selected='';renderMarks();toolbar();return;}
    await deleteMark(x);
  }

  function point(e){const r=$s('schOverlay').getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width),y:clamp((e.clientY-r.top)/r.height)};}
  function geometry(start, end, type, size) {
    let x=Math.min(start.x,end.x),y=Math.min(start.y,end.y),width=Math.abs(end.x-start.x),height=Math.abs(end.y-start.y);
    if(type==='point') { width=12/size.width;height=12/size.height;x=clamp(end.x-width/2,0,1-width);y=clamp(end.y-height/2,0,1-height); }
    else if(type==='circle') { const d=Math.max(width*size.width,height*size.height,12);width=Math.min(d/size.width,1);height=Math.min(d/size.height,1);x=clamp(start.x+(end.x<start.x?-width:0),0,1-width);y=clamp(start.y+(end.y<start.y?-height:0),0,1-height); }
    else if(type==='area'&&(width<.003||height<.003)) {width=.05;height=.05;x=clamp(end.x-width/2,0,1-width);y=clamp(end.y-height/2,0,1-height);}
    return {x,y,width,height,markType:type,lineReverse:(end.x-start.x)*(end.y-start.y)<0};
  }
  function paintShape(node,g) {
    const ink=appearance(g);const color=ink.color||({'В работе':'#d2860b','Ограничение':'#c23a3a'}[g.status]||(DONE.has(g.status)?'#16825d':'#667085'));
    Object.assign(node.style,{color,borderColor:color,borderWidth:`${ink.width}px`,borderStyle:'solid',background:ink.fill?color+Math.round(ink.fill*255).toString(16).padStart(2,'0'):'transparent'});
    Object.assign(node.style,{left:`${g.x*100}%`,top:`${g.y*100}%`,width:`${Math.max(g.width,.001)*100}%`,height:`${Math.max(g.height,.001)*100}%`,minWidth:'0',minHeight:'0'});
    if(g.markType==='circle'||g.markType==='point')node.style.borderRadius='50%';
    if(g.markType==='point')node.style.background='currentColor';
    if(g.markType==='line') {
      Object.assign(node.style,{border:'none',background:'transparent',overflow:'visible'});
      node.innerHTML=`<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible"><line x1="0" y1="${g.lineReverse?100:0}" x2="100" y2="${g.lineReverse?0:100}" stroke="currentColor" stroke-width="${ink.width}" vector-effect="non-scaling-stroke" style="pointer-events:stroke"/></svg>`;
    }
    if(g.markType==='point'||g.markType==='line')node.classList.add('sch-no-label');
  }
  function startDraw(e){if(state.saving||!state.draw||!canWrite()||e.button!==0||e.target!==$s('schOverlay'))return;e.preventDefault();state.start=point(e);state.draft=document.createElement('div');state.draft.className='sch-draft';$s('schOverlay').appendChild(state.draft);$s('schOverlay').setPointerCapture?.(e.pointerId);moveDraw(e);}
  function moveDraw(e){if(!state.start||!state.draft)return;paintShape(state.draft,{...geometry(state.start,point(e),state.tool,$s('schOverlay').getBoundingClientRect()),appearance:state.ink});}
  function endDraw(e){if(!state.start)return;const g=geometry(state.start,point(e),state.tool,$s('schOverlay').getBoundingClientRect());cancelDraw();stageDrawing(g);state.filter='all';$s('schFilter').value='all';renderMarks();toolbar();}
  function cancelDraw(){state.start=null;state.draft?.remove();state.draft=null;}

  function openMark(id=null,geometry=null) {
    if(!canWrite())return;
    const current=p(),existing=id?mark(id):null,x=existing||geometry||{};
    openModal(existing?'Отметка выполнения':'Новая отметка на схеме',`<div class="sch-note">Данные и связи отметки. Цвет, толщину и заливку можно менять на панели схемы без открытия этой карточки.</div><div class="form-grid"><div class="field"><label>Участок</label><input id="smTitle" value="${html(x.title||'')}"></div><div class="field"><label>Статус</label><select id="smStatus">${STATUSES.map(s=>`<option ${s===(x.status||'Не начато')?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>Вид работ</label><select id="smWork">${options(current.works,x.workId)}</select></div><div class="field"><label>Организация</label><select id="smOrg">${options(current.organizations,x.organizationId)}</select></div><div class="field"><label>Связанный фронт</label><select id="smFront">${frontOptions(x.frontId)}</select></div><div class="field"><label>Группа номерных элементов</label><select id="smGroup">${options(current.numberedElementGroups,x.elementGroupId)}</select></div><div class="field"><label>Номерной элемент</label><select id="smElement">${elementOptions(x.numberedElementId)}</select></div></div><div class="sch-note">Процент вручную не вводится. Готовность рассчитывается по выбранному номерному элементу, группе с заданным общим количеством либо измеряемому фронту.</div><div class="field"><label>Комментарий</label><textarea id="smComment">${html(x.comment||'')}</textarea></div><div class="liv-editor-footer">${existing?'<button id="smDelete" class="btn danger-lite">Удалить отметку</button>':''}<button id="smCancel" class="btn">Отмена</button><button id="smSave" class="btn primary">Сохранить</button></div>`);
    $s('smCancel').onclick=closeModal;
    $s('smSave').onclick=()=>saveMark(existing,x);
    if($s('smDelete'))$s('smDelete').onclick=()=>deleteMark(existing);
  }

  async function saveMark(existing,g) {
    const current=p(),t=now();if(!current)return;
    const previous=existing?{...existing}:null;
    let synced=false;
    const button=$s('smSave');if(button.disabled)return;button.disabled=true;
    let x=existing;
    if(!x){x={id:makeId('SMK'),schemeId:g.schemeId,pageNo:g.pageNo,x:g.x,y:g.y,width:g.width,height:g.height,markType:g.markType||'area',lineReverse:!!g.lineReverse,active:true,createdAt:t};current.schemeMarks.push(x);}
    const status=$s('smStatus').value;
    const frontId=$s('smFront').value;
    const elementGroupId=$s('smGroup').value;
    const numberedElementId=$s('smElement').value;
    const progressPercent=derivedProgress(status,frontId,elementGroupId,numberedElementId);
    const completedAt=DONE.has(status)?(x.completedAt||t):null;
    const completedBy=DONE.has(status)?(x.completedBy||userId()||null):null;
    Object.assign(x,{title:$s('smTitle').value.trim(),status,progressPercent,workId:$s('smWork').value,organizationId:$s('smOrg').value,frontId,elementGroupId,numberedElementId,comment:$s('smComment').value.trim(),completedAt,completedBy,active:true,updatedAt:t});
    try{
      await syncMark(x);
      synced=true;
      if(typeof log==='function')log(existing?'Изменено':'Создано','Отметка на схеме',x.title||'Участок',{schemeId:x.schemeId,markId:x.id,status:x.status,progress:x.progressPercent});
      if(!current.schemeMarks.some(item=>item.id===x.id))current.schemeMarks.push(x);
      await saveProject();state.dirty.delete(String(x.id));closeModal();renderMarks();stats();renderList();toolbar();
    }catch(error){
      if(!synced&&!previous)current.schemeMarks=current.schemeMarks.filter(item=>item!==x);
      else if(!synced&&previous){Object.keys(x).forEach(key=>{if(!(key in previous))delete x[key];});Object.assign(x,previous);}
      alert('Не удалось сохранить отметку: '+(error.message||error));
    }finally{button.disabled=false;}
  }

  async function deleteMark(x){if(!x||!confirm('Удалить отметку со схемы?'))return;const previous={...x};let synced=false;x.active=false;x.updatedAt=x.deletedAt=now();try{await syncMark(x);synced=true;const stored=p().schemeMarks.find(item=>item.id===x.id);if(stored)Object.assign(stored,x);await saveProject();state.dirty.delete(String(x.id));state.selected='';closeModal();renderMarks();stats();renderList();toolbar();}catch(error){if(!synced){Object.keys(x).forEach(key=>{if(!(key in previous))delete x[key];});Object.assign(x,previous);}alert('Не удалось удалить отметку: '+(error.message||error));}}
  async function page(d){if(!state.pdf)return;const n=Math.min(state.pdf.numPages,Math.max(1,state.page+d));if(n!==state.page){state.page=n;await renderPage();}}
  function zoom(d){if(!state.pdf)return;state.zoom=clamp(state.zoom+d,.4,3);renderPage();}

  function openUpload(file) {
    if(!canWrite())return;if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))return alert('Можно загрузить только PDF.');if(file.size>100*1024*1024)return alert('PDF превышает 100 МБ.');state.pending=file;const current=p(),name=file.name.replace(/\.pdf$/i,'');openModal('Загрузка PDF-схемы',`<div class="form-grid"><div class="field"><label>Название</label><input id="suName" value="${html(name)}"></div><div class="field"><label>Редакция</label><input id="suRevision" placeholder="Р1"></div><div class="field"><label>Здание</label><select id="suBuilding">${options(current.buildings,'')}</select></div><div class="field"><label>Шахматка</label><select id="suMatrix">${options(current.matrices,'')}</select></div></div><div class="sch-note">Файл: <b>${html(file.name)}</b><br>Размер: ${(file.size/1024/1024).toFixed(1)} МБ.<br>Отметки сохраняются отдельно от PDF и не съезжают при масштабировании.</div><div class="liv-editor-footer"><button id="suCancel" class="btn">Отмена</button><button id="suSave" class="btn primary">Загрузить</button></div>`);$s('suCancel').onclick=()=>{state.pending=null;closeModal();};$s('suSave').onclick=upload;
  }

  async function upload() {
    const file=state.pending,current=p(),client=window.LIV_SUPABASE;if(!file||!current||!client)return alert('Нет подключения к серверу.');if(!window.LIV_NORMALIZED_SYNC?.projectId?.())return alert('Дождись подключения серверного проекта и повтори.');const b=$s('suSave');if(b.disabled)return;b.disabled=true;b.textContent='Загрузка...';const id=makeId('SCH'),path=`schemes/${safeName(id)}/source.pdf`,t=now();try{const u=await client.storage.from(BUCKET).upload(path,file,{contentType:'application/pdf',upsert:false});if(u.error)throw u.error;const x={id,name:$s('suName').value.trim()||file.name,fileName:file.name,storagePath:path,mimeType:'application/pdf',fileSize:file.size,pageCount:0,buildingId:$s('suBuilding').value,matrixId:$s('suMatrix').value,revision:$s('suRevision').value.trim(),status:'Загружена',active:true,createdAt:t,updatedAt:t};try{await syncScheme(x);}catch(error){current.schemes=current.schemes.filter(y=>y.id!==x.id);await client.storage.from(BUCKET).remove([path]);throw error;}current.schemes.push(x);await saveProject();state.pending=null;closeModal();render();await select(x.id);}catch(error){alert('Не удалось загрузить PDF: '+(error.message||error));b.disabled=false;b.textContent='Загрузить';}
  }

  const userId=()=>window.LIV_REMOTE_SYNC?.userId?.()||null;
  // Serialize writes to one entity: upload, editing and background link refresh
  // must not race between the existence check and INSERT/versioned UPDATE.
  const entityWrites = new Map();
  async function writeVersioned(table,x,data){
    const key=table+':'+x.id;
    const previous=entityWrites.get(key)||Promise.resolve();
    const task=previous.catch(()=>{}).then(()=>writeVersionedUnlocked(table,x,data));
    entityWrites.set(key,task);
    try{return await task;}
    finally{if(entityWrites.get(key)===task)entityWrites.delete(key);}
  }
  async function writeVersionedUnlocked(table,x,data){
    const client=window.LIV_SUPABASE;
    if(!client)return;

    if(!x.serverId){
      const existing=await client
        .from(table)
        .select('id,row_version')
        .eq('external_id',x.id)
        .maybeSingle();
      if(existing.error)throw existing.error;

      if(existing.data?.id){
        x.serverId=existing.data.id;
        x.serverVersion=Number(existing.data.row_version||1);
      }else{
        const inserted=await client
          .from(table)
          .insert({...data,created_by:userId()})
          .select('id,row_version')
          .single();
        if(inserted.error)throw inserted.error;
        x.serverId=inserted.data.id;
        x.serverVersion=Number(inserted.data.row_version||1);
        return;
      }
    }

    if(!x.serverVersion){
      const version=await client
        .from(table)
        .select('row_version')
        .eq('id',x.serverId)
        .single();
      if(version.error)throw version.error;
      x.serverVersion=Number(version.data?.row_version||1);
    }

    const expected=Number(x.serverVersion||1);
    const updated=await client
      .from(table)
      .update(data)
      .eq('id',x.serverId)
      .eq('row_version',expected)
      .select('row_version');

    if(updated.error)throw updated.error;
    if(!updated.data||updated.data.length!==1){
      throw new Error('Конфликт редактирования: объект уже изменён другим пользователем. Обнови страницу и повтори.');
    }

    x.serverVersion=Number(updated.data[0].row_version||expected+1);
  }

  async function deleteVersioned(table,x){
    const client=window.LIV_SUPABASE;
    if(!client||!x)return;

    if(!x.serverId){
      const existing=await client
        .from(table)
        .select('id,row_version')
        .eq('external_id',x.id)
        .maybeSingle();
      if(existing.error)throw existing.error;
      if(!existing.data?.id)return;
      x.serverId=existing.data.id;
      x.serverVersion=Number(existing.data.row_version||1);
    }

    if(!x.serverVersion){
      const version=await client
        .from(table)
        .select('row_version')
        .eq('id',x.serverId)
        .single();
      if(version.error)throw version.error;
      x.serverVersion=Number(version.data?.row_version||1);
    }

    const removed=await client
      .from(table)
      .delete()
      .eq('id',x.serverId)
      .eq('row_version',Number(x.serverVersion||1))
      .select('id');

    if(removed.error)throw removed.error;
    if(!removed.data||removed.data.length!==1){
      throw new Error('Конфликт удаления: объект уже изменён другим пользователем. Обнови страницу и повтори.');
    }
  }

  async function syncScheme(x){
    const client=window.LIV_SUPABASE;
    if(!client)return;
    const normalizer=window.LIV_NORMALIZED_SYNC;
    const projectId=normalizer?.ensureProjectId?await normalizer.ensureProjectId():normalizer?.projectId?.();
    if(!projectId)throw new Error('Дождись подключения серверного проекта и повтори.');
    const data={
      project_id:projectId,
      external_id:x.id,
      name:x.name,
      file_name:x.fileName,
      storage_path:x.storagePath,
      mime_type:'application/pdf',
      page_count:Number(x.pageCount||0),
      building_id:normalizer?.serverId?.('building',x.buildingId)||null,
      matrix_id:normalizer?.serverId?.('matrix',x.matrixId)||null,
      revision:x.revision||null,
      status:x.status||'Загружена',
      active:x.active!==false,
      updated_at:x.updatedAt||now(),
      custom_data:{
        buildingExternalId:x.buildingId||'',
        matrixExternalId:x.matrixId||'',
        fileSize:Number(x.fileSize||0)
      }
    };
    await writeVersioned('schemes',x,data);
  }

  async function syncMark(x){
    const client=window.LIV_SUPABASE,item=scheme(x.schemeId);
    if(!client||!item)throw new Error('Схема или подключение к серверу недоступны');
    if(!item.serverId)await syncScheme(item);
    const normalizer=window.LIV_NORMALIZED_SYNC;
    const data={
      project_id:normalizer?.projectId?.(),
      external_id:x.id,
      scheme_id:item.serverId,
      page_no:Number(x.pageNo||1),
      x:clamp(x.x),
      y:clamp(x.y),
      width:clamp(x.width),
      height:clamp(x.height),
      mark_type:x.markType||'area',
      title:x.title||null,
      status:x.status||'Не начато',
      progress_percent:x.progressPercent===null||x.progressPercent===undefined||x.progressPercent===''?null:Math.round(clamp(x.progressPercent,0,100)),
      work_id:normalizer?.serverId?.('work',x.workId)||null,
      organization_id:normalizer?.serverId?.('organization',x.organizationId)||null,
      front_id:normalizer?.serverId?.('front',x.frontId)||null,
      element_group_id:normalizer?.serverId?.('elementGroup',x.elementGroupId)||null,
      numbered_element_id:normalizer?.serverId?.('numberedElement',x.numberedElementId)||null,
      completed_at:x.completedAt||null,
      completed_by:x.completedBy||null,
      comment:x.comment||null,
      active:x.active!==false,
      updated_at:x.updatedAt||now(),
      custom_data:{
        lineReverse:!!x.lineReverse,
        appearance:appearance(x),
        workExternalId:x.workId||'',
        organizationExternalId:x.organizationId||'',
        frontExternalId:x.frontId||'',
        elementGroupExternalId:x.elementGroupId||'',
        numberedElementExternalId:x.numberedElementId||''
      }
    };

    try{
      await writeVersioned('scheme_marks',x,data);
    }catch(error){
      console.warn('LIV Schemes: sync mark failed',error);
      throw error;
    }
  }

  async function download(){const x=scheme(state.schemeId),client=window.LIV_SUPABASE;if(!x||!client)return;loading(true,'Подготовка файла...');try{const r=await client.storage.from(BUCKET).download(x.storagePath);if(r.error)throw r.error;const url=URL.createObjectURL(r.data),a=document.createElement('a');a.href=url;a.download=x.fileName||`${x.name}.pdf`;a.click();URL.revokeObjectURL(url);}catch(error){alert('Не удалось скачать PDF: '+(error.message||error));}finally{loading(false);}}
  function openDelete(){const x=scheme(state.schemeId);if(!x||!canWrite())return;openModal('Удаление PDF-схемы',`<div class="notice bad">Будет удалена схема <b>${html(x.name)}</b>, исходный PDF и ${marks(x.id).length} отметок. Фронты и шахматки не удаляются.</div><div class="liv-editor-footer"><button id="sdCancel" class="btn">Отмена</button><button id="sdConfirm" class="btn danger">Удалить</button></div>`);$s('sdCancel').onclick=closeModal;$s('sdConfirm').onclick=removeScheme;}
  async function removeScheme(){
    const x=scheme(state.schemeId),client=window.LIV_SUPABASE;
    if(!x)return;
    try{
      if(client){
        await deleteVersioned('schemes',x);

        if(x.storagePath){
          const removed=await client.storage.from(BUCKET).remove([x.storagePath]);
          if(removed.error){
            console.warn('LIV Schemes: PDF storage cleanup failed',removed.error);
          }
        }
      }

      x.active=false;
      x.deletedAt=x.updatedAt=now();
      marks(x.id).forEach(m=>{m.active=false;m.deletedAt=m.updatedAt=x.deletedAt;});
      state.dirty.forEach((m,id)=>{if(m.schemeId===x.id)state.dirty.delete(id);});state.selected='';
      await saveProject();

      const cached=state.cache.get(x.id);
      state.cache.delete(x.id);
      try{await cached?.destroy?.();}catch(_){}

      closeModal();
      clear();
    }catch(error){
      alert('Не удалось удалить схему: '+(error.message||error));
    }
  }

  async function resyncServerLinks(){
    if(state.linksRunning||!canWrite()||!window.LIV_NORMALIZED_SYNC?.projectId?.())return;
    const current=p();
    if(!current)return;
    state.linksRunning=true;
    try{

    for(const item of (current.schemes||[]).filter(x=>x.active!==false)){
      try{await syncScheme(item);}catch(error){console.warn('LIV Schemes: relation sync failed',error);}
    }

    for(const item of (current.schemeMarks||[]).filter(x=>x.active!==false)){
      if(state.dirty.has(String(item.id)))continue;
      item.progressPercent=derivedProgress(item.status,item.frontId,item.elementGroupId,item.numberedElementId);
      try{await syncMark(item);}catch(error){console.warn('LIV Schemes: mark relation sync failed',error);}
    }
    stats();renderMarks();
    }finally{state.linksRunning=false;}
  }

  function boot(){addStyles();addUi();bind();const timer=setInterval(()=>{if(ensure()){clearInterval(timer);render();}},150);setTimeout(()=>clearInterval(timer),15000);}
  window.addEventListener('liv-remote-project',()=>setTimeout(render,0));
  window.addEventListener('liv-normalized-sync-status',event=>{
    if(event.detail?.status==='ready')setTimeout(resyncServerLinks,50);
  });window.addEventListener('liv-auth-session',()=>setTimeout(render,0));let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.pdf&&!$s('tab-schemes')?.classList.contains('hidden'))renderPage();},250);});
  window.LIV_SCHEMES={render,select,upload:openUpload,openMark};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
