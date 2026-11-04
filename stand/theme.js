'use strict';
(() => {
  let theme='light';
  try{theme=localStorage.getItem('meteo-stand-theme')==='dark'?'dark':'light';}catch{}
  document.documentElement.dataset.theme=theme;
  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.getElementById('themeButton');
    function update(){button.textContent=theme==='dark'?'☀ Temă albă':'☾ Temă închisă';button.setAttribute('aria-pressed',String(theme==='dark'));}
    button.addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('meteo-stand-theme',theme);}catch{}update();window.dispatchEvent(new Event('stand-theme'));});
    update();
  });
})();
