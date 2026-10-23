'use strict';
/* Progressive disclosure of existing controls; no domain data is created here. */
(function () {
 const states=new Map(),tickets=new WeakMap();let sequence=0,normalized=null;
 const id=p=>p?.meta?.constructionId||'LIV-MAIN';
 const current=()=>window.LIV_PROJECTS?.activeId?.()||'LIV-MAIN';
 const state=p=>{const key=id(p);if(!states.has(key))states.set(key,{ticket:0,phase:'waiting',message:''});return states.get(key);};
 function update(p,phase,ticket,error){const s=state(p);if(ticket!=null&&ticket!==s.ticket)return; s.phase=phase;s.message=error?.message||'';renderSave();}
 function localSaved(p){const s=state(p);s.ticket=++sequence;tickets.set(p,s.ticket);update(p,'device',s.ticket);}
 function friendly(error){const text=String(error||'');if(/42501|row.level security|permission|доступ/i.test(text))return 'Сервер отклонил запись по правам доступа. Скачайте резервную копию и сообщите об ошибке.';if(/timeout|57014/i.test(text))return 'Сервер не успел подтвердить запись. Скачайте резервную копию и повторите сохранение.';return text||'Причина пока не определена.';}
 function text(node,value){if(node&&node.textContent!==value)node.textContent=value;}
 function renderSave(){
  const bar=document.querySelector('.topbar');if(!bar)return;let host=document.getElementById('workflowSaveStatus');
  if(!host){host=document.createElement('details');host.id='workflowSaveStatus';host.className='workflow-save-status no-print';host.innerHTML='<summary><span role="status" aria-live="polite"></span></summary><div class="workflow-save-explanation"><p data-save-explanation></p><p data-save-normalized></p><p>Изменения записываются автоматически. «Скачать резервную копию» сохраняет отдельный JSON-файл. Поля незавершённой формы записываются после её кнопки «Сохранить».</p></div>';bar.appendChild(host);}
  const s=states.get(current())||{phase:'waiting'},labels={waiting:'Ожидаем загрузку данных',device:'Сохранено на устройстве · сервер ещё не подтверждён',queued:'Сохранено на устройстве · ожидает отправки',saving:'Сохранено на устройстве · отправляем на сервер',server:'Снимок проекта сохранён на сервере',error:'Нужен повтор сохранения на сервере',localError:'Не удалось сохранить на устройстве'};
  const dictionaryError=normalized?.status==='error';
  host.dataset.phase=dictionaryError&&s.phase==='server'?'warning':s.phase;
  text(host.querySelector('summary span'),labels[s.phase]+(dictionaryError?' · справочники требуют проверки':''));
  text(host.querySelector('[data-save-explanation]'),s.phase==='error'||s.phase==='localError'?friendly(s.message):s.phase==='server'?'Сервер подтвердил запись полного снимка проекта.':'Подтверждение сервера показывается только после успешного ответа.');
  text(host.querySelector('[data-save-normalized]'),normalized?.status==='ready'?'Справочники синхронизированы.':dictionaryError?'Справочники: '+friendly(normalized.lastError||normalized.message):'Синхронизация справочников проверяется отдельно.');
 }
 function field(control){return control?.closest('.field')||control?.closest('label');}
 function label(control,value){const f=field(control),l=f?.matches('label')?f:f?.querySelector('label');if(!l)return;const node=[...l.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(node)node.textContent=value;else if(!l.contains(control))l.textContent=value;}
 function disclosure(title,className){const d=document.createElement('details');d.className=className||'workflow-extra';const s=document.createElement('summary');s.textContent=title;d.appendChild(s);return d;}
 function milestone(){
  const title=document.getElementById('mTitle'),body=document.getElementById('modalBody');if(!title||!body||body.querySelector('.workflow-milestone'))return;
  const old=body.querySelector('.form-grid');if(!old)return;
  const primary=document.createElement('section');primary.className='workflow-milestone';primary.innerHTML='<p class="workflow-intro">Укажите обязательство и договорный срок. Место, связи, прогноз и подтверждение исполнения можно уточнить позже.</p><div class="form-grid workflow-primary-fields"></div>';
  old.before(primary);const grid=primary.querySelector('.form-grid');
  for(const key of ['mOrg','mContractId','mContractNo','mNo','mTitle','mContract','mBuilding']){const n=document.getElementById(key),f=field(n);if(f){grid.appendChild(f);if(key==='mTitle')f.classList.add('workflow-wide');}}
  label(document.getElementById('mContractNo'),'Номер договора, если его нет в списке');label(document.getElementById('mContract'),'Договорный срок исполнения');
  const extra=disclosure('Дополнительно: статус, место, связь с работой и прогноз');old.before(extra);extra.appendChild(old);
  const notes=disclosure('Комментарий и переписка');extra.after(notes);const comment=field(document.getElementById('mComment')),letters=document.getElementById('mLetters')?.closest('.card');if(comment)notes.appendChild(comment);if(letters)notes.appendChild(letters);
  text(document.getElementById('mSave'),'Сохранить КД');
 }
 function schedule(){
  const panel=document.getElementById('tab-schedule');if(!panel)return;
  const card=document.getElementById('scheduleImportCard');
  if(card&&!card.querySelector('.workflow-import-route')){
   const route=document.createElement('ol');route.className='workflow-import-route';route.setAttribute('aria-label','Этапы загрузки графика');for(const t of ['Файл и лист','Назначение','Проверка строк','Принять версию']){const li=document.createElement('li');li.textContent=t;route.appendChild(li);}card.prepend(route);
   const mapping=document.getElementById('scheduleMapping');if(mapping){const head=document.createElement('h3');head.textContent='3. Проверьте столбцы и строки';mapping.before(head);}
   const role=document.getElementById('scheduleRole');if(role){const head=document.createElement('h3');head.textContent='2. Для чего нужен график';role.closest('.schedule-mapping')?.before(head);}
   const accept=document.getElementById('schedulePromoteBtn'),cancel=document.getElementById('scheduleClearTestBtn');
   const review=document.createElement('section');review.id='workflowScheduleReview';review.className='card workflow-review no-print';review.innerHTML='<h3>4. Принять проверенную версию</h3><p data-workflow-review-message></p><div class="editor-actions"></div>';
   const area=panel.querySelector('#scheduleTable')?.closest('.card');card.after(review);
   if(accept)review.querySelector('.editor-actions').appendChild(accept);if(cancel)review.querySelector('.editor-actions').appendChild(cancel);
   const more=disclosure('Дополнительные параметры импорта');more.classList.add('workflow-import-extra');card.querySelector('.schedule-mapping')?.after(more);const grid=document.createElement('div');grid.className='schedule-mapping';more.appendChild(grid);
   for(const key of ['scheduleCalendar','scheduleMilestoneFallback','scheduleRegisterKD']){const n=document.getElementById(key);if(n)grid.appendChild(n.closest('label'));}
   const source=document.getElementById('scheduleSourceType');if(source)grid.appendChild(source.closest('.field'));
   label(document.getElementById('scheduleGroup'),'Название графика для всех его редакций');
   const hint=document.createElement('p');hint.className='muted';hint.textContent='Одинаковое название связывает редакции одного графика. Другому договору или самостоятельному графику задайте своё название.';role?.closest('.schedule-mapping')?.after(hint);
  }
  const mapping=document.getElementById('scheduleMapping'),mapGrid=mapping?.querySelector('.schedule-map-grid');
  if(mapGrid&&!mapGrid.dataset.workflow){mapGrid.dataset.workflow='true';const more=disclosure('Остальные столбцы: место, связи, статусы и комментарии');const grid=document.createElement('div');grid.className='schedule-map-grid';more.appendChild(grid);mapGrid.after(more);const primary=new Set(['name','building','workingStart','workingFinish','quantity','unit','sourceTaskId','predecessors']);for(const n of [...mapGrid.querySelectorAll('select[data-schedule-field]')])if(!primary.has(n.dataset.scheduleField))grid.appendChild(n.closest('label'));}
  const review=document.getElementById('workflowScheduleReview');if(review){let p;try{p=typeof project!=='undefined'?project:null;}catch{}const n=p?.scheduleStaging?.length||0;const ready=Boolean(n);text(review.querySelector('[data-workflow-review-message]'),ready?'Подготовлено работ: '+n+'. Проверьте строки предпросмотра и пометки «НА ПРОВЕРКЕ» в таблице графика. Принятие сохранит новую редакцию, предыдущая останется в истории.':'Здесь появится подтверждение после подготовки версии. Сначала выберите файл, назначение и проверьте строки.');for(const key of ['schedulePromoteBtn','scheduleClearTestBtn']){const b=document.getElementById(key);if(b)b.disabled=!ready||window.LIV_ACCESS?.canEdit===false;}}
 }
 function compactContext(){
  for(const tab of ['facts','forecast']){
   const panel=document.getElementById('tab-'+tab);if(!panel)continue;
   const brief=panel.querySelector('.shared-work-brief');if(brief&&!brief.querySelector('.workflow-context-brief')){const d=disclosure('Обзор выбранной работы','workflow-context-brief workflow-extra');const children=[...brief.children];brief.appendChild(d);for(const child of children)d.appendChild(child);}
   const surface=document.getElementById('planningSurface-'+tab);if(!surface||surface.querySelector(':scope > .workflow-context'))continue;
   const fields=[...surface.children].filter(n=>n.matches('.scope-bar,.planning-context'));if(!fields.length)continue;const d=disclosure('График, период и отбор','workflow-context workflow-extra');surface.prepend(d);for(const n of fields)d.appendChild(n);
  }
 }
 function daily(){
  compactContext();
  label(document.querySelector('#planningWorkbench [data-wb-param="frontId"]'),'Место учёта объёма и людей');
  const d=document.querySelector('#planningWorkbench [data-wb-section="daily"]');if(d&&!d.dataset.workflow){d.dataset.workflow='true';const grid=d.querySelector('.planning-grid');if(grid){const extra=disclosure('ИТР, механизаторы, техника и состав бригады');const secondary=document.createElement('div');secondary.className='planning-grid';extra.appendChild(secondary);grid.after(extra);const primary=new Set(['date','factType','quantity','organizationId','workers','comment']);for(const n of [...grid.querySelectorAll('[data-wb-field]')])if(!primary.has(n.dataset.wbField))secondary.appendChild(n.closest('label'));}const button=d.querySelector('[data-wb-action="daily"]');text(button,'Сохранить объём и людей');}
  const result=document.querySelector('.wb-mode-facts #wbResult');if(result&&!result.querySelector('.workflow-result-details')){const nodes=[...result.children].filter(n=>n.matches('.table-wrap,.wb-mini,details'));if(nodes.length){const extra=disclosure('Подробно: сроки, потребность и расчёт','workflow-result-details workflow-extra');result.appendChild(extra);for(const n of nodes)extra.appendChild(n);}}
 }
 function install(){renderSave();milestone();schedule();daily();const button=document.getElementById('livViewBuilderBtn');text(button,'Настроить вид');}
 const api={install,milestone,schedule,daily,ticket:p=>tickets.get(p)??state(p).ticket,localSaved,localFailed:(p,e)=>{const s=state(p);s.ticket=++sequence;tickets.set(p,s.ticket);update(p,'localError',s.ticket,e);},deviceLoaded:p=>{if(!states.has(id(p)))update(p,'device');},serverQueued:(p,t)=>update(p,'queued',t),serverSaving:(p,t)=>update(p,'saving',t),serverSaved:(p,t)=>update(p,'server',t),serverFailed:(p,t,e)=>update(p,'error',t,e),serverLoaded:p=>{const s=state(p);s.ticket=++sequence;tickets.set(p,s.ticket);update(p,'server',s.ticket);}};
 window.LIV_WORKFLOW=api;
 window.addEventListener('liv-normalized-sync-status',event=>{normalized=event.detail;renderSave();});
 function boot(){install();if(typeof MutationObserver==='function'){let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;window.requestAnimationFrame(()=>{queued=false;install();});});for(const root of [document.querySelector('main'),document.getElementById('modalBody')])if(root)observer.observe(root,{childList:true,subtree:true});}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
