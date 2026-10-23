'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let dom=process.env.LIV_DOM_TEST_MODULE;
if(!dom){try{dom=require.resolve('linkedom');}catch{}}
function fixture(phone=true){
 const {parseHTML}=require(dom),{window,document,Event}=parseHTML('<html><body><header><div class="top-actions"><button id="save">Сохранить</button></div></header><main class="container"><nav class="tabs"><button class="tab active">Сводка</button><button class="tab" id="volumes">Объёмы</button><details><summary>Справочники</summary><button class="tab">Настройки</button></details></nav><section><table id="bare"><tr><td>1</td></tr></table><div class="table-wrap"><table id="wrapped"></table></div></section></main></body></html>');
 const observers=[],media={matches:phone,addEventListener:(name,fn)=>media.change=fn};
 window.matchMedia=()=>media;window.requestAnimationFrame=fn=>fn();
 class Observer{constructor(fn){this.fn=fn;observers.push(this);}observe(){}}
 const source=fs.readFileSync(__dirname+'/../js/responsive-layout.js','utf8');
 vm.runInNewContext(source,{document,window,MutationObserver:Observer});document.dispatchEvent(new Event('DOMContentLoaded'));
 return {document,Event,media,observers};
}
test('Телефон: меню сохраняет исходные кнопки и обработчики, выбор раздела закрывает меню',{skip:!dom},()=>{
 const {document:d,Event}=fixture(),button=d.getElementById('responsiveNavToggle'),nav=d.querySelector('nav.tabs');
 assert.equal(nav.dataset.responsiveOpen,'false');assert.match(button.textContent,/Сводка/);assert.equal(button.getAttribute('aria-controls'),nav.id);
 button.click();assert.equal(button.getAttribute('aria-expanded'),'true');
 let selected=0;d.getElementById('volumes').addEventListener('click',()=>selected++);d.getElementById('volumes').dispatchEvent(new Event('click',{bubbles:true}));
 assert.equal(selected,1);assert.equal(nav.dataset.responsiveOpen,'false');
 const save=d.getElementById('save');let saved=0;save.addEventListener('click',()=>saved++);d.getElementById('responsiveActionsToggle').click();save.click();assert.equal(saved,1);
});
test('Поворот и смена размера: настольные панели открыты, мобильные сворачиваются',{skip:!dom},()=>{
 const {document:d,media}=fixture(false);assert.equal(d.querySelector('nav.tabs').dataset.responsiveOpen,'true');
 media.matches=true;media.change();assert.equal(d.querySelector('nav.tabs').dataset.responsiveOpen,'false');assert.equal(d.querySelector('.top-actions').dataset.responsiveOpen,'false');
 media.matches=false;media.change();assert.equal(d.querySelector('nav.tabs').dataset.responsiveOpen,'true');
});
test('Новые таблицы получают отдельную прокрутку без вложенных обёрток и изменения данных',{skip:!dom},()=>{
 const {document:d,observers}=fixture();assert.equal(d.getElementById('bare').parentNode.className,'responsive-table-scroll');assert.equal(d.getElementById('wrapped').parentNode.className,'table-wrap');
 const table=d.createElement('table');table.innerHTML='<tr><td>123</td></tr>';d.querySelector('section').appendChild(table);observers.at(-1).fn();observers.at(-1).fn();
 assert.equal(table.parentNode.className,'responsive-table-scroll');assert.equal(table.parentNode.parentNode.tagName,'SECTION');assert.equal(table.textContent,'123');
});
test('Название мобильного раздела следует за программным переключением вкладки',{skip:!dom},()=>{
 const {document:d,observers}=fixture();d.querySelector('.tab.active').classList.remove('active');d.getElementById('volumes').classList.add('active');observers[0].fn();assert.match(d.getElementById('responsiveNavToggle').textContent,/Объёмы/);
});
