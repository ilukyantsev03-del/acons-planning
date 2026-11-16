(function(){
  'use strict';
  const key='gpr-theme';
  const valid=value=>value==='light'?'light':'dark';
  let saved='dark';
  try{saved=valid(localStorage.getItem(key));}catch(_){}
  function apply(value){
    const theme=valid(value);
    document.documentElement.setAttribute('data-theme',theme);
    const checkbox=document.getElementById('themeLight');
    if(checkbox)checkbox.checked=theme==='light';
  }
  // Apply before styles load, so navigating between schedules does not flash dark.
  apply(saved);
  function bind(){
    const checkbox=document.getElementById('themeLight');if(!checkbox)return;
    checkbox.checked=document.documentElement.getAttribute('data-theme')==='light';
    checkbox.addEventListener('change',()=>{
      const theme=checkbox.checked?'light':'dark';apply(theme);
      try{localStorage.setItem(key,theme);}catch(_){}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(event.newValue);});
})();
