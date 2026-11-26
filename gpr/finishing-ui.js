'use strict';
(function(root){
const keys=[['building','Здание'],['block','Блок'],['floor','Этаж'],['category','Раздел'],['contractor','Подрядчик'],['type','Вид работ']];
function label(t,progress,nf){return nf(progress(t))+'%';}
function active(document){return keys.some(([k])=>document.getElementById('fin-'+k)?.value);}
function accepts(t,document){return keys.every(([k])=>{const v=document.getElementById('fin-'+k)?.value;return !v||(v==='__empty'?!t[k]:String(t[k])===v);});}
function metadata(t){return [t.building,t.block?'Блок '+t.block:'',t.floor==='-1'?'Подвал':t.floor?'Этаж '+t.floor:'',t.room,t.roomName,t.category].filter(Boolean).join(' · ');}
function rowClass(t){if(t.summary)return '';const category=String(t.category||'').toLowerCase().trim();return category==='инженерка'?'row-engineering':category==='отделка'?'row-finishing':'';}
function filters(data,esc,selected={}){return keys.map(([k,title])=>{const values=[...new Set(data.tasks.filter(t=>!t.summary).map(t=>String(t[k]||'')))].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true}));return `<select id="fin-${k}" aria-label="${title}"><option value="">${title}: все</option>${values.map(v=>`<option value="${esc(v||'__empty')}"${(v||'__empty')===selected[k]?' selected':''}>${esc(v||(k==='contractor'?'Не назначен':'Не указан'))}</option>`).join('')}</select>`;}).join('');}
function dimensions(data,selected={}){
 const labels={building:'Здания',block:'Блоки',floor:'Этажи',category:'Разделы',contractor:'Подрядчики',type:'Виды работ'},buildingNames={'ГК':'Главный корпус','РБЗ':'Ресторан','ГЛ':'Грязелечебница'},value=t=>k=>String(t[k]??'')||'__empty';let candidates=data.tasks.filter(t=>!t.summary&&!t.hidden);
 return keys.map(([k])=>{const values=[...new Set(candidates.map(t=>value(t)(k)))].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true})),allowed=new Set(values),chosen=(Array.isArray(selected[k])?selected[k]:selected[k]?[selected[k]]:[]).map(String).filter(v=>allowed.has(v));
 const items=values.map(v=>({value:v,label:v==='__empty'?(k==='contractor'?'Не назначен':'Не указан'):k==='building'?buildingNames[v]||v:k==='block'?'Блок '+v:k==='floor'?v==='-1'?'Подвал':'Этаж '+v:v}));if(chosen.length)candidates=candidates.filter(t=>chosen.includes(value(t)(k)));return {key:'fin-'+k,label:labels[k],items,valueOf:t=>value(t)(k)};});
}
function cut(rows,base,date,{C,esc,fmt,nf,nameCell,durationCell,percentCell}){const delta=(s,b)=>s&&b?(C.time(C.date(s))-C.time(C.date(b)))/C.DAY:null,cell=n=>`<td class="${n>0?'bad':n<0?'good':''}">${n===null?'—':(n>0?'+':'')+nf(n)+' дн.'}</td>`;const html=rows.map(({t,depth})=>{const b=base[t.id],position=!t.start||!t.finish?'Сроки не заданы':date<C.date(t.start)?'До начала':date>C.date(t.finish)?'После окончания':'В периоде работ';return `<tr data-depth="${depth}" class="${rowClass(t)} ${t.summary?'summary':''} ${!t.parent?'root':''}">${nameCell(t,depth)}${durationCell?durationCell(t):''}<td>${t.summary?'—':position}</td><td>${fmt(b?.start)}</td><td>${fmt(b?.finish)}</td><td>${fmt(t.start)}</td><td>${fmt(t.finish)}</td>${cell(delta(t.start,b?.start))}${cell(delta(t.finish,b?.finish))}${percentCell?percentCell(t):`<td>${label(t,C.progress,nf)}</td>`}</tr>`;}).join('');return `<table class="mock-table finishing-cut"><thead><tr><th>Работа / группа</th>${durationCell?'<th>Дней</th>':''}<th>В текущем плане на ${fmt(date)}</th><th>Базовое начало</th><th>Базовое окончание</th><th>Текущее начало</th><th>Текущее окончание</th><th>Отклонение начала</th><th>Отклонение окончания</th><th>Готовность по данным</th></tr></thead><tbody>${html}</tbody></table>`;}
root.GPR_FINISHING={keys,label,active,accepts,metadata,rowClass,filters,dimensions,cut};if(typeof module!=='undefined')module.exports=root.GPR_FINISHING;
})(typeof window!=='undefined'?window:globalThis);



