'use strict';
(function(){
  const P=window.LIV_PLANNING;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el=id=>document.getElementById(id);
  const state={left:'',right:'',task:'',drafts:{},links:{},preview:null,critical:null,leveled:null,scenario:0,scenarios:{},settings:null,matrixRow:'place',matrixCol:'name',matrixMetric:'progress',organization:'',organizations:[],method:'average',from:new Date().toISOString().slice(0,7)+'-01',to:new Date().toISOString().slice(0,10)};
  const versionTasks=id=>(project.tasks||[]).filter(t=>(t.versionId||t.sourceImportId)===id&&t.active!==false);
  const dates=(task,type='working')=>(project.taskDates||[]).filter(d=>d.taskId===task.id&&d.type===type).slice(-1)[0]||{};
  const label=v=>[v.name||v.fileName,v.role==='customer'?'Заказчик':v.role==='contractor'?'Договор подрядчика':'Рабочий',v.effectiveDate||v.createdAt?.slice(0,10),v.isCurrent===false?'Архив':''].filter(Boolean).join(' · ');
  function host(){
    const panel=el('tab-schedule');if(!panel)return null;
    let h=el('planningTools');if(h)return h;
    h=document.createElement('section');h.id='planningTools';h.className='card planning-tools';panel.appendChild(h);
    h.addEventListener('input',liveInput);h.addEventListener('change',event=>{try{change(event);}catch(e){alert(e.message);}});h.addEventListener('click',click);return h;
  }
  function selectedInput(task){
    const front=(project.fronts||[]).find(f=>String(f.id)===String((state.drafts[task.id]||task.planning||{}).frontId||task.frontId));
    const q=(project.taskQuantities||[]).find(q=>q.taskId===task.id);
    const d=dates(task),saved=state.drafts[task.id]||task.planning||{};
    let span=null;
    if(d.start&&d.finish){span=0;for(let day=d.start;day<=d.finish;day=new Date(Date.parse(day)+86400000).toISOString().slice(0,10))if(P.workday(day,task.calendar||'7x0'))span++;}
    const input={mode:'manual',manual:task.isMilestone?0:span??task.durationAccepted,
      total:front?.totalQty??q?.quantity??'',done:front?.doneQty??0,rate:'',resources:1,start:d.start||d.finish,
      calendar:task.calendar||'7x0',actualStart:dates(task,'actual').start||front?.factStart||'',frontId:task.frontId||'',unit:front?.unit||q?.unit||task.unit||'',...saved};
    input.calendar=calendarFor(input.calendar);
    if(Number(task.progressPercent)>=100){const actual=dates(task,'actual');return {...input,fixed:true,start:actual.start||d.start,finish:actual.finish||d.finish};}
    if(input.mode==='actual'){
      const asOf=input.asOf||new Date().toISOString().slice(0,10),windowDays=Number(input.windowDays)||7;
      if(!P.date(asOf)||!Number.isInteger(windowDays)||windowDays<1||windowDays>366)throw Error('Укажите дату факта и окно темпа от 1 до 366 дней.');
      const rows=window.LIV_FACT_SERIES.primaryRows(project,new Set([String(input.frontId)]));
      const series=window.LIV_FACT_SERIES.series(rows,asOf);
      let count=0,sum=0;const from=new Date(Date.parse(asOf)-(windowDays-1)*86400000).toISOString().slice(0,10);
      for(let d=from;d<=asOf;d=new Date(Date.parse(d)+86400000).toISOString().slice(0,10)){if(P.workday(d,input.calendar))count++;sum+=series.daily.get(d)||0;}
      input.rate=count?Math.max(0,sum/count):0;input.resources=1;input.done=series.actual;input.start=P.shift(asOf,1,input.calendar);
      if(!input.frontId)throw Error('Для фактического темпа выберите фронт.');
    }
    return input;
  }
  function dependenciesFor(tasks){
    const ids=new Set(tasks.map(t=>t.id));
    return [...(project.dependencies||[]).filter(d=>ids.has(d.successorTaskId)&&!Object.hasOwn(state.links,d.successorTaskId)),
      ...Object.entries(state.links).filter(([id])=>ids.has(id)).flatMap(([successorTaskId,links])=>links.map(d=>({...d,successorTaskId})))];
  }
  function readDraft(){
    if(!state.task||!el('planningMode'))return;
    const previous=state.drafts[state.task]||{};
    state.drafts[state.task]={...previous,mode:el('planningMode').value,manual:el('planningManual').value,total:el('planningTotal').value,
      done:el('planningDone').value,rate:el('planningRate').value,resources:el('planningResources').value,start:el('planningStart').value,
      calendar:{week:el('planningCalendar').value,taskHolidays:parseDates(el('planningTaskHolidays')?.value||''),taskWorkingDays:parseDates(el('planningTaskWorkingDays')?.value||'')},resourceSteps:parseSteps(el('planningSteps')?.value||''),pool:el('planningPool')?.value||'',assignments:parseAssignments(el('planningAssignments')?.value||''),priority:el('planningPriority')?.value||0,weight:el('planningWeight')?.value||1,availableFrom:el('planningAvailable')?.value||'',target:el('planningTarget')?.value||'',frontId:el('planningFront').value,unit:el('planningUnit').value,asOf:el('planningAsOf').value,windowDays:el('planningWindow').value};
    if(el('planningPredecessors')){
      const previousLinks=dependenciesFor(versionTasks(state.right)).filter(d=>d.successorTaskId===state.task);
      state.links[state.task]=Array.from(el('planningPredecessors').options).filter(o=>o.selected).map(o=>previousLinks.find(d=>d.predecessorTaskId===o.value)||{predecessorTaskId:o.value,linkType:el('planningLinkType').value,lagDays:Number(el('planningLag').value)||0});
    }
    state.preview=null;state.critical=null;state.leveled=null;
  }
  function change(event){
    const id=event.target.id;
    if(['planningRateSlider','planningResourcesSlider'].includes(id))return;
    if(id==='planningView'){const v=(settings().views||[]).find(v=>v.name===event.target.value);if(v){Object.assign(state,v.config);render();}return;}
    if(id==='planningViewName')return;
    if(id==='planningScenario'){readDraft();storeScenario();state.scenario=Number(event.target.value);loadScenario();render();return;}
    if(id==='planningOrganization'){state.organizations=Array.from(event.target.options).filter(o=>o.selected&&o.value).map(o=>o.value);state.organization='';render();return;}
    if(['planningMatrixRow','planningMatrixCol','planningMatrixMetric','planningOrganization','planningMethod'].includes(id)){state[{planningMatrixRow:'matrixRow',planningMatrixCol:'matrixCol',planningMatrixMetric:'matrixMetric',planningOrganization:'organization',planningMethod:'method'}[id]]=event.target.value;render();return;}
    if(['planningHolidays','planningWorkingDays','planningCapacities','planningProjectDeadline'].includes(id)){readSettings();state.preview=null;state.critical=null;state.leveled=null;render();return;}
    if(id==='planningFactRecord'){const row=(project.progressFacts||[]).find(r=>r.id===event.target.value);if(row){el('planningFactDate').value=row.factDate;el('planningFactType').value=row.factType;el('planningFactQuantity').value=row.factType==='cumulative_snapshot'?row.cumulativeQty:row.quantity;el('planningFactComment').value=row.comment||'';}return;}
    if(id.startsWith('manual')||id.startsWith('editTask')||id.startsWith('planningFact'))return;
    if(id==='planningFrom'||id==='planningTo'){state[id==='planningFrom'?'from':'to']=event.target.value;render();return;}
    if(id==='planningLeft'||id==='planningRight'){readDraft();state[id==='planningLeft'?'left':'right']=event.target.value;state.task='';state.preview=null;}
    else if(id==='planningTask'){readDraft();state.task=event.target.value;}
    else if(id==='planningFront'){
      readDraft();const f=(project.fronts||[]).find(f=>f.id===event.target.value);
      if(f)Object.assign(state.drafts[state.task],{total:f.totalQty,done:window.LIV_FACT_SERIES.series(window.LIV_FACT_SERIES.primaryRows(project,new Set([String(f.id)])),el('planningAsOf').value).actual,unit:f.unit});
    }else if(id==='planningLinkType'||id==='planningLag'){
      readDraft();state.links[state.task]=(state.links[state.task]||[]).map(d=>({...d,linkType:el('planningLinkType').value,lagDays:Number(el('planningLag').value)||0}));
    }else if(id.startsWith('planning'))readDraft();
    render();
  }
  async function click(event){
    const button=event.target.closest('button');if(!button)return;
    try{
      if(button.dataset.openTask){readDraft();state.task=button.dataset.openTask;render();el('planningTask')?.scrollIntoView?.({block:'center'});return;}
      if(button.id==='planningNewSchedule')await createManual();
      if(button.id==='planningEditTask')await editManualTask();
      if(button.id==='planningAddTask')await addManualTask();
      if(button.id==='planningBaseline')await pinBaseline();
      if(button.id==='planningViewSave')await saveView();
      if(button.id==='planningSettingsSave'){readDraft();readSettings();await P.persist(project,()=>{project.planningSettings=structuredCopy(state.settings);},()=>saveProject());render();}
      if(button.id==='planningLevel'){readDraft();readSettings();const tasks=versionTasks(state.right),deps=dependenciesFor(tasks);state.leveled=P.levelResources(tasks,deps,selectedInput,state.settings.capacities);state.preview=state.leveled.results;state.critical=P.criticalPath(tasks,deps,state.leveled.inputs,settings().deadline);render();}
      if(button.id==='planningCalculate'){
        readDraft();const tasks=versionTasks(state.right),ids=new Set(tasks.map(t=>t.id));
        const dependencies=dependenciesFor(tasks);
        state.critical=P.criticalPath(tasks,dependencies,selectedInput,settings().deadline);state.preview=state.critical.results;render();
      }
      if(button.id==='planningSave')await saveScenario();
      if(button.id==='planningFactSave')await saveManualFact();
      if(button.id==='planningPrint')window.print();
    }catch(error){alert(error.message);}
  }
  async function saveScenario(){
    if(window.LIV_ACCESS?.canEdit===false)throw Error('Нет права изменять график.');
    if(!state.preview)throw Error('Сначала рассчитайте и проверьте прогноз.');
    const source=project.scheduleVersions.find(v=>v.id===state.right);
    if(!confirm('Сохранить расчёт как новую рабочую версию? Договорный график и предыдущие версии сохраняются.'))return;
    const now=new Date().toISOString(),id='SVER-'+crypto.randomUUID(),tasks=versionTasks(state.right),mapping=new Map(tasks.map(t=>[t.id,'TASK-'+crypto.randomUUID()]));
    const group=(source.name||source.fileName).startsWith('Прогноз: ')?(source.name||source.fileName):'Прогноз: '+(source.name||source.fileName),scheduleKey='working|'+group.toLowerCase();
    const v={...source,id,name:group,versionNo:Math.max(0,...project.scheduleVersions.filter(v=>(v.name||v.fileName)===group).map(v=>Number(v.versionNo)||0),project.scheduleVersions.filter(v=>(v.name||v.fileName)===group).length)+1,role:'working',registerMilestones:false,scheduleKey,status:'Тест',effectiveDate:now.slice(0,10),createdAt:now,acceptedAt:null,isCurrent:false,derivedFrom:source.id,isBaseline:false,rowsCreated:tasks.length};
    if((project.scheduleStaging||[]).length)throw Error('Сначала примите или удалите тестовый импорт, чтобы сохранить прогноз.');
    const staged=tasks.map(t=>{
      const result=state.preview.get(t.id),input=state.leveled?state.leveled.inputs(t):selectedInput(t),newId=mapping.get(t.id);
      const ds=(project.taskDates||[]).filter(d=>d.taskId===t.id).map(d=>({...d,id:'TD-'+crypto.randomUUID(),taskId:newId}));
      const work=ds.filter(d=>d.type==='working').slice(-1)[0];if(work)Object.assign(work,{start:result.start,finish:result.finish,createdAt:now});else ds.push({id:'TD-'+crypto.randomUUID(),taskId:newId,type:'working',start:result.start,finish:result.finish,createdAt:now});
      return {task:{...t,id:newId,versionId:id,sourceImportId:id,scheduleKey,role:'working',effectiveDate:v.effectiveDate,frontId:input.frontId||'',planning:input,calendar:input.calendar,durationAccepted:result.days,isCritical:state.critical?.results.get(t.id)?.isCritical||false,totalFloat:state.critical?.results.get(t.id)?.totalFloat,parentTaskId:mapping.get(t.parentTaskId)||'',testOnly:true},
        dates:ds,quantities:P.number(input.total)===null?[]:[{id:'TQ-'+crypto.randomUUID(),taskId:newId,name:'Основной объём',quantityType:'primary',quantity:P.number(input.total),unit:input.unit}],
        dependencies:dependenciesFor(tasks).filter(d=>d.successorTaskId===t.id).map(d=>({...d,id:'DEP-'+crypto.randomUUID(),versionId:id,predecessorTaskId:mapping.get(d.predecessorTaskId),successorTaskId:newId}))};
    });
    await P.persist(project,()=>{
      project.planningSettings=structuredCopy(settings());project.scheduleVersions.unshift(v);project.scheduleStaging=staged;P.accept(project,id);
      for(const t of project.tasks.filter(t=>t.versionId===id&&t.milestoneId)){const m=(project.milestones||[]).find(m=>m.id===t.milestoneId);if(m){m.workDate=dates(t).finish;m.scheduleTaskId=t.id;m.updatedAt=now;}}
      project.importHistory=project.importHistory||[];project.importHistory.unshift({id,type:'schedule',fileName:v.name,derivedFrom:source.id,createdAt:now,rowsCreated:tasks.length});
    },()=>saveProject());state.right=id;state.task='';state.preview=null;renderSchedule();
  }
  function render(){
    if(typeof project==='undefined'||!project)return;
    const h=host();if(!h)return;
    const openDetails=new Set(Array.from(h.querySelectorAll('details[open]')).map(d=>d.querySelector('summary')?.textContent));
    const versions=(project.scheduleVersions||[]).filter(v=>['Принят','Архив'].includes(v.status));
    if(!versions.length){h.innerHTML=manualForm()+'<p class="muted">Создайте график вручную или загрузите файл.</p>';return;}
    if(!versions.some(v=>v.id===state.right))state.right=versions[0].id;
    if(!versions.some(v=>v.id===state.left))state.left=versions[1]?.id||state.right;
    const tasks=versionTasks(state.right);if(!tasks.some(t=>t.id===state.task))state.task=tasks[0]?.id||'';
    const selected=tasks.find(t=>t.id===state.task);
    let input={},inputError='';if(selected){try{input=selectedInput(selected);}catch(e){input={...selected.planning,...state.drafts[selected.id]};inputError=e.message;}}
    const options=value=>versions.map(v=>'<option value="'+esc(v.id)+'" '+(v.id===value?'selected':'')+'>'+esc(label(v))+'</option>').join('');
    const comparisons=P.compare(versionTasks(state.left),tasks,t=>dates(t));
    const late=comparisons.filter(r=>r.delta>0&&r.status!=='Требует сопоставления'),early=comparisons.filter(r=>r.delta<0&&r.status!=='Требует сопоставления');
    const numField=(id,label,value)=>'<label>'+label+'<input id="'+id+'" type="number" min="0" step="any" value="'+esc(value??'')+'"></label>';
    const version=versions.find(v=>v.id===state.right);
    const links=dependenciesFor(tasks).filter(d=>d.successorTaskId===state.task);
    h.innerHTML=manualForm()+`<h2>Сравнение версий и графиков сторон</h2>
      <div class="planning-grid"><label>С чем сравниваем<select id="planningLeft">${options(state.left)}</select></label><label>Выбранная версия<select id="planningRight">${options(state.right)}</select></label></div>
      <div class="planning-kpis"><span><b>${late.length}</b> работ с более поздним сроком</span><span><b>${early.length}</b> с более ранним сроком</span><span><b>${comparisons.filter(r=>r.status==='Добавлено').length}</b> добавлено</span><span><b>${comparisons.filter(r=>r.status==='Отсутствует').length}</b> отсутствует</span></div>
      <p class="muted">Сопоставление по фронту или точному сочетанию здания, работы, элемента и места. Переименованные и укрупнённые работы автоматически не объединяются. «+» — срок стал позже, «−» — раньше; календарные дни.</p>
      <button class="btn" id="planningBaseline">Закрепить выбранную версию как базовую</button><p class="muted">Базовая версия: ${esc(versions.find(v=>v.isBaseline)?.name||'не закреплена')}. Базовая — закреплённая версия графика любой стороны.</p>
      <div class="table-wrap"><table><thead><tr><th>Работа / место</th><th>Было: начало</th><th>Было: окончание</th><th>Стало: начало</th><th>Стало: окончание</th><th>Сдвиг начала</th><th>Сдвиг окончания</th><th>Готовность</th><th>Результат</th></tr></thead><tbody>${comparisons.map(r=>`<tr><td>${esc((r.now||r.old).name)}<small>${esc(context(r.now||r.old))}</small></td><td>${esc(r.before.start||'—')}</td><td>${esc(r.before.finish||'—')}</td><td>${esc(r.after.start||'—')}</td><td>${esc(r.after.finish||'—')}</td><td>${r.status==='Требует сопоставления'?'—':signed(r.startDelta)}</td><td class="${r.delta>0?'planning-late':r.delta<0?'planning-early':''}">${r.status==='Требует сопоставления'?'—':signed(r.delta)}</td><td>${r.old?Math.round(r.old.progressPercent||0)+'%':'—'} → ${r.now?Math.round(r.now.progressPercent||0)+'%':'—'}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table></div>
      <h2>Расчёт оставшейся длительности</h2><p class="muted">${esc(label(version))}. Расчёт создаёт отдельный прогноз. Для нулевого остатка длительность равна нулю. Заданный темп — на один ресурс за производственный день; фактический темп — общий по фронту.</p>
      <label>Работа<select id="planningTask">${tasks.map(t=>`<option value="${esc(t.id)}" ${t.id===state.task?'selected':''}>${esc(t.name+' · '+context(t))}</option>`).join('')}</select></label>
      <div class="planning-grid">
      <label>Режим<select id="planningMode">${[['manual','Вручную'],['productivity','По выработке на ресурс'],['actual','По фактическому темпу фронта']].map(([v,l])=>`<option value="${v}" ${input.mode===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Связанный фронт<select id="planningFront"><option value="">Не выбран</option>${(project.fronts||[]).filter(f=>f.active!==false).map(f=>`<option value="${esc(f.id)}" ${f.id===input.frontId?'selected':''}>${esc(typeof frontLabel==='function'?frontLabel(f):f.name||f.id)}</option>`).join('')}</select></label>
      ${numField('planningManual','Длительность вручную, раб. дн.',input.manual)}${numField('planningTotal','Общий объём',input.total)}${numField('planningDone','Выполнено',input.done)}
      <label>Единица объёма<input id="planningUnit" value="${esc(input.unit||'')}"></label>
      ${numField('planningRate','Выработка на ресурс в день',input.rate)}${numField('planningResources','Количество ресурсов',input.resources)}
      <label>Начало оставшихся работ<input type="date" id="planningStart" value="${esc(input.start||'')}"></label>
      <label>Календарь<select id="planningCalendar">${[['7x0','7 дней'],['6x1','6 дней'],['5x2','5 дней']].map(([v,l])=>`<option value="${v}" ${(input.calendar?.week||input.calendar)===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Нерабочие даты этой работы<textarea id="planningTaskHolidays">${esc((input.calendar?.taskHolidays||[]).join('\n'))}</textarea></label><label>Рабочие выходные этой работы<textarea id="planningTaskWorkingDays">${esc((input.calendar?.taskWorkingDays||[]).join('\n'))}</textarea></label>
      <label>Дата факта<input type="date" id="planningAsOf" value="${esc(input.asOf||new Date().toISOString().slice(0,10))}"></label>
      ${numField('planningWindow','Окно темпа, календарных дней',input.windowDays||7)}
      <label>Предшествующие работы (несколько — с Ctrl)<select id="planningPredecessors" multiple size="4">${tasks.filter(t=>t.id!==state.task).map(t=>`<option value="${esc(t.id)}" ${links.some(d=>d.predecessorTaskId===t.id)?'selected':''}>${esc(t.name+' · '+context(t))}</option>`).join('')}</select></label>
      <label>Тип выбранных связей<select id="planningLinkType">${[['FS','Окончание → начало'],['SS','Начало → начало'],['FF','Окончание → окончание'],['SF','Начало → окончание']].map(([v,l])=>`<option value="${v}" ${links[0]?.linkType===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label>Задержка выбранных связей, раб. дн.<input type="number" id="planningLag" value="${esc(links[0]?.lagDays||0)}"></label>
      <label>Общая группа ресурса<input id="planningPool" value="${esc(input.pool||'')}" placeholder="Подрядчик / Буровые"></label>
      ${numField('planningPriority','Приоритет выравнивания (больше — раньше)',input.priority||0)}${numField('planningWeight','Вес работы для готовности',input.weight||1)}
      <label>Фронт доступен с<input type="date" id="planningAvailable" value="${esc(input.availableFrom||'')}"></label>
      <label>Требуемое окончание / КД<input type="date" id="planningTarget" value="${esc(input.target||dates(selected||{},'contract').finish||'')}"></label>
      <label>Количество ресурсов с даты<textarea id="planningSteps" placeholder="2026-10-26 = 4">${esc((input.resourceSteps||[]).map(r=>r.date+' = '+r.resources).join('\n'))}</textarea></label>
      <label>Дополнительные ресурсы на каждый рабочий день<textarea id="planningAssignments" placeholder="Рабочие = 10">${esc((input.assignments||[]).map(r=>r.pool+' = '+r.quantity).join('\n'))}</textarea></label>
      </div>${scenarioPanel(selected,input)}${factPanel(input)}${calendarPanel()}${taskEditor(selected)}<p class="muted">Пример: сваи / установка или м³ / рабочий. Увеличение ресурса считается линейным только в этом сценарии. Технологические паузы задаются отдельными задачами и связями. Праздники и рабочие выходные задаются вручную в календаре. Выравнивание учитывает только явно назначенные общие группы ресурсов.</p>
      ${inputError?'<p class="planning-late">'+esc(inputError)+'</p>':''}
      <button class="btn primary" id="planningCalculate">Рассчитать прогноз и критический путь</button><button class="btn" id="planningLevel">Предпросмотр выравнивания ресурсов</button>
      ${state.preview?'<button class="btn" id="planningSave">Сохранить отдельную рабочую версию</button>':''}
      ${state.preview?'<p data-calculation-preview class="muted">Начало и окончание — ранние сроки. Общий резерв — допустимый сдвиг до окончания графика или заданного срока; свободный — без переноса последующих работ. Связи задаются между конкретными работами. Резервы после выравнивания рассчитаны по технологическим связям; изменение ресурсов требует нового выравнивания.</p>'+previewTable(tasks)+gantt(tasks)+resourcePanel(tasks):''}
      ${volumeTable(tasks)}
      <h2>Шахматка выбранной версии</h2><p class="muted">Строки — место выполнения, столбцы — работы. Несколько записей в ячейке показаны отдельно. Приостановленные работы без заливки.</p>
      ${matrixControls()}${matrix(tasks)}<button class="btn no-print" id="planningPrint">Печать / PDF</button>`;
    for(const d of h.querySelectorAll('details'))if(openDetails.has(d.querySelector('summary')?.textContent))d.setAttribute('open','');
  }
  const context=t=>[t.building,t.block,t.floor!==''&&t.floor!=null?'Этаж '+t.floor:'',t.capture,t.axis,t.zone,t.element,t.network,t.segment].filter(Boolean).join(' · ');
  function previewTable(tasks){return '<div data-calculation-preview class="table-wrap"><table><thead><tr><th>Работа</th><th>Остаток</th><th>Рабочих дней</th><th>Начало</th><th>Прогноз</th><th>К исходному окончанию</th><th>Позднее начало</th><th>Позднее окончание</th><th>Общий резерв, раб. дн.</th><th>Свободный резерв, раб. дн.</th></tr></thead><tbody>'+tasks.map(t=>{const r=state.preview.get(t.id),cp=state.critical?.results.get(t.id),delta=P.days(dates(t).finish,r.finish);return `<tr><td>${esc(t.name+' · '+context(t))}</td><td>${r.remaining??'—'}</td><td>${r.days}</td><td>${r.start}</td><td>${r.finish}</td><td>${delta===null?'—':(delta>0?'+':'')+delta+' дн.'}</td><td>${esc(cp?.lateStart||'—')}</td><td>${esc(cp?.lateFinish||'—')}</td><td class="${cp?.isCritical?'planning-late':''}">${cp?.totalFloat??'—'}${cp?.isCritical?' · Критическая':''}</td><td>${cp?.freeFloat??'—'}</td></tr>`;}).join('')+'</tbody></table></div>';}
  function volumeTable(tasks){
    if(!P.date(state.from)||!P.date(state.to)||state.to<state.from)return '<h2>Объёмы: план / факт</h2><div class="planning-grid"><label>С<input type="date" id="planningFrom" value="'+esc(state.from)+'"></label><label>По<input type="date" id="planningTo" value="'+esc(state.to)+'"></label></div><p>Укажите корректный период: окончание не раньше начала.</p>';
    return analytics(tasks);
  }
  function matrix(tasks){
    tasks=filtered(tasks).filter(t=>!(Number(t.floor)<0)&&!t.isSummary&&!t.isMilestone);
    const value=(t,f)=>f==='place'?context(t):f==='organization'?t.organizationName||'Без организации':f==='floor'?(t.floor==null||t.floor===''?'Без этажа':'Этаж '+t.floor):t[f]||'Не указано';
    const cols=[...new Set(tasks.map(t=>value(t,state.matrixCol)))],rows=[...new Set(tasks.map(t=>value(t,state.matrixRow)))];
    return '<div class="table-wrap planning-matrix"><table><thead><tr><th>Место / работа</th>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr><th>'+esc(r)+'</th>'+cols.map(c=>'<td>'+tasks.filter(t=>value(t,state.matrixRow)===r&&value(t,state.matrixCol)===c).map(t=>{
      const suspended=/приостанов/i.test(t.status||''),stats=taskStats(t),progress=stats.current??Number(t.progressPercent||0),d=state.preview?.get(t.id)||dates(t),base=dates(t,'contract').finish||dates(t).finish;
      const metric=state.matrixMetric==='forecast'?d.finish||'—':state.matrixMetric==='delta'?signed(P.days(base,d.finish)):state.matrixMetric==='volume'?fmt(stats.cumulative)+' / '+fmt(stats.total)+' '+esc(stats.unit):fmt(progress)+'%';
      return `<button data-open-task="${esc(t.id)}" class="planning-cell ${suspended?'':progress>=100?'planning-complete':progress>0?'planning-started':''}"><b>${metric}</b><small>${esc(t.status||'Не начато')}</small><small>${esc(d.start||'—')} — ${esc(d.finish||'—')}</small></button>`;
    }).join('')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  const structuredCopy=v=>JSON.parse(JSON.stringify(v));
  const fmt=v=>v===null||v===undefined||v===''?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2});
  const signed=v=>v===null||v===undefined?'—':(v>0?'+':'')+fmt(v)+' дн.';
  function settings(){return state.settings||(state.settings=structuredCopy(project.planningSettings||{holidays:[],workingDays:[],capacities:{}}));}
  function calendarFor(c){const s=settings(),own=typeof c==='object'&&c?c:{week:c||'7x0'},closed=own.taskHolidays||[],opened=own.taskWorkingDays||[];if(closed.some(d=>opened.includes(d)))throw Error('У работы дата одновременно рабочая и нерабочая.');return {...own,holidays:[...new Set([...(s.holidays||[]),...closed])],workingDays:[...new Set([...(s.workingDays||[]).filter(d=>!closed.includes(d)),...opened])]};}
  function parseDates(v){return String(v||'').split(/[;\s,]+/).filter(Boolean).map(d=>{if(!P.date(d))throw Error('Неверная дата: '+d);return P.date(d);});}
  function lines(v){return String(v||'').split(/\n/).map(s=>s.trim()).filter(Boolean);}
  function parseSteps(v){return lines(v).map(line=>{const [d,n,...rest]=line.split('=');if(rest.length||!P.date(d.trim())||!(P.number(n)>=0)||P.number(n)===null)throw Error('Ресурс с даты: используйте ДД.ММ.ГГГГ = количество.');return {date:P.date(d.trim()),resources:P.number(n)};});}
  function parseAssignments(v){return lines(v).map(line=>{const [pool,n,...rest]=line.split('=');if(rest.length||!pool.trim()||P.number(n)===null||P.number(n)<0)throw Error('Ресурс: используйте название группы = количество.');return {pool:pool.trim(),quantity:P.number(n)};});}
  function readSettings(){
    const dates=id=>lines(el(id)?.value).flatMap(s=>s.split(/[;,\s]+/)).filter(Boolean).map(d=>{if(!P.date(d))throw Error('Неверная дата исключения: '+d);return P.date(d);});
    const candidate={...settings(),deadline:P.date(el('planningProjectDeadline')?.value),holidays:dates('planningHolidays'),workingDays:dates('planningWorkingDays'),capacities:Object.fromEntries(parseAssignments(el('planningCapacities')?.value).map(a=>[a.pool,a.quantity]))};
    if(candidate.holidays.some(d=>candidate.workingDays.includes(d)))throw Error('Одна дата указана и как рабочая, и как нерабочая.');state.settings=candidate;
  }
  function calendarPanel(){const s=settings();return `<details><summary>Календарь проекта и доступные ресурсы</summary><p class="muted">Исключения применяются ко всем выбранным недельным календарям. Даты вводятся вручную; официальные праздники автоматически не загружаются. Для отдельных работ доступны свои исключения, недельный календарь и дата передачи фронта. Исключение работы имеет приоритет над общим календарём. Группы ресурсов должны включать подрядчика, если ресурсы разных организаций не взаимозаменяемы.</p><div class="planning-grid"><label>Требуемое окончание всего графика<input id="planningProjectDeadline" type="date" value="${esc(s.deadline||'')}"></label><label>Нерабочие даты<textarea id="planningHolidays" placeholder="04.11.2026">${esc((s.holidays||[]).join('\n'))}</textarea></label><label>Рабочие выходные<textarea id="planningWorkingDays">${esc((s.workingDays||[]).join('\n'))}</textarea></label><label>Доступно в день по группам<textarea id="planningCapacities" placeholder="Подрядчик / Буровые = 3\nРабочие = 25">${esc(Object.entries(s.capacities||{}).map(([k,v])=>k+' = '+v).join('\n'))}</textarea></label></div><button class="btn" id="planningSettingsSave">Сохранить календарь и лимиты</button></details>`;}
  function storeScenario(){
    state.scenarios[state.scenario]={drafts:structuredCopy(state.drafts),links:structuredCopy(state.links)};
  }
  function loadScenario(){const s=state.scenarios[state.scenario]||state.scenarios[0];state.drafts=structuredCopy(s?.drafts||{});state.links=structuredCopy(s?.links||{});state.preview=null;state.critical=null;state.leveled=null;}
  function scenarioPanel(task,input){
    if(!task)return '';
    const rate=P.number(input.rate)||0,res=P.number(input.resources)||0;
    return `<section class="planning-scenarios"><h3>Что будет, если…</h3><label>Вариант<select id="planningScenario">${['Текущий темп','Усиление','Свой вариант'].map((v,i)=>`<option value="${i}" ${state.scenario===i?'selected':''}>${v}</option>`).join('')}</select></label><div class="planning-grid"><label>Выработка: <output id="planningRateValue">${fmt(rate)}</output><input aria-label="Выработка на ресурс" id="planningRateSlider" type="range" min="0.1" max="${Math.max(10,rate*3)}" step="0.1" value="${rate||0.1}"></label><label>Люди / техника: <output id="planningResourcesValue">${fmt(res)}</output><input aria-label="Количество людей или техники" id="planningResourcesSlider" type="range" min="1" max="${Math.max(50,res*3)}" step="1" value="${res||1}"></label></div><p class="muted">Ползунки переключают выбранную работу в расчёт по выработке. Начало и окончание сценария обновляются сразу. Для пересчёта всех связей нажмите «Рассчитать прогноз и критический путь».</p><div id="planningLive">${scenarioResults(task,input)}</div></section>`;
  }
  function liveInput(event){
    const id=event.target.id;if(!['planningRateSlider','planningResourcesSlider'].includes(id))return;
    try{
      const rate=id==='planningRateSlider';el(rate?'planningRate':'planningResources').value=event.target.value;
      el(rate?'planningRateValue':'planningResourcesValue').textContent=fmt(event.target.value);el('planningMode').value='productivity';
      readDraft();storeScenario();const task=versionTasks(state.right).find(t=>t.id===state.task);el('planningLive').innerHTML=scenarioResults(task,selectedInput(task));
      // Discard stale full-schedule preview and save action until recalculated.
      el('planningSave')?.remove();for(const node of el('planningTools').querySelectorAll('[data-calculation-preview]'))node.remove();
    }catch(e){el('planningLive').textContent=e.message;}
  }
  function scenarioResults(task,input){
    const scenarios=[0,1,2].map(i=>({i,input:i===state.scenario?input:state.scenarios[i]?.drafts?.[task.id]}));
    const target=P.date(input.target)||dates(task,'contract').finish;
    const rows=scenarios.map(({i,input:s})=>{if(!s)return `<tr><td>${['Текущий темп','Усиление','Свой вариант'][i]}</td><td colspan="6">Задайте параметры этого варианта</td></tr>`;try{
      const r=P.duration({...input,...s,calendar:calendarFor(s.calendar||input.calendar)}),done=P.number(s.done)||0,total=P.number(s.total),through=target?forecastQuantity({...input,...s},r,target):null;
      return `<tr><td>${['Текущий темп','Усиление','Свой вариант'][i]}</td><td>${esc(input.actualStart||r.start)}</td><td>${r.finish}</td><td>${r.days}</td><td>${signed(P.days(target,r.finish))}</td><td>${fmt(through===null?null:Math.min(total,done+through))}</td><td>${fmt(s.rate)} × ${fmt(s.resources)}</td></tr>`;
    }catch(e){return `<tr><td>${['Текущий темп','Усиление','Свой вариант'][i]}</td><td colspan="6">${esc(e.message)}</td></tr>`;}}).join('');
    let reverse='';try{if(target){const r=P.reverse(input,target);reverse=`<p>Чтобы успеть к <b>${esc(target)}</b>: общий темп <b>${fmt(r.requiredPace)}</b> ${esc(input.unit||'ед.')}/раб. день; выработка на ресурс <b>${fmt(r.requiredRate)}</b>; при постоянном количестве ресурсов и заданной выработке требуется <b>${fmt(r.requiredResources)}</b> ресурсов.</p>`;}}catch(e){reverse='<p>'+esc(e.message)+'</p>';}
    let chart='';try{chart=scenarioChart(task,input);}catch{}
    return `<div class="table-wrap"><table><thead><tr><th>Сценарий</th><th>Начало</th><th>Окончание</th><th>Раб. дней</th><th>К сроку</th><th>Объём к сроку</th><th>Выработка × ресурс</th></tr></thead><tbody>${rows}</tbody></table></div>${reverse}${chart}`;
  }
  function forecastQuantity(input,r,day){
    if(day<(r.remainingStart||r.start))return 0;
    if(r.curve?.length)return r.curve.filter(x=>x.date<=day).reduce((sum,x)=>sum+x.quantity,0);
    if(r.remaining===null)return null;
    const n=P.workingCount(r.remainingStart||r.start,day<r.finish?day:r.finish,input.calendar);
    return Math.min(r.remaining,input.mode==='manual'?r.days?r.remaining*n/r.days:r.remaining:n*r.capacity);
  }
  function scenarioChart(task,input){
    if(!(P.number(input.total)>0))return '';
    const matched=P.compare(versionTasks(state.left),[task],t=>dates(t)).find(row=>row.now?.id===task.id&&row.old&&row.status!=='Требует сопоставления');const base=matched?matched.before:dates(task),r=P.duration(input),frontId=input.frontId;
    const facts=frontId?window.LIV_FACT_SERIES.primaryRows(project,new Set([String(frontId)])):[],series=window.LIV_FACT_SERIES.series(facts,input.asOf||state.to);
    const scenarios=[{name:'Выбранный сценарий',input,result:r,color:'#c57b19'}];
    for(let i=0;i<3;i++){const s=state.scenarios[i]?.drafts?.[task.id];if(i!==state.scenario&&s){const v={...input,...s,calendar:calendarFor(s.calendar||input.calendar)};try{scenarios.push({name:['Текущий темп','Усиление','Свой вариант'][i],input:v,result:P.duration(v),color:['#718096','#7c5fc7','#b24e7b'][i]});}catch{}}}
    const all=[base.start,base.finish,r.start,...scenarios.map(s=>s.result.finish),...series.entries.map(x=>x.date)].filter(P.date).sort(),start=all[0],finish=all.at(-1),span=Math.max(1,P.days(start,finish)),total=Number(input.total),points=[];
    for(let i=0;i<=Math.min(span,120);i++)points.push(new Date(Date.parse(start)+Math.round(span*i/Math.min(span,120))*86400000).toISOString().slice(0,10));
    const x=d=>55+P.days(start,d)/span*790,y=q=>225-Math.max(0,Math.min(1,q/total))*185;
    const path=(points,color,label)=>`<polyline fill="none" stroke="${color}" stroke-width="3" points="${points.map(([d,q])=>x(d)+','+y(q)).join(' ')}"><title>${esc(label)}</title></polyline>`;
    const plan=base.start&&base.finish?path(points.map(d=>[d,P.volumePlan(total,base.start,base.finish,start,d,input.calendar)||0]),'#98a5b4','План выбранной версии'):'';
    const fact=series.hasFacts?path(series.entries.map(row=>[row.date,window.LIV_FACT_SERIES.series(facts,row.date).actual]),'#167a68','Факт'):'';
    const forecasts=scenarios.map(s=>path(points.filter(d=>d>=(s.result.remainingStart||s.result.start)).map(d=>[d,(Number(s.input.done)||0)+(forecastQuantity(s.input,s.result,d)||0)]),s.color,s.name)).join('');
    return `<figure class="planning-chart"><svg viewBox="0 0 900 265" role="img" aria-label="Накопительный план, факт и сценарии прогноза"><path d="M55 30V225H850" fill="none" stroke="#cbd5e1"/><text x="5" y="42">${fmt(total)}</text><text x="30" y="230">0</text>${plan}${fact}${forecasts}<text x="55" y="255">${start}</text><text x="740" y="255">${finish}</text></svg><figcaption>Серый — расчётный план версии сравнения (при отсутствии соответствия — выбранной); зелёный — факт; оранжевый — выбранный сценарий; фиолетовый и розовый — сохранённые в сеансе варианты. Ед.: ${esc(input.unit||'не задана')}. Расчёт одной работы без влияния связей.</figcaption></figure>`;
  }
  function manualForm(){return `<details class="planning-manual"><summary>Создать график вручную / вставить строки из Excel</summary><div class="planning-grid"><label>Название / группа<input id="manualName" placeholder="Паркинг / договор Строитель"></label><label>Назначение<select id="manualRole"><option value="working">Рабочий</option><option value="contractor">Договор подрядчика</option><option value="customer">График Заказчика</option></select></label><label>Дата версии<input id="manualDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Организация<select id="manualOrganization"><option value="">Не выбрана</option>${(project.organizations||[]).filter(o=>o.active!==false).map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select></label><label>Номер договора<input id="manualContract"></label><label><input id="manualRegisterKD" type="checkbox">Зарегистрировать КД в журнале</label></div><p>Вставьте строки без шапки, столбцы разделяйте табуляцией: <b>Работа · Здание · Блок · Этаж · Элемент · Захватка · Объём · Единица · Начало · Окончание · КД (да/нет) · Готовность, %</b>. Пустые поля допустимы, обязательны работа и обе даты. Для КД даты совпадают. Даты: ДД.ММ.ГГГГ или ГГГГ-ММ-ДД.</p><textarea id="manualRows" rows="5" placeholder="Сваи&#9;Паркинг&#9;&#9;&#9;&#9;1&#9;120&#9;шт.&#9;19.10.2026&#9;15.11.2026&#9;нет&#9;0"></textarea><button class="btn primary" id="planningNewSchedule">Создать график из строк</button></details>`;}
  function assertEdit(){if(window.LIV_ACCESS?.canEdit===false)throw Error('Нет права изменять график.');if((project.scheduleStaging||[]).length)throw Error('Сначала завершите текущий тестовый импорт.');}
  async function createManual(){
    assertEdit();const name=el('manualName').value.trim(),role=el('manualRole').value,effectiveDate=P.date(el('manualDate').value),org=(project.organizations||[]).find(o=>o.id===el('manualOrganization').value);
    if(!name||!effectiveDate)throw Error('Укажите название графика и дату версии.');
    const id='SVER-'+crypto.randomUUID(),now=new Date().toISOString(),scheduleKey=role+'|'+name.toLowerCase();
    const rows=lines(el('manualRows').value);if(!rows.length)throw Error('Введите хотя бы одну работу.');
    const staged=rows.map((line,index)=>{const [title,building='',block='',floor='',element='',capture='',quantity='',unit='',a='',b='',kd='',progress='0']=line.split('\t'),start=P.date(a),finish=P.date(b),isMilestone=/^(да|1|кд)$/i.test(kd.trim());
      if(!title.trim()||!start||!finish||finish<start)throw Error('Строка '+(index+1)+': проверьте название и обе даты.');
      if(isMilestone&&start!==finish)throw Error('У КД начало и окончание должны совпадать.');
      if(quantity!==''&&(P.number(quantity)===null||P.number(quantity)<0))throw Error('Строка '+(index+1)+': неверный объём.');
      if(P.number(progress)===null||P.number(progress)<0||P.number(progress)>100)throw Error('Строка '+(index+1)+': готовность от 0 до 100.');
      const tid='TASK-'+crypto.randomUUID(),task={id:tid,versionId:id,sourceImportId:id,sourceTaskId:String(index+1),name:title.trim(),building,block,floor,element,capture,unit,isMilestone,progressPercent:Number(progress),organizationId:org?.id||'',organizationName:org?.name||'',role,scheduleKey,active:true,calendar:'7x0',durationAccepted:isMilestone?0:P.workingCount(start,finish,'7x0'),status:Number(progress)>=100?'Завершено':Number(progress)>0?'В работе':'Не начато'};
      task.logicalId=P.identity(task);
      return {task,dates:['working','baseline',...(role!=='working'?['contract']:[])].map(type=>({id:'TD-'+crypto.randomUUID(),taskId:tid,type,start,finish,createdAt:now})),quantities:quantity===''?[]:[{id:'TQ-'+crypto.randomUUID(),taskId:tid,quantityType:'primary',quantity:P.number(quantity),unit}],dependencies:[]};
    });
    const v={id,name,role,scheduleKey,effectiveDate,status:'Тест',versionNo:Math.max(0,...(project.scheduleVersions||[]).filter(v=>v.scheduleKey===scheduleKey).map(v=>v.versionNo||0))+1,createdAt:now,organizationId:org?.id||'',contractNo:el('manualContract').value.trim(),registerMilestones:el('manualRegisterKD').checked};
    if(new Set(staged.map(r=>r.task.logicalId)).size!==staged.length)throw Error('Повторяются одинаковые работы в одном месте. Уточните элемент или захватку.');
    await P.persist(project,()=>{for(const k of ['scheduleVersions','tasks','taskDates','taskQuantities','dependencies'])project[k]=project[k]||[];project.scheduleVersions.unshift(v);project.scheduleStaging=staged;P.accept(project,id);},()=>saveProject());state.right=id;state.task='';state.preview=null;state.critical=null;state.leveled=null;renderSchedule();
  }
  function taskEditor(task){if(!task)return '';const d=dates(task);return `<details><summary>Редактировать работу / добавить работу вручную</summary><div class="planning-grid">${[['Name','Работа',task.name],['Building','Здание',task.building],['Block','Блок',task.block],['Floor','Этаж',task.floor],['Element','Элемент',task.element],['Capture','Захватка',task.capture]].map(([id,label,v])=>`<label>${label}<input id="editTask${id}" value="${esc(v||'')}"></label>`).join('')}<label>Начало<input type="date" id="editTaskStart" value="${esc(d.start||'')}"></label><label>Окончание<input type="date" id="editTaskFinish" value="${esc(d.finish||'')}"></label><label>Готовность, %<input type="number" id="editTaskProgress" min="0" max="100" value="${Number(task.progressPercent)||0}"></label><label>Статус<select id="editTaskStatus">${['Не начато','В работе','Выполнено','Готово','Сдано','Завершено','СМР приостановлены'].map(v=>`<option ${task.status===v?'selected':''}>${v}</option>`).join('')}</select></label><label><input id="editTaskMilestone" type="checkbox" ${task.isMilestone?'checked':''}>Ключевая дата</label></div><p class="muted">Объём и единицу задайте в полях расчёта выше. Сохранение создаёт новую версию выбранной группы; предыдущая остаётся в истории. Исправление договорного графика сохраняет новую редакцию договорных дат.</p><button id="planningEditTask" class="btn">Сохранить изменение новой версией</button><button id="planningAddTask" class="btn">Добавить как новую работу</button></details>`;}
  async function editManualTask(add=false){
    assertEdit();readDraft();const old=project.scheduleVersions.find(v=>v.id===state.right),tasks=versionTasks(state.right),current=tasks.find(t=>t.id===state.task);
    const start=P.date(el('editTaskStart').value),finish=P.date(el('editTaskFinish').value),name=el('editTaskName').value.trim(),isMilestone=el('editTaskMilestone').checked,progress=P.number(el('editTaskProgress').value);
    if(!name||!start||!finish||finish<start||progress===null||progress<0||progress>100)throw Error('Проверьте название, обе даты и готовность.');
    if(isMilestone&&start!==finish)throw Error('У КД начало и окончание должны совпадать.');
    const edited={...current,name,building:el('editTaskBuilding').value,block:el('editTaskBlock').value,floor:el('editTaskFloor').value,element:el('editTaskElement').value,capture:el('editTaskCapture').value,status:el('editTaskStatus').value,isMilestone,progressPercent:progress,planning:structuredCopy(state.drafts[current.id]||{}),frontId:state.drafts[current.id]?.frontId||''};
    // When dates are explicitly edited, update manual duration as well.
    edited.planning.start=start;edited.planning.manual=isMilestone?0:P.workingCount(start,finish,calendarFor(edited.planning.calendar));
    if(add){edited.id='TASK-'+crypto.randomUUID();edited.logicalId=P.identity({...edited,frontId:null,logicalId:null});edited.parentTaskId='';edited.milestoneId='';}
    const id='SVER-'+crypto.randomUUID(),now=new Date().toISOString(),mapping=new Map([...tasks,...(add?[edited]:[])].map(t=>[t.id,'TASK-'+crypto.randomUUID()]));
    const v={...old,id,status:'Тест',isCurrent:false,isBaseline:false,registerMilestones:old.role!=='working'&&old.registerMilestones,versionNo:Math.max(0,...project.scheduleVersions.filter(v=>v.scheduleKey===old.scheduleKey).map(v=>v.versionNo||0))+1,effectiveDate:now.slice(0,10),createdAt:now,derivedFrom:old.id};
    const staged=[...tasks,...(add?[edited]:[])].map(t=>{
      const change=t.id===edited.id,source=change?edited:t,tid=mapping.get(t.id),ds=(project.taskDates||[]).filter(d=>d.taskId===(add&&change?current.id:t.id)).map(d=>({...d,id:'TD-'+crypto.randomUUID(),taskId:tid}));
      if(change){for(const d of ds.filter(d=>d.type==='working'||(v.role!=='working'&&d.type==='contract')))Object.assign(d,{start,finish,createdAt:now});}
      const input=change?edited.planning:t.planning,quantities=change&&P.number(input.total)!==null?[{id:'TQ-'+crypto.randomUUID(),taskId:tid,quantityType:'primary',quantity:P.number(input.total),unit:input.unit}]:(project.taskQuantities||[]).filter(q=>q.taskId===t.id).map(q=>({...q,id:'TQ-'+crypto.randomUUID(),taskId:tid}));
      return {task:{...source,id:tid,sourceTaskId:tid,versionId:id,sourceImportId:id,parentTaskId:mapping.get(source.parentTaskId)||'',durationAccepted:change?edited.planning.manual:t.durationAccepted},dates:ds,quantities,dependencies:dependenciesFor(tasks).filter(d=>d.successorTaskId===t.id).map(d=>({...d,id:'DEP-'+crypto.randomUUID(),versionId:id,predecessorTaskId:mapping.get(d.predecessorTaskId),successorTaskId:tid}))};
    });
    if(new Set(staged.map(x=>P.identity(x.task))).size!==staged.length)throw Error('Совпадает фронт или работа и место. Уточните привязку.');
    await P.persist(project,()=>{project.scheduleVersions.unshift(v);project.scheduleStaging=staged;P.accept(project,id);},()=>saveProject());state.right=id;state.task=mapping.get(edited.id);state.preview=null;state.critical=null;state.leveled=null;renderSchedule();
  }
  async function addManualTask(){return editManualTask(true);}
  async function pinBaseline(){assertEdit();await P.persist(project,()=>{for(const v of project.scheduleVersions)v.isBaseline=v.id===state.right;},()=>saveProject());state.left=state.right;render();}
  function filtered(tasks){const orgs=state.organizations?.length?state.organizations:state.organization?[state.organization]:[];return tasks.filter(t=>!orgs.length||orgs.includes(t.organizationId)||orgs.includes(t.organizationName));}
  function matrixControls(){const fields=[['place','Полное место'],['building','Здание'],['block','Блок'],['floor','Этаж'],['capture','Захватка'],['name','Работа'],['organization','Организация']];const select=(id,label,value,options)=>`<label>${label}<select id="${id}">${options.map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${l}</option>`).join('')}</select></label>`;return `<div class="planning-grid">${select('planningMatrixRow','Строки',state.matrixRow,fields)}${select('planningMatrixCol','Столбцы',state.matrixCol,fields)}${select('planningMatrixMetric','В ячейке',state.matrixMetric,[['progress','Готовность'],['forecast','Прогнозное окончание'],['delta','Отклонение окончания'],['volume','Факт / общий объём']])}</div><div class="planning-grid"><label>Сохранённое представление<select id="planningView"><option value="">Выберите</option>${(settings().views||[]).map(v=>`<option value="${esc(v.name)}">${esc(v.name)}</option>`).join('')}</select></label><label>Название представления<input id="planningViewName" placeholder="Еженедельный отчёт"></label></div><button id="planningViewSave" class="btn">Сохранить представление</button>`;}
  async function saveView(){assertEdit();const name=el('planningViewName').value.trim();if(!name)throw Error('Укажите название представления.');const config=Object.fromEntries(['matrixRow','matrixCol','matrixMetric','organization','organizations','method'].map(k=>[k,state[k]])),s=structuredCopy(settings());s.views=[...(s.views||[]).filter(v=>v.name!==name),{name,config}];await P.persist(project,()=>{project.planningSettings=s;},()=>saveProject());state.settings=s;render();}
  function gantt(tasks){
    const ds=tasks.flatMap(t=>[state.preview.get(t.id),dates(t)]),a=ds.map(d=>d.start).filter(Boolean).sort()[0],b=ds.map(d=>d.finish).filter(Boolean).sort().at(-1),span=Math.max(1,P.days(a,b)+1);
    const bar=(d,kind,label)=>!d?.start||!d?.finish?'':`<div class="planning-bar ${kind}" style="margin-left:${Math.max(0,P.days(a,d.start)/span*100)}%;width:${Math.max(.5,(P.days(d.start,d.finish)+1)/span*100)}%" title="${esc(label+': '+d.start+' — '+d.finish)}"></div>`;
    return `<section data-calculation-preview><h2>Гант: исходный график, прогноз и критический путь</h2><p>${a} — ${b}. Серый — исходный, синий — прогноз, красный — критические работы. Полосы показывают начало и окончание включительно.</p><div class="table-wrap"><table class="planning-gantt"><thead><tr><th>Работа</th><th>Начало</th><th>Окончание</th><th>Временная шкала</th></tr></thead><tbody>${filtered(tasks).map(t=>{const r=state.preview.get(t.id);return `<tr><td>${esc(t.name)}</td><td>${r.start}</td><td>${r.finish}</td><td class="planning-track">${bar(dates(t),'planning-base','Исходный')}${bar(r,state.critical?.results.get(t.id)?.isCritical?'planning-critical':'','Прогноз')}</td></tr>`;}).join('')}</tbody></table></div></section>`;
  }
  function resourcePanel(tasks){
    const load=P.resourceLoad(tasks,state.preview,state.leveled?.inputs||selectedInput,settings().capacities);
    const warnings=state.leveled?.warnings||[];
    return `<section data-calculation-preview><h2>Люди и техника: загрузка по дням</h2><p>Выравнивание — последовательное назначение по приоритетам, с сохранением связей. Это допустимый вариант, минимальная длительность проекта не гарантируется. Перенесено работ: ${state.leveled?.changes.length||0}.</p>${warnings.map(w=>'<p class="planning-late">'+esc(w)+'</p>').join('')}${!load.length?'<p>Назначьте работам общие группы ресурсов и их доступное количество.</p>':`<div class="table-wrap planning-load"><table><thead><tr><th>Дата</th><th>Группа</th><th>Требуется</th><th>Доступно</th><th>Перегрузка</th><th>Загрузка</th></tr></thead><tbody>${load.map(r=>`<tr class="${r.overload>0?'planning-late':''}"><td>${r.date}</td><td>${esc(r.pool)}</td><td>${fmt(r.used)}</td><td>${fmt(r.capacity)}</td><td>${fmt(r.overload)}</td><td><meter min="0" max="${Math.max(r.used,r.capacity||1)}" value="${r.used}"></meter></td></tr>`).join('')}</tbody></table></div>`}</section>`;
  }
  function taskStats(t){
    const q=(project.taskQuantities||[]).find(q=>q.taskId===t.id),input=state.drafts[t.id]||t.planning||{},total=P.number(q?.quantity??input.total),unit=q?.unit||input.unit||t.unit||'',d=dates(t),before=new Date(Date.parse(state.from||state.to)-86400000).toISOString().slice(0,10);
    const rows=t.frontId?window.LIV_FACT_SERIES.primaryRows(project,new Set([String(t.frontId)])):[],now=window.LIV_FACT_SERIES.series(rows,state.to),prev=window.LIV_FACT_SERIES.series(rows,before);
    const duplicates=t.frontId&&versionTasks(state.right).filter(x=>x.frontId===t.frontId&&!x.isSummary&&!x.isMilestone).length>1;
    const ambiguous=now.entries.some(r=>r.baseline&&r.date>=state.from);
    const actual=now.hasFacts&&!duplicates&&!ambiguous?now.actual-prev.actual:null,cumulative=now.hasFacts&&!duplicates?now.actual:null;
    const remaining=t.planning&&total!==null?Math.max(0,total-(P.number(t.planning.done)||0)):total,calendar=calendarFor(t.calendar),offset=t.planning?(P.number(t.planning.done)||0):0;
    const plan=P.volumePlan(remaining,d.start,d.finish,state.from,state.to,calendar),cumPlan=P.volumePlan(remaining,d.start,d.finish,d.start,state.to,calendar);
    return {id:t.id,total,unit,plan,actual,cumulative,cumPlan:cumPlan===null?null:offset+cumPlan,current:total>0&&cumulative!==null?Math.min(100,cumulative/total*100):null,previous:total>0&&prev.hasFacts&&!duplicates?Math.min(100,prev.actual/total*100):null,weight:P.number(input.weight)||1,note:duplicates?'Один фронт у нескольких работ: требуется распределение':ambiguous?'Начальная отсечка внутри периода':!now.hasFacts?'Факт не введён':''};
  }
  function analytics(tasks){
    tasks=filtered(tasks).filter(t=>!t.isSummary&&!t.isMilestone);const rows=tasks.map(t=>({t,...taskStats(t)}));
    const comparable=rows.filter(r=>r.plan!==null&&r.actual!==null),groups=new Map();for(const r of comparable){if(!groups.has(r.unit))groups.set(r.unit,{plan:0,actual:0,cumPlan:0,cumulative:0});const g=groups.get(r.unit);for(const k of ['plan','actual','cumPlan','cumulative'])g[k]+=r[k]||0;}
    let progress;try{progress=P.readiness(rows,state.method);}catch(e){progress={error:e.message};}
    const orgs=[...new Map(versionTasks(state.right).map(t=>[t.organizationId||t.organizationName||'',t.organizationName||'Без организации'])).entries()].filter(([id])=>id);
    return `<h2>Расширенная аналитика: объёмы и готовность</h2><div class="planning-grid"><label>С<input type="date" id="planningFrom" value="${esc(state.from)}"></label><label>По<input type="date" id="planningTo" value="${esc(state.to)}"></label><label>Организация<select id="planningOrganization" multiple size="4"><option value="">Все (или несколько с Ctrl)</option>${orgs.map(([id,name])=>`<option value="${esc(id)}" ${(state.organizations?.includes(id)||state.organization===id)?'selected':''}>${esc(name)}</option>`).join('')}</select></label><label>Общий процент<select id="planningMethod">${[['average','Среднее по работам'],['weighted','По весам работ'],['volume','По объёму (одинаковые единицы)']].map(([v,l])=>`<option value="${v}" ${state.method===v?'selected':''}>${l}</option>`).join('')}</select></label></div><p class="muted">План выбранной версии распределён равномерно по рабочим дням. Для прогноза распределяется остаток плюс исходная отсечка. Отсутствие факта не считается нулём. В итог объёмов входят только строки с сопоставимыми планом и фактом; единицы разделены. Готовность рассчитывается на конец периода, прирост — к дате перед его началом.</p><div class="planning-kpis"><span>Готовность<b>${fmt(progress.current)}%</b></span><span>Прирост за период<b>${fmt(progress.gain)} п.п.</b></span><span>Работ с историей для сравнения<b>${rows.filter(r=>r.current!==null&&r.previous!==null).length} / ${rows.length}</b></span></div>${progress.error?'<p>'+esc(progress.error)+'</p>':''}<div class="table-wrap"><table><thead><tr><th>Работа</th><th>Ед.</th><th>Общий объём</th><th>План за период</th><th>Факт за период</th><th>Факт − план</th><th>План накопительно</th><th>Факт накопительно</th><th>Готовность</th><th>Прирост, п.п.</th><th>Примечание</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.t.name+' · '+context(r.t))}</td><td>${esc(r.unit)}</td><td>${fmt(r.total)}</td><td>${fmt(r.plan)}</td><td>${fmt(r.actual)}</td><td>${r.actual!==null&&r.plan!==null?fmt(r.actual-r.plan):'—'}</td><td>${fmt(r.cumPlan)}</td><td>${fmt(r.cumulative)}</td><td>${fmt(r.current)}%</td><td>${r.current!==null&&r.previous!==null?fmt(r.current-r.previous):'—'}</td><td>${esc(r.note)}</td></tr>`).join('')}${[...groups].map(([unit,g])=>`<tr class="liv-total-row"><th>Итого сопоставимые строки</th><td>${esc(unit)}</td><td>—</td><td>${fmt(g.plan)}</td><td>${fmt(g.actual)}</td><td>${fmt(g.actual-g.plan)}</td><td>${fmt(g.cumPlan)}</td><td>${fmt(g.cumulative)}</td><td colspan="3"></td></tr>`).join('')}</tbody></table></div>`;
  }

  function factPanel(input){
    const front=(project.fronts||[]).find(f=>f.id===input.frontId);
    if(!front)return '<p class="muted">Для ввода факта выберите существующий фронт выше. Новый фронт можно завести вручную в основном журнале работ.</p>';
    const rows=window.LIV_FACT_SERIES.primaryRows(project,new Set([String(front.id)])).filter(r=>r.active!==false).sort((a,b)=>String(b.factDate||b.date).localeCompare(String(a.factDate||a.date)));
    return `<details><summary>Внести / исправить факт по связанному фронту</summary><div class="planning-grid"><label>Запись<select id="planningFactRecord"><option value="">Новая запись</option>${rows.map(r=>`<option value="${esc(r.id)}">${esc((r.factDate||r.date)+' · '+(r.factType==='cumulative_snapshot'?'Накопительно: '+r.cumulativeQty:'За день: '+(r.quantity??r.qty)))}</option>`).join('')}</select></label><label>Дата<input id="planningFactDate" type="date" value="${esc(input.asOf||new Date().toISOString().slice(0,10))}"></label><label>Тип<select id="planningFactType"><option value="quantity">Прирост за день</option><option value="cumulative_snapshot">Накопительный итог на конец дня</option></select></label><label>Объём, ${esc(front.unit||input.unit||'ед.')}<input id="planningFactQuantity" type="number" min="0" step="any"></label><label>Комментарий<input id="planningFactComment"></label></div><p class="muted">Для исправления выберите конкретную запись и задайте её новое значение. Предыдущее значение останется в истории. Если за день уже есть факт, дополнительную новую запись здесь создавать нельзя: исправьте прежнюю.</p><button id="planningFactSave" class="btn">Сохранить факт</button></details>`;
  }
  async function saveManualFact(){
    if(window.LIV_ACCESS?.canEdit===false)throw Error('Нет права изменять факт.');
    readDraft();const t=versionTasks(state.right).find(t=>t.id===state.task),input=selectedInput(t),front=(project.fronts||[]).find(f=>f.id===input.frontId),date=P.date(el('planningFactDate').value),qty=P.number(el('planningFactQuantity').value),type=el('planningFactType').value;
    if(!front||!date||qty===null||qty<0)throw Error('Выберите фронт и укажите корректные дату и объём.');
    const oldId=el('planningFactRecord').value,old=(project.progressFacts||[]).find(r=>r.id===oldId&&r.frontId===front.id);
    if(oldId&&!old)throw Error('Эта запись из старого журнала. Исправьте её в основном журнале факта.');
    if((project.progressFacts||[]).some(r=>r.id!==oldId&&r.frontId===front.id&&r.active!==false&&r.factDate===date))throw Error('На эту дату уже есть запись. Выберите её для исправления.');
    const now=new Date().toISOString(),id=old?.id||'FACT-'+crypto.randomUUID(),row={id,frontId:front.id,metricId:old?.metricId||'',factDate:date,factType:type,quantity:type==='quantity'?qty:null,cumulativeQty:type==='cumulative_snapshot'?qty:null,comment:el('planningFactComment').value.trim(),sourceFingerprint:old?.sourceFingerprint||'manual:'+id,createdAt:old?.createdAt||now,updatedAt:now,active:true};
    await P.persist(project,()=>{project.progressFacts=project.progressFacts||[];project.factLog=project.factLog||[];if(old)window.LIV_FACT_SERIES.replaceFact(project,old,row);else project.progressFacts.push(row);window.LIV_FACT_SERIES.refreshFront(project,front);},()=>saveProject());
    const result=window.LIV_FACT_SERIES.series(window.LIV_FACT_SERIES.primaryRows(project,new Set([String(front.id)])),input.asOf||date);
    state.drafts[t.id]={...state.drafts[t.id],done:result.actual};state.preview=null;state.critical=null;state.leveled=null;renderSchedule();
  }

  window.LIV_PLANNING_UI={render};
  document.addEventListener('DOMContentLoaded',render,{once:true});
})();
