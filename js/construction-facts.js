'use strict';
/* Construction journals may report an event without a measurable quantity. */
(function(){
 const C=window.LIV_CATALOG_IMPORT,text=v=>String(v??'').trim(),norm=C.norm,id=p=>p+'-'+crypto.randomUUID();
 function context(row,get){
  const work=text(get(row,'work')),combined=text(get(row,'pileCaptureAnchorNo')),number=text(get(row,'elementNo'));
  const anchor=/анкер/i.test(work),bns=/бнс/i.test(work),bss=/бсс/i.test(work);
  const capture=text(get(row,'capture')),block=text(get(row,'block'))||(/^блок\s+/i.test(capture)?capture:'');
  return {block,
   element:text(get(row,'element')),elementType:text(get(row,'elementType'))||(anchor?'Анкер':bns?'Свая БНС':bss?'Свая БСС':/сва[яий]/i.test(work)?'Свая':''),
   elementNo:anchor&&combined?combined:number,
   groupCode:text(get(row,'groupCode'))||(anchor&&combined?number:''),
   capture:block&&/^блок\s+/i.test(capture)?'':anchor?capture:capture||combined,
   status:text(get(row,'status')),concreteStatus:text(get(row,'concreteStatus'))
  };
 }
 function numbered(p,data,front,date,source){
  if(!data.elementNo||!data.elementType)return null;
  const key=x=>[x.buildingId,x.elementType,x.groupCode,x.capture,x.zone,x.elementNo].map(norm).join('|');
  const candidate={buildingId:front.buildingId,elementType:data.elementType,groupCode:data.groupCode||'',capture:data.capture||'',zone:data.zone||'',elementNo:data.elementNo};
  p.numberedElements=p.numberedElements||[];const hits=p.numberedElements.filter(x=>x.active!==false&&key(x)===key(candidate));
  if(hits.length>1)throw Error('Номер элемента неоднозначен: '+data.elementNo+'. Уточните группу и место.');
  const element=hits[0]||{id:id('EL'),...candidate,uniqueScope:'context',active:true,status:'Не начато',frontId:front.id,workId:front.workId,createdAt:new Date().toISOString(),customData:{}};
  if(!hits.length)p.numberedElements.push(element);
  element.customData=element.customData||{};const history=element.customData.stageHistory=element.customData.stageHistory||[];
  const phase=norm(data.work),event={date,phase,work:data.work,frontId:front.id,status:data.status||'',concreteStatus:data.concreteStatus||'',source};
  const previous=history.find(x=>x.date===date&&x.phase===phase);if(previous)Object.assign(previous,event);else history.push(event);
  element.customData.frontIds=[...new Set([...(element.customData.frontIds||[]),front.id])];
  // A drilling observation never proves completion of the whole pile.
  const completed=history.some(x=>/^(выполнен[оа]?|завершен[оа]?|освидетельствован[оа]?)$/i.test(x.concreteStatus));
  element.status=completed?'Завершено':'В работе';element.updatedAt=new Date().toISOString();
  return element;
 }
 function observation(p,{data,front,date,source}){
  p.progressFacts=p.progressFacts||[];
  const organizationId=C.match(p,'organization',data.organization).item?.id||front.organizationId||'',status=data.status||'',concreteStatus=data.concreteStatus||'';
  const identity=[front.id,date,data.elementType||'',data.groupCode||'',data.elementNo||'',organizationId,data.recordId||''].join('|');
  const candidates=p.progressFacts.filter(x=>x.active!==false&&['status','event'].includes(x.factType)&&x.observationKey===identity);
  if(candidates.length>1)throw Error('Несколько записей журнала совпадают: '+data.work+' / '+date);
  const old=candidates[0];if(old){if(old.status===status&&old.concreteStatus===concreteStatus&&old.comment===(data.comment||''))return 'skip';if(!confirm('Запись журнала за '+date+' уже есть. Обновить статус с сохранением истории?'))return 'skip';}
  const element=numbered(p,data,front,date,source),row={id:old?.id||id('OBS'),frontId:front.id,organizationId,factDate:date,factType:status||concreteStatus?'status':'event',quantity:null,cumulativeQty:null,status,comment:data.comment||'',numberedElementId:element?.id||'',concreteStatus,observationKey:identity,source,sourceFingerprint:old?.sourceFingerprint||'observation:'+identity,createdAt:old?.createdAt||new Date().toISOString()};
  if(old){const previous=JSON.parse(JSON.stringify(old));Object.assign(old,row,{revisions:[...(previous.revisions||[]),{...previous,revisions:undefined}],updatedAt:new Date().toISOString()});return 'updated';}
  p.progressFacts.push(row);return 'new';
 }
 function mount(c){
  const panel=document.getElementById('tab-facts');if(!panel)return;
  let host=document.getElementById('constructionFactJournal');if(!host){host=document.createElement('section');host.id='constructionFactJournal';host.className='card';panel.append(host);}
  const p=c.project,e=c.esc,all=(p.progressFacts||[]).filter(r=>r.active!==false&&r.factDate>=c.state.from&&r.factDate<=c.state.to&&window.LIV_CONTEXT.recordMatches(p,r,c.state)).sort((a,b)=>b.factDate.localeCompare(a.factDate));
  const rows=all.slice(0,200),groups=new Map();
  for(const r of all){if(r.factType!=='quantity'||!Number.isFinite(r.quantity))continue;const f=(p.fronts||[]).find(f=>f.id===r.frontId),u=f?.unit||'';if(!u)continue;groups.set(u,(groups.get(u)||0)+r.quantity);}
  host.innerHTML='<h2>Журнал выполнения работ</h2><p>Количественный факт и записи без объёма. Пустой объём не считается нулём; статус не заменяет процент готовности. Отбор и период — общие. Строк: '+all.length+(all.length>200?' · показаны последние 200':'')+'.</p><div class="table-wrap"><table><thead><tr><th>Дата</th><th>Объект / место</th><th>Работа</th><th>№ элемента</th><th>Объём</th><th>Статус / бетон</th><th>Подрядчик / источник</th></tr></thead><tbody>'+rows.map(r=>{const f=(p.fronts||[]).find(f=>f.id===r.frontId)||{},s=(p.structures||[]).find(s=>s.id===f.structureId)||{},w=(p.works||[]).find(w=>w.id===f.workId),b=(p.buildings||[]).find(b=>b.id===f.buildingId),o=(p.organizations||[]).find(o=>o.id===(r.organizationId||f.organizationId)),el=(p.numberedElements||[]).find(x=>x.id===r.numberedElementId),value=r.factType==='cumulative_snapshot'?r.cumulativeQty:r.factType==='quantity'?r.quantity:null;return '<tr><td>'+e(r.factDate)+'</td><td>'+e(b?.name||'—')+'<small>'+e([s.block,s.floor,s.capture,s.axis,s.element,s.elevation].filter(Boolean).join(' · '))+'</small></td><td>'+e(w?.name||f.name||'—')+'</td><td>'+e(el?.elementNo||'—')+'</td><td>'+e(value===null?'—':value+' '+(f.unit||''))+(r.factType==='cumulative_snapshot'?'<small>накопительно</small>':'')+'</td><td>'+e([r.status,r.concreteStatus?'Бетон: '+r.concreteStatus:''].filter(Boolean).join(' / ')||'Запись без статуса')+'</td><td>'+e(o?.name||'—')+'<small>'+e([r.source?.file,r.source?.sheet,r.source?.row?'стр. '+r.source.row:''].filter(Boolean).join(' · '))+'</small></td></tr>';}).join('')+'</tbody>'+(c.state.showTotals===false?'':'<tfoot>'+[...groups].map(([u,n])=>'<tr class="liv-total-row"><th colspan="4">Итого приростов за период · '+e(u)+'</th><td>'+e(n.toLocaleString('ru-RU'))+'</td><td colspan="2">Накопительные отсечки и записи без объёма не суммируются</td></tr>').join('')+'</tfoot>')+'</table></div>';
 }
 window.LIV_CONSTRUCTION_FACTS={context,numbered,observation,mount};
})();
