'use strict';
/* Shared, project-scoped reconciliation. Reading a file never changes dictionaries. */
(function () {
  const text=v=>String(v??'').trim(), copy=v=>JSON.parse(JSON.stringify(v));
  const norm=v=>text(v).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[«»"“”]/g,'').replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim();
  const unit=v=>{const k=norm(v).replace(/\s|\.$/g,'');return /^[мm][3³]$/.test(k)?'м³':/^[мm][2²]$/.test(k)?'м²':k==='шт'?'шт.':text(v);};
  const definitions={building:['buildings','Здание / сооружение','BLD'],organization:['organizations','Подрядчик','ORG'],workKind:['workKinds','Вид работ','WK'],work:['works','Наименование работы','WRK']};
  const placeFields=['block','floor','capture','axis','side','zone','roomNo','roomName','elevation','element'];
  const id=prefix=>prefix+'-'+crypto.randomUUID();
  function list(p,type){return type==='workKind'&&window.LIV_WORK_CATALOG?window.LIV_WORK_CATALOG.kinds(p).map(row=>(p.workKinds||[]).some(k=>k.id===row.id)?row:copy(row)):p[definitions[type][0]]||[];}
  const buildingKey=v=>['паркинг','многоуровневый паркинг'].includes(norm(v))?'многоуровневый паркинг':norm(v);
  function match(p,type,name){
    if(!text(name))return {kind:'empty',item:null,candidates:[]};
    const equal=(a,b)=>type==='building'?buildingKey(a)===buildingKey(b):norm(a)===norm(b);
    const rows=list(p,type), mappings=(p.sourceMappings||[]).filter(x=>x.targetEntityType===type&&x.decision==='confirmed'&&norm(x.sourceValue)===norm(name));
    const ids=new Set(mappings.map(x=>String(x.targetLocalId||x.targetEntityId)));
    const mapped=rows.filter(x=>ids.has(String(x.id)));
    if(mapped.length===1)return {kind:mapped[0].active===false?'inactive':'exact',item:mapped[0],candidates:mapped};
    const hits=rows.filter(x=>equal(x.name,name)||(x.aliases||[]).some(a=>equal(a,name))||ids.has(String(x.id)));
    if(hits.length===1)return {kind:hits[0].active===false?'inactive':'exact',item:hits[0],candidates:hits};
    if(hits.length>1)return {kind:'ambiguous',item:null,candidates:hits};
    const tokens=new Set(norm(name).split(/[^а-яa-z0-9]+/).filter(x=>x.length>2));
    const candidates=rows.filter(x=>norm(x.name).split(/[^а-яa-z0-9]+/).some(t=>tokens.has(t)));
    return {kind:candidates.length?'suggest':'new',item:null,candidates};
  }
  function prepare(p,records){
    const entries=[],seen=new Map();
    for(const record of records)for(const type of Object.keys(definitions)){
      const name=text(record[type]);if(!name)continue;
      const key=type+'|'+norm(name);let entry=seen.get(key);
      if(!entry){const found=match(p,type,name);entry={key,type,name,found,units:[],kinds:[],inns:[],requiresUnit:false};seen.set(key,entry);entries.push(entry);}
      if(type==='work'&&record.requiresUnit)entry.requiresUnit=true;
      for(const [field,value] of [['units',type==='work'?unit(record.unit):''],['kinds',type==='work'?text(record.workKind):''],['inns',type==='organization'?text(record.organizationInn):'']])if(value&&!entry[field].some(x=>norm(x)===norm(value)))entry[field].push(value);
    }
    for(const entry of entries)if(entry.type==='organization'&&entry.inns.length===1){const found=(p.organizations||[]).filter(x=>x.inn===entry.inns[0]);if(found.length===1)entry.found={kind:found[0].active===false?'inactive':'exact',item:found[0],candidates:found};}
    return {entries,records:copy(records)};
  }
  function defaultDecisions(plan){return Object.fromEntries(plan.entries.map(e=>[e.key,{target:e.found.kind==='exact'?e.found.item.id:['new'].includes(e.found.kind)?'new':'',name:e.type==='building'&&norm(e.name)==='паркинг'?'Многоуровневый паркинг':e.name}]));}
  function ensure(p,type,name,extra={}){
    if(!text(name))return null;
    const found=match(p,type,name);if(found.kind==='ambiguous')throw Error('Неоднозначное название: '+name+'. Выполните сопоставление.');
    if(found.item){if(found.item.active===false)throw Error('Запись неактивна: '+name+'. Подтвердите восстановление при импорте.');return found.item;}
    const row={id:id(definitions[type][2]),name:type==='building'&&norm(name)==='паркинг'?'Многоуровневый паркинг':text(name),active:true,...extra};p[definitions[type][0]]=p[definitions[type][0]]||[];p[definitions[type][0]].push(row);return row;
  }
  function apply(p,plan,decisions){
    const resolved=new Map();
    for(const type of ['building','organization','workKind','work'])for(const entry of plan.entries.filter(e=>e.type===type)){
      const choice=decisions[entry.key];if(!choice?.target)throw Error('Выберите соответствие: '+entry.name);
      if(entry.units.length>1)throw Error('Разные единицы у работы «'+entry.name+'». Разделите показатели или исправьте единицы в файле.');
      if(entry.kinds.length>1)throw Error('Разные виды работ у «'+entry.name+'». Уточните исходные данные.');
      if(entry.inns.length>1)throw Error('Разные ИНН у «'+entry.name+'». Уточните организации.');
      let row;
      if(choice.target==='new'){
        const name=text(choice.name);if(!name)throw Error('Введите название: '+entry.name);
        const found=match(p,type,name);if(found.kind==='ambiguous')throw Error('В справочнике несколько записей «'+name+'». Выберите конкретную.');
        row=found.item;if(row?.active===false)throw Error('Выберите восстановление неактивной записи «'+name+'».');
        if(!row)row=ensure(p,type,name);
      }else row=list(p,type).find(x=>String(x.id)===String(choice.target));
      if(!row)throw Error('Соответствие больше не существует: '+entry.name);
      if(type==='organization'&&entry.inns[0]){
        const inn=entry.inns[0];if(!/^\d{10}(\d{2})?$/.test(inn))throw Error('Некорректный ИНН: '+entry.name);
        if(row.inn&&row.inn!==inn)throw Error('ИНН не совпадает: '+entry.name);
        if((p.organizations||[]).some(x=>x.id!==row.id&&x.inn===inn))throw Error('Этот ИНН уже есть у другой организации. Выберите её.');
        row.inn=inn;
      }
      if(type==='work'){
        const value=unit(choice.unit||entry.units[0]||row.unit);if(entry.units[0]&&value!==unit(entry.units[0]))throw Error('Единица из колонки отличается от выбранной для '+entry.name+'. Исправьте колонку или сопоставление.');if(entry.requiresUnit&&!value)throw Error('Укажите единицу объёма работы «'+entry.name+'». Название колонки не определяет единицу.');if(value&&row.unit&&unit(row.unit)!==value)throw Error('Единицы работы «'+row.name+'» различаются: '+row.unit+' / '+value);
        if(value&&!row.unit)row.unit=value;
        const group=entry.kinds[0]&&resolved.get('workKind|'+norm(entry.kinds[0]));
        if(group&&row.workKindId&&row.workKindId!==group.id)throw Error('У работы «'+row.name+'» уже другой вид работ.');
        if(group)row.workKindId=group.id;
      }
      row.active=true;row.aliases=row.aliases||[];
      if(norm(row.name)!==norm(entry.name)&&!row.aliases.some(a=>norm(a)===norm(entry.name)))row.aliases.push(entry.name);
      // Virtual default kinds must become durable when referenced.
      const collection=definitions[type][0];p[collection]=p[collection]||[];if(!p[collection].some(x=>x.id===row.id))p[collection].push(row);
      if(['building','organization','work'].includes(type)){
        p.sourceMappings=p.sourceMappings||[];
        for(const m of p.sourceMappings)if(m.targetEntityType===type&&norm(m.sourceValue)===norm(entry.name)){m.decision='confirmed';m.targetLocalId=row.id;}
        if(!p.sourceMappings.some(m=>m.targetEntityType===type&&norm(m.sourceValue)===norm(entry.name)))p.sourceMappings.push({id:id('MAP'),sourceName:'Сквозной импорт',sourceValue:entry.name,sourceEntityType:type,targetEntityType:type,targetLocalId:row.id,decision:'confirmed',confidence:1});
      }
      resolved.set(entry.key,row);
    }
    return resolved;
  }
  function validate(p,plan,decisions){apply(copy(p),plan,decisions);}
  function placePart(field,value){let v=norm(value);if(field==='elevation'){v=v.replace(/^отм\.?\s*/,'').replace(',','.');if(/^[+-]?\d+(?:\.\d+)?$/.test(v))return String(Number(v));}if(field==='block')v=v.replace(/^блок\s*/,'');if(field==='floor')v=v.replace(/^этаж\s*/,'');if(field==='capture')v=v.replace(/^захватка\s*/,'');if(field==='axis')v=v.replace(/\s/g,'');return v;}
  const placeKey=(buildingId,data)=>[norm(buildingId),...placeFields.map(k=>placePart(k,data[k]??data.customData?.[k]??''))].join('|');
  function place(p,buildingId,data){
    if(!buildingId&&!placeFields.some(k=>text(data[k])))return null;
    const key=placeKey(buildingId,data);p.structures=p.structures||[];
    const hits=p.structures.filter(s=>placeKey(s.buildingId,s)===key);
    if(hits.length>1)throw Error('Найдено несколько одинаковых мест выполнения. Уточните справочник мест.');
    if(hits[0]){hits[0].active=true;return hits[0];}
    const row={id:id('STR'),buildingId,...Object.fromEntries(placeFields.map(k=>[k,text(data[k])])),active:true,createdAt:new Date().toISOString()};
    row.signature='catalog-place|'+key;row.customData={elevation:row.elevation,element:row.element};
    p.structures.push(row);return row;
  }
  function findFront(p,data){
    const b=match(p,'building',data.building),w=match(p,'work',data.work);
    if(!b.item||!w.item)return null;
    const hits=(p.fronts||[]).filter(f=>f.active!==false&&f.buildingId===b.item.id&&f.workId===w.item.id&&placeKey(f.buildingId,(p.structures||[]).find(s=>s.id===f.structureId)||f)===placeKey(b.item.id,data)&&(!unit(data.unit)||!unit(f.unit)||unit(data.unit)===unit(f.unit)));
    if(hits.length>1)throw Error('Несколько работ в одном месте: '+data.work+'. Уточните единицу и место.');
    return hits[0]||null;
  }
  function front(p,data,{create=true}={}){
    const old=findFront(p,data);if(old){if(!old.unit)old.unit=unit(data.unit||(p.works||[]).find(w=>w.id===old.workId)?.unit);return old;}
    if(!create||!text(data.building)||!text(data.work))return null;
    const b=ensure(p,'building',data.building),w=ensure(p,'work',data.work),org=ensure(p,'organization',data.organization),s=place(p,b.id,data);
    const row={id:id('FR'),buildingId:b.id,workId:w.id,structureId:s.id,organizationId:org?.id||'',unit:unit(data.unit||w.unit),totalQty:null,active:true,status:'Не начато',createdAt:new Date().toISOString()};
    p.fronts=p.fronts||[];p.fronts.push(row);return row;
  }
  function attachSchedule(p,staged,version){
    const candidates=[];
    for(const item of staged){const t=item.task,b=match(p,'building',t.building).item,o=match(p,'organization',t.organizationName).item||(p.organizations||[]).find(o=>o.id===version.organizationId);
      if(b){t.buildingId=b.id;t.building=b.name;}if(o)t.organizationId=o.id;
      if(t.isSummary||t.isMilestone)continue;
      const w=match(p,'work',t.name).item;if(!w)continue;t.workId=w.id;t.workKindId=w.workKindId||'';
      const data={...t,work:w.name,organization:o?.name||'',unit:unit(t.unit||w.unit)};
      if(data.unit){t.unit=data.unit;for(const q of item.quantities||[])if(!q.unit)q.unit=data.unit;}
      if([t.network,t.segment].some(text)){t.linkWarning='Уточните место для сети / участка / конструкции и свяжите задачу с фронтом вручную';continue;}
      if(b)candidates.push({item,data,key:placeKey(b.id,data)+'|'+w.id+'|'+unit(data.unit)});
    }
    for(const {item,data,key} of candidates){const t=item.task;
      if(candidates.filter(c=>c.key===key).length>1){t.linkWarning='Несколько задач в одном месте: сопоставьте объёмы вручную';continue;}
      const previousKey=window.LIV_PLANNING_DOMAIN?.quantityKey(t);
      if((p.quantityBaselines||[]).some(q=>q.key===previousKey)||(p.quantityChanges||[]).some(q=>q.key===previousKey))continue;
      const existing=findFront(p,data),q=item.quantities?.[0]?.quantity,number=window.LIV_PLANNING.number;
      if(existing){const total=window.LIV_PLANNING_DOMAIN?.volumeAt(p,{frontId:existing.id,id:existing.id},version.effectiveDate)?.total;
        if(number(q)!==null&&number(total)!==null&&number(q)!==number(total)){t.linkWarning='Объём графика отличается от ведомости: требуется согласование';continue;}}
      const f=existing||front(p,data);if(!f)continue;t.frontId=f.id;t.planning={...t.planning,frontId:f.id};
    }
  }
  function finalizeSchedule(p,tasks){
    const D=window.LIV_PLANNING_DOMAIN;if(!D)return;
    for(const t of tasks){if(!t.frontId||t.isSummary||t.isMilestone)continue;
      const q=(p.taskQuantities||[]).find(q=>q.taskId===t.id);if(window.LIV_PLANNING.number(q?.quantity)===null)continue;
      const key=D.quantityKey(t);p.quantityBaselines=p.quantityBaselines||[];
      if(!p.quantityBaselines.some(b=>b.key===key))p.quantityBaselines.push(copy(D.seed(p,t)));
      D.refreshFront(p,t);
    }
  }
  function sameFact(rows,incoming){
    const keys=['frontId','metricId','organizationId','factDate','factType','externalRecordId','elementType','elementNo','groupCode',incoming.factType==='cumulative_snapshot'?'cumulativeQty':'quantity'];
    return (rows||[]).find(x=>x.active!==false&&keys.every(k=>norm(x[k])===norm(incoming[k]))&&norm(x.comment)===norm(incoming.comment));
  }
  function resourceKey(r,p={}){const f=(p.fronts||[]).find(f=>f.id===r.frontId),s=(p.structures||[]).find(s=>s.id===(r.structureId||f?.structureId));return ['date','organizationId','buildingId','workId','specialization','equipmentType','externalRecordId'].map(k=>norm(r[k])).join('|')+'|'+placeKey(r.buildingId,s||f||{});}
  function reconcileResource(p,row){
    for(const other of p.resources||[]){
      if(other.active===false||other.date!==row.date||other.organizationId!==row.organizationId)continue;
      const sameCategory=['itr','workers','mechanizers'].some(k=>Number(other[k])>0&&Number(row[k])>0)||other.equipmentType&&norm(other.equipmentType)===norm(row.equipmentType)&&Number(other.equipmentQty)>0&&Number(row.equipmentQty)>0;
      const common=['buildingId','workId'].every(k=>!other[k]||!row[k]||other[k]===row[k]);
      const differentLevel=['buildingId','workId'].some(k=>Boolean(other[k])!==Boolean(row[k]));
      if(sameCategory&&common&&differentLevel&&(other.allocationKind==='total'||row.allocationKind==='total'))throw Error('Ресурсы за '+row.date+': общий отчёт подрядчика пересекается с распределением по объектам / работам. Оставьте один уровень учёта, чтобы не задвоить людей или технику.');
    }
    const candidates=(p.resources||[]).filter(r=>r.active!==false&&resourceKey(r,p)===resourceKey(row,p));
    if(candidates.length>1)throw Error('Несколько отчётов ресурсов в одном разрезе. Уточните специализацию и место.');
    const old=candidates[0];if(!old)return 'new';
    const same=['itr','workers','mechanizers','peopleQty','equipmentQty'].every(k=>Number(old[k]||0)===Number(row[k]||0))&&norm(old.comment)===norm(row.comment)&&norm(old.allocationKind)===norm(row.allocationKind);
    if(same)return 'skip';
    return old;
  }
  const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function review(p,records,{title='Проверка справочников перед импортом'}={}){
    const plan=prepare(p,records);if(!plan.entries.length)return Promise.resolve({plan,decisions:{}});
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='catalog-import-dialog';
      const ready=e=>e.found.kind==='exact'&&!(e.type==='work'&&e.requiresUnit&&!e.found.item.unit&&!e.units.length),exact=plan.entries.filter(ready),changes=plan.entries.filter(e=>!ready(e));
      const rows=entries=>entries.map(e=>{const candidates=list(p,e.type);return '<tr><td>'+esc(definitions[e.type][1])+'</td><td><b>'+esc(e.name)+'</b>'+(e.units.length?'<small>'+esc(e.units.join(' / '))+'</small>':'')+'</td><td><label>Действие<select data-catalog-choice="'+esc(e.key)+'"><option value="">Выберите соответствие</option><option value="new" '+(e.found.kind==='new'?'selected':'')+'>Создать / использовать название</option>'+candidates.map(c=>'<option value="'+esc(c.id)+'" '+(e.found.kind==='exact'&&e.found.item.id===c.id?'selected':'')+'>'+esc(c.name)+(c.active===false?' — восстановить':'')+'</option>').join('')+'</select></label>'+(e.type==='work'?'<label>Единица объёма работы<input data-catalog-unit="'+esc(e.key)+'" value="'+esc(e.units[0]||e.found.item?.unit||'')+'" placeholder="м³, м², шт. — отдельно от шапки"></label>':'')+'<label data-new-name '+(e.found.kind==='new'?'':'hidden')+'>Название<input data-catalog-name="'+esc(e.key)+'" value="'+esc(e.type==='building'&&norm(e.name)==='паркинг'?'Многоуровневый паркинг':e.name)+'"></label>'+(e.found.candidates.length&&e.found.kind!=='exact'?'<small>Возможные совпадения: '+esc(e.found.candidates.slice(0,5).map(c=>c.name).join(', '))+'</small>':'')+'</td></tr>';}).join('');
      dialog.innerHTML='<h2>'+esc(title)+'</h2><p>Проект: <b>'+esc(p.meta?.constructionName||p.meta?.projectName||'Текущий проект')+'</b>. Паркинг, Главный корпус и Аэрарий — здания / сооружения внутри проекта.</p><p>Найдено: '+exact.length+'. Новые или требующие решения: '+changes.length+'. Подтверждение создаст только выбранные значения вместе с данными. Похожие названия автоматически не объединяются.</p><div class="catalog-review-scroll"><table><thead><tr><th>Справочник</th><th>В файле</th><th>Сопоставление</th></tr></thead><tbody>'+rows(changes)+'</tbody></table>'+(exact.length?'<details><summary>Совпавшие значения: '+exact.length+'</summary><table><tbody>'+rows(exact)+'</tbody></table></details>':'')+'</div><p class="notice">Договорные объёмы и сроки из факта не создаются. Отчёт людей без здания остаётся общим по проекту.</p><p data-catalog-error role="alert"></p><div class="editor-actions"><button class="btn" data-catalog-cancel>Отмена</button><button class="btn primary" data-catalog-accept>Подтвердить и продолжить импорт</button></div>';
      document.body.append(dialog);let done=false;
      const finish=value=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(value);};
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.querySelector('[data-catalog-cancel]').onclick=()=>finish(null);
      dialog.onchange=event=>{if(event.target.hasAttribute('data-catalog-choice'))event.target.closest('td').querySelector('[data-new-name]').hidden=event.target.value!=='new';};
      dialog.querySelector('[data-catalog-accept]').onclick=()=>{const decisions={};for(const node of dialog.querySelectorAll('[data-catalog-choice]')){const key=node.getAttribute('data-catalog-choice');decisions[key]={unit:[...dialog.querySelectorAll('[data-catalog-unit]')].find(n=>n.getAttribute('data-catalog-unit')===key)?.value||'',target:node.value,name:[...dialog.querySelectorAll('[data-catalog-name]')].find(n=>n.getAttribute('data-catalog-name')===key).value};}try{validate(p,plan,decisions);finish({plan,decisions});}catch(error){dialog.querySelector('[data-catalog-error]').textContent=error.message;}};
      dialog.showModal();
    });
  }
  window.LIV_CATALOG_IMPORT={norm,unit,match,prepare,defaultDecisions,ensure,apply,validate,placeKey,place,findFront,front,attachSchedule,finalizeSchedule,sameFact,resourceKey,reconcileResource,review,placeFields};
})();
