'use strict';
/* Read-only timeline. Layout dates are UTC dates, independent of browser timezone. */
(function(){
  const P=window.LIV_PLANNING;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const next=(d,n=1)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
  const short=d=>P.date(d)?d.slice(8,10)+'.'+d.slice(5,7):'—';
  const full=d=>P.date(d)?short(d)+'.'+d.slice(0,4):'—';
  const signed=n=>n==null?'—':(n>0?'+':'')+n;
  const valid=r=>P.date(r?.start)&&P.date(r?.finish)&&r.finish>=r.start;
  const months=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const rowHeight=60,headerHeight=54,pageSize=100;
  function bucketEnd(day,scale){
    if(scale==='month')return new Date(Date.UTC(+day.slice(0,4),+day.slice(5,7),0)).toISOString().slice(0,10);
    if(scale==='week')return next(day,(7-new Date(day).getUTCDay())%7);
    return day;
  }
  function axis(from,to,requested='day'){
    if(!P.date(from)||!P.date(to)||to<from)throw Error('Укажите корректный период Ганта.');
    const span=P.days(from,to)+1;
    if(span>36600)throw Error('Период Ганта не должен превышать 100 лет.');
    let scale=['day','week','month'].includes(requested)?requested:'day';
    if(span>420&&scale==='day')scale='week';
    if(span>2800&&scale==='week')scale='month';
    const width=scale==='day'?42:scale==='week'?104:116,cells=[];
    for(let day=from;day<=to;){const finish=[bucketEnd(day,scale),to].sort()[0];cells.push({start:day,finish,x:cells.length*width,width});day=next(finish);}
    const x=(date,end=false)=>{
      if(date<from)return 0;if(date>to)return cells.length*width;
      // Binary search keeps dependency and resource geometry cheap on long projects.
      let lo=0,hi=cells.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(cells[mid].finish<date)lo=mid+1;else hi=mid;}
      const c=cells[lo];return c.x+(P.days(c.start,date)+(end?1:0))/(P.days(c.start,c.finish)+1)*width;
    };
    return {from,to,scale,requested,cells,width:cells.length*width,x};
  }
  function bounds(options,ui){
    const all=options.tasks.flatMap(t=>[options.base.get(t.id),options.before?.get(t.id),options.after.get(t.id)]).filter(valid);
    const from=all.map(r=>r.start).sort()[0],to=all.map(r=>r.finish).sort().at(-1);
    return {from:ui.from||from,to:ui.to||to};
  }
  function build(options,ui={}){
    const period=bounds(options,ui);if(!period.from||!period.to)return {empty:true};
    const a=axis(period.from,period.to,ui.scale),query=(ui.search||'').trim().toLocaleLowerCase('ru');
    const moved=new Map((options.changes||[]).map(c=>[c.id,c]));
    const context=t=>[t.building,t.block,t.floor!==''&&t.floor!=null?'Этаж '+t.floor:'',t.capture,t.organizationName].filter(Boolean).join(' · ');
    const all=options.tasks.filter(t=>(!query||(t.name+' '+context(t)).toLocaleLowerCase('ru').includes(query))&&(!ui.critical||!options.calculated||options.critical?.get(t.id)?.isCritical)&&(!ui.moved||!options.leveled||moved.has(t.id)));
    const pages=Math.max(1,Math.ceil(all.length/pageSize)),page=Math.max(0,Math.min(Number(ui.page)||0,pages-1)),rows=all.slice(page*pageSize,(page+1)*pageSize);
    const visible=new Set(rows.map(t=>t.id)),links=(options.dependencies||[]).filter(d=>visible.has(d.predecessorTaskId)&&visible.has(d.successorTaskId));
    const hiddenLinks=(options.dependencies||[]).filter(d=>visible.has(d.predecessorTaskId)!==visible.has(d.successorTaskId)).length;
    const pools=[...new Set([...(options.beforeLoad||[]),...(options.afterLoad||[])].map(r=>r.pool))].sort((a,b)=>a.localeCompare(b,'ru'));
    const pool=pools.includes(ui.pool)?ui.pool:pools[0]||'';
    return {axis:a,rows,total:all.length,page,pages,links,hiddenLinks,moved,context,pools,pool};
  }
  function linkGeometry(link,rows,results,a){
    const pi=rows.findIndex(t=>t.id===link.predecessorTaskId),si=rows.findIndex(t=>t.id===link.successorTaskId);
    const p=results.get(link.predecessorTaskId),s=results.get(link.successorTaskId);if(pi<0||si<0||!valid(p)||!valid(s))return null;
    const type=link.linkType||'FS',pStart=type==='SS'||type==='SF',sFinish=type==='FF'||type==='SF';
    const pd=pStart?p.start:p.finish,sd=sFinish?s.finish:s.start;
    if(pd<a.from||pd>a.to||sd<a.from||sd>a.to)return null;
    const x1=a.x(pd,!pStart),x2=a.x(sd,sFinish),y1=headerHeight+pi*rowHeight+34,y2=headerHeight+si*rowHeight+34;
    const exit=x1+(pStart?-10:10),entry=x2+(sFinish?10:-10),midY=(y1+y2)/2;
    return {type,x1,x2,y1,y2,path:`M ${x1} ${y1} H ${exit} V ${midY} H ${entry} V ${y2} H ${x2}`};
  }
  // Week/month bars are daily PEAKS, never sums or averages of headcounts.
  function aggregate(load,pool,a){
    const byDay=new Map(load.filter(r=>r.pool===pool).map(r=>[r.date,r]));
    return a.cells.map(c=>{let used=0,overload=0,known=false,capacity=null,peakDate='',tasks=[];
      for(let day=c.start;day<=c.finish;day=next(day)){const r=byDay.get(day);if(!r)continue;known=true;if(r.used>=used){used=r.used;peakDate=day;tasks=r.tasks||[];}if(r.capacity!=null)capacity=r.capacity;overload=Math.max(overload,r.overload||0);}
      return {...c,used,overload,capacity,known,peakDate,tasks};
    });
  }
  function timeline(options,ui,m,headerOnly=false){
    const a=m.axis,height=headerOnly?headerHeight:headerHeight+m.rows.length*rowHeight;
    const cells=a.cells.map(c=>{const weekend=a.scale==='day'&&[0,6].includes(new Date(c.start).getUTCDay()),holiday=a.scale==='day'&&(options.holidays||[]).includes(c.start),working=a.scale==='day'&&(options.workingDays||[]).includes(c.start);
      const label=a.scale==='day'?c.start.slice(8):a.scale==='week'?short(c.start)+'–'+short(c.finish):months[+c.start.slice(5,7)-1];
      return `<rect x="${c.x}" y="0" width="${c.width}" height="${height}" fill="${!working&&(weekend||holiday)?'#f6e9ea':'#fff'}"/><path d="M ${c.x} 0 V ${height}" stroke="#dce5ec"/><text x="${c.x+c.width/2}" y="20" text-anchor="middle" class="gantt-month">${esc(a.scale==='month'?c.start.slice(0,4):c.start.slice(5,7)+'.'+c.start.slice(0,4))}</text><text x="${c.x+c.width/2}" y="43" text-anchor="middle">${esc(label)}</text>`;
    }).join('');
    if(headerOnly){const report=P.date(options.asOf),mark=report&&report>=a.from&&report<=a.to?`<path d="M ${a.x(report)} 0 V ${headerHeight}" class="gantt-asof"/><text x="${a.x(report)+4}" y="31" class="gantt-asof-label">Отчёт</text>`:'';return `<svg class="gantt-timeline" width="${a.width}" height="${headerHeight}" aria-label="Календарная шкала">${cells}${mark}</svg>`;}
    const bar=(r,index,kind,t,label)=>{
      if(!valid(r)||r.finish<a.from||r.start>a.to)return '';
      const x=a.x(r.start),end=a.x(r.finish,true),y=headerHeight+index*rowHeight;
      const f=options.facts?.get(t.id),fact=f?' · факт '+(f.actual??'нет данных')+' / '+(f.total??'нет объёма')+' '+(f.volume?.unit||'')+'; остаток '+(f.remaining??'нет данных'):'';
      const title=esc(t.name+' · '+label+': '+full(r.start)+' — '+full(r.finish)+fact);
      const shape=t.isMilestone?`<path d="M ${x+5} ${y+24} l 9 10 l -9 10 l -9 -10 Z"/>`:`<rect x="${x}" y="${y+(kind==='base'?9:kind==='before'?21:27)}" width="${Math.max(2,end-x)}" height="${kind==='base'?5:kind==='before'?6:16}" rx="3"/>`;
      return `<g class="gantt-bar gantt-${kind}${options.critical?.get(t.id)?.isCritical&&kind==='after'?' gantt-critical':''}${kind==='after'&&m.moved.has(t.id)?' gantt-moved':''}" data-gantt-task="${esc(t.id)}" tabindex="0" role="button" aria-label="${title}"><title>${title}</title>${shape}</g>`;
    };
    const bars=m.rows.map((t,i)=>`${ui.baseline!==false?bar(options.base.get(t.id),i,'base',t,'Сохранённая версия'):''}${ui.compare!==false&&options.leveled?bar(options.before.get(t.id),i,'before',t,'До выравнивания'):''}${bar(options.after.get(t.id),i,'after',t,options.leveled?'После выравнивания':options.calculated?'Прогноз':'Сохранённая версия')}<path d="M 0 ${headerHeight+(i+1)*rowHeight} H ${a.width}" stroke="#e7edf2"/>`).join('');
    const names=new Map(m.rows.map(t=>[t.id,t.name]));
    const links=ui.links===false?'':m.links.slice(0,1500).map(d=>{const g=linkGeometry(d,m.rows,options.after,a);return !g?'':`<path class="gantt-link" d="${g.path}" marker-end="url(#livGanttArrow)"><title>${esc(names.get(d.predecessorTaskId)+' → '+names.get(d.successorTaskId)+' · '+({'FS':'Окончание → начало','SS':'Начало → начало','FF':'Окончание → окончание','SF':'Начало → окончание'}[g.type]||g.type)+' · лаг '+(d.lagDays||0)+' раб. дн.')}</title></path>`;}).join('');
    const marker=P.date(options.asOf),today=marker&&marker>=a.from&&marker<=a.to?`<path d="M ${a.x(marker)} 0 V ${height}" class="gantt-asof"/><text x="${a.x(marker)+4}" y="${headerHeight-5}" class="gantt-asof-label">Отчёт</text>`:'';
    return `<svg class="gantt-timeline" width="${a.width}" height="${height}" viewBox="0 0 ${a.width} ${height}" role="group" aria-label="Гант, ${full(a.from)} — ${full(a.to)}"><defs><marker id="livGanttArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#536579"/></marker></defs>${cells}${bars}${links}${today}</svg>`;
  }
  function resourceChart(load,pool,a,capacity,title){
    const data=aggregate(load,pool,a),max=Math.max(1,capacity||0,...data.map(r=>r.used)),height=138,plot=90,top=15,y=n=>top+plot-n/max*plot;
    const bars=data.map(c=>{const cap=c.capacity??capacity,over=cap!=null&&c.used>cap,tip=esc(`${full(c.start)} — ${full(c.finish)}: пик ${c.used}; доступно ${cap??'не задано'}${c.peakDate?'; дата пика '+full(c.peakDate):''}`);
      return `<path d="M ${c.x} 0 V ${height}" stroke="#e7edf2"/><rect class="gantt-resource-bar" x="${c.x+3}" y="${y(c.used)}" width="${Math.max(1,c.width-6)}" height="${c.used/max*plot}" fill="${over?'#c64655':'#25839b'}"><title>${tip}</title></rect>${over?`<rect x="${c.x+3}" y="${y(c.used)}" width="${Math.max(1,c.width-6)}" height="${(c.used-cap)/max*plot}" fill="#b83246"><title>${tip}</title></rect>`:''}<text x="${c.x+c.width/2}" y="${height-8}" text-anchor="middle">${esc(a.scale==='month'?c.start.slice(5,7)+'.'+c.start.slice(0,4):short(c.start))}</text>`;
    }).join('');
    const line=capacity==null?'':`<path d="M 0 ${y(capacity)} H ${a.width}" stroke="#b83246" stroke-dasharray="5 4"/><text x="8" y="${Math.max(11,y(capacity)-4)}" class="gantt-capacity-label">Доступно: ${capacity}</text>`;
    return `<div class="gantt-resource-row"><div class="gantt-fixed"><strong>${esc(title)}</strong><small>${esc(pool)}<br>Пик: ${Math.max(0,...data.map(r=>r.used))}<br>${capacity==null?'Лимит не задан':'Доступно: '+capacity}</small></div><svg width="${a.width}" height="${height}" role="img" aria-label="${esc(title+' · '+pool)}">${bars}${line}</svg></div>`;
  }
  function impact(options){
    if(!options.leveled)return '';
    const before=new Map((options.kdBefore||[]).map(m=>[m.id,m]));
    const rows=(options.kdAfter||[]).map(m=>({m,b:before.get(m.id)}));
    return `<details class="gantt-impacts" open><summary>Влияние выравнивания на КД</summary><p>Полный график, включая работы вне фильтра. «Из-за выравнивания» — разница двух расчётов с одинаковыми исходными условиями; отклонение от договора показано отдельно.</p>${!rows.length?'<p>Связанные КД не заданы. Отсутствие связей не означает отсутствие риска.</p>':`<div class="table-wrap"><table><thead><tr><th>КД</th><th>Договор</th><th>До выравнивания</th><th>После</th><th>Из-за выравнивания, кал. дн.</th><th>К договору после, кал. дн.</th><th>Определяющие работы после</th></tr></thead><tbody>${rows.map(({m,b})=>`<tr><td>${esc(m.title)}</td><td>${full(m.contractDate)}</td><td>${full(b?.finish)}</td><td>${full(m.finish)}</td><td>${signed(P.days(b?.finish,m.finish))}</td><td class="${m.delta>0?'planning-late':''}">${signed(m.delta)}</td><td>${esc(m.determining.join(', '))}</td></tr>`).join('')}</tbody></table></div>`}</details>`;
  }
  function render(options,ui={}){
    const m=build(options,ui);if(m.empty)return '<p>Для Ганта нужны корректные даты работ.</p>';
    const a=m.axis,control=(key,label,value,type='checkbox')=>`<label>${type==='checkbox'?`<input type="checkbox" data-gantt-control="${key}" ${value?'checked':''}>${label}`:`${label}<input type="${type}" data-gantt-control="${key}" value="${esc(value)}">`}</label>`;
    const label=options.leveled?'После выравнивания':options.calculated?'Прогноз':'Сохранённая версия';
    const names=m.rows.map(t=>{const r=options.after.get(t.id),c=m.moved.get(t.id),delta=c?P.days(c.before.finish,c.after.finish):null;return `<div class="gantt-name-row ${options.selected===t.id?'gantt-selected':''}"><button type="button" class="gantt-task-button" data-gantt-task="${esc(t.id)}" title="Открыть работу: ${esc(t.name)}">${esc(t.name)}</button><small>${esc(m.context(t))}${options.facts?.has(t.id)?' · факт '+esc(options.facts.get(t.id).actual??'—')+' / '+esc(options.facts.get(t.id).total??'—')+' '+esc(options.facts.get(t.id).volume?.unit||''):''}</small><small>${full(r?.start)} — ${full(r?.finish)}${c?' · окончание '+signed(delta)+' кал. дн.':''}${options.critical?.get(t.id)?.isCritical?' · критическая':''}</small></div>`;}).join('');
    const capacities=options.capacities||{},capacity=Object.hasOwn(capacities,m.pool)?P.number(capacities[m.pool]):null;
    const charts=!m.pool?'<p class="gantt-no-load">Для загрузки назначьте работам общие группы ресурсов. Отсутствие назначений не означает нулевую потребность.</p>':(options.leveled&&ui.compare!==false?resourceChart(options.beforeLoad||[],m.pool,a,capacity,'До выравнивания'):'')+resourceChart(options.afterLoad||[],m.pool,a,capacity,options.leveled?'После выравнивания':'Плановая загрузка');
    const changed=(options.changes||[]).map(c=>({c,t:(options.allTasks||options.tasks).find(t=>t.id===c.id)}));
    const changes=options.leveled?`<details><summary>Переносы работ: ${changed.length} по всему графику</summary><div class="table-wrap"><table><thead><tr><th>Работа</th><th>Начало до → после</th><th>Окончание до → после</th><th>Сдвиг окончания, кал. дн.</th></tr></thead><tbody>${changed.map(({c,t})=>`<tr><td>${esc(t?.name||c.id)}</td><td>${full(c.before.start)} → ${full(c.after.start)}</td><td>${full(c.before.finish)} → ${full(c.after.finish)}</td><td>${signed(P.days(c.before.finish,c.after.finish))}</td></tr>`).join('')}</tbody></table></div></details>`:'';
    return `<h2>Гант и загрузка ресурсов</h2><p>${esc(options.versionLabel||'')}. ${label}. ${options.calculated?'Предварительный расчёт; принятие выполняется кнопкой сохранения рабочей версии.':'Показаны сроки сохранённой версии; прогноз и критический путь рассчитываются отдельно.'}</p>
      <div class="gantt-toolbar"><label>Масштаб<select data-gantt-control="scale">${[['day','День'],['week','Неделя'],['month','Месяц']].map(([k,l])=>`<option value="${k}" ${(ui.scale||'day')===k?'selected':''}>${l}</option>`).join('')}</select></label>${control('from','С',a.from,'date')}${control('to','По',a.to,'date')}<button type="button" class="btn" data-gantt-action="fit">Весь график</button><button type="button" class="btn" data-gantt-action="today">К отчётной дате</button><label>Поиск работы / места<input type="search" data-gantt-control="search" value="${esc(ui.search||'')}"></label><label>Ресурс<select data-gantt-control="pool">${m.pools.map(p=>`<option value="${esc(p)}" ${p===m.pool?'selected':''}>${esc(p)}</option>`).join('')||'<option value="">Нет назначений</option>'}</select></label></div>
      <div class="gantt-toolbar gantt-toggles">${control('baseline','Сохранённая версия',ui.baseline!==false)}${control('links','Связи',ui.links!==false)}${options.leveled?control('compare','До / после выравнивания',ui.compare!==false)+control('moved','Только перенесённые',ui.moved):''}${options.calculated?control('critical','Только критические',ui.critical):''}</div>
      <p class="gantt-legend"><span class="gantt-key base">Сохранённая версия</span>${options.leveled?'<span class="gantt-key before">До выравнивания</span>':''}<span class="gantt-key after">${label}</span>${options.calculated?'<span class="gantt-key critical">Критическая</span>':''}${options.leveled?'<span class="gantt-key moved">Перенесена выравниванием</span>':''}</p>
      <p class="muted">Выходные и общие нерабочие даты выделены в масштабе «День»; календари отдельных работ могут отличаться. Ресурс — назначенная потребность полного графика, включая работы вне поиска и фильтров, не фактическая явка. На неделях и месяцах показан дневной максимум, без суммирования людей и техники.</p>
      ${a.scale!==a.requested&&a.requested?'<p role="status">Для длинного периода автоматически выбран более крупный масштаб.</p>':''}${options.resourceError?'<p class="planning-late">Загрузка не рассчитана: '+esc(options.resourceError)+'</p>':''}
      <div class="gantt-scroll" tabindex="0" aria-label="Гант и ресурсы, общая прокрутка"><div class="gantt-canvas" style="width:${300+a.width}px"><div class="gantt-axis-header"><div class="gantt-fixed gantt-name-header">Работа / сроки / сдвиг</div>${timeline(options,ui,m,true)}</div><div class="gantt-chart-row"><div class="gantt-fixed gantt-names"><div class="gantt-name-header">Работа / сроки / сдвиг</div>${names||'<p>Нет работ по выбранным фильтрам.</p>'}</div>${timeline(options,ui,m)}</div>${charts}</div></div>
      <div class="gantt-toolbar"><span>Показано ${m.rows.length} из ${m.total} работ. Страница ${m.page+1} из ${m.pages}.</span><button type="button" class="btn" data-gantt-action="previous" ${m.page===0?'disabled':''}>Предыдущие</button><button type="button" class="btn" data-gantt-action="next" ${m.page+1===m.pages?'disabled':''}>Следующие</button></div>
      ${m.hiddenLinks?'<p>Связей с работами вне страницы или фильтра: '+m.hiddenLinks+'. Они остаются в расчёте.</p>':''}${m.links.length>1500?'<p>На экране показаны первые 1500 связей. Уточните фильтр.</p>':''}
      ${options.leveled?'<p>Выравнивание выполняется по приоритетам и связям; минимальная длительность не гарантируется. Критичность и резервы после выравнивания относятся к технологическим связям.</p>':''}
      ${(options.warnings||[]).map(w=>'<p class="planning-late">'+esc(w)+'</p>').join('')}${changes}${impact(options)}
      <details><summary>Числа загрузки по дням — выбранный ресурс</summary><p>Включён весь расчётный график, независимо от поиска и фильтра работ. Период соответствует шкале Ганта.</p><div class="table-wrap planning-load"><table><thead><tr><th>Дата</th><th>До</th><th>${options.leveled?'После':'Потребность'}</th><th>Доступно</th><th>Перегрузка после</th></tr></thead><tbody>${dailyRows(options,m).slice(0,500).map(r=>`<tr><td>${full(r.date)}</td><td>${r.before??'—'}</td><td>${r.after}</td><td>${r.capacity??'—'}</td><td>${r.overload??'—'}</td></tr>`).join('')}</tbody></table></div>${dailyRows(options,m).length>500?'<p>Показаны первые 500 дней с назначениями. Сузьте период для остальных.</p>':''}</details>`;
  }
  function dailyRows(options,m){
    const rows=new Map();for(const [kind,load] of [['before',options.beforeLoad||[]],['after',options.afterLoad||[]]])for(const r of load.filter(r=>r.pool===m.pool&&r.date>=m.axis.from&&r.date<=m.axis.to)){if(!rows.has(r.date))rows.set(r.date,{date:r.date,before:options.leveled?0:null,after:0,capacity:r.capacity,overload:r.capacity==null?null:0});Object.assign(rows.get(r.date),{[kind]:r.used,...(kind==='after'?{capacity:r.capacity,overload:r.overload}:{})});}
    return [...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  function mount(root,options,ui,onSelect){
    if(!root)return;
    function refresh(focusKey){const scroller=root.querySelector('.gantt-scroll'),left=scroller?.scrollLeft||0,top=scroller?.scrollTop||0;let caret=null;const active=root.querySelector('[data-gantt-control="search"]');if(focusKey==='search')caret=active?.selectionStart;try{root.innerHTML=render(options,ui);}catch(e){const p=root.querySelector('[data-gantt-error]')||document.createElement('p');p.dataset.ganttError='';p.textContent=e.message;p.setAttribute('role','alert');root.prepend(p);return;}const s=root.querySelector('.gantt-scroll');if(s){s.scrollLeft=left;s.scrollTop=top;}if(focusKey){const e=root.querySelector('[data-gantt-control="'+focusKey+'"]');e?.focus();if(caret!=null)e?.setSelectionRange?.(caret,caret);}}
    root.addEventListener('input',e=>{e.stopPropagation();if(e.target.dataset.ganttControl==='search'){ui.search=e.target.value;ui.page=0;refresh('search');}});
    root.addEventListener('change',e=>{e.stopPropagation();const key=e.target.dataset.ganttControl;if(!key||key==='search')return;ui[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;if(!['pool','baseline','links','compare'].includes(key))ui.page=0;refresh(key);});
    const choose=e=>{const task=e.target.closest('[data-gantt-task]');if(task){onSelect?.(task.dataset.ganttTask);return;}const action=e.target.closest('[data-gantt-action]')?.dataset.ganttAction;if(!action)return;if(action==='fit'){delete ui.from;delete ui.to;ui.page=0;refresh();}if(action==='next'||action==='previous'){ui.page=build(options,ui).page+(action==='next'?1:-1);refresh();}if(action==='today'){const m=build(options,ui),s=root.querySelector('.gantt-scroll');if(s)s.scrollLeft=Math.max(0,m.axis.x(options.asOf)-100);}};
    root.addEventListener('click',e=>{e.stopPropagation();choose(e);});
    root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('g[data-gantt-task]')){e.preventDefault();e.stopPropagation();choose(e);}});
    root.innerHTML=render(options,ui);
  }
  window.LIV_GANTT={axis,build,linkGeometry,aggregate,render,mount};
})();
