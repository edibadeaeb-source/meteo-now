(function(){
    'use strict';
    var ro=document.getElementById('bRo'),en=document.getElementById('bEn');
    function set(language){
        var english=language==='en';
        document.documentElement.lang=english?'en':'ro';
        document.body.classList.toggle('en',english);
        ro.classList.toggle('activ',!english);en.classList.toggle('activ',english);
        ro.setAttribute('aria-pressed',String(!english));en.setAttribute('aria-pressed',String(english));
        var title=document.querySelector('[data-title-ro]');
        if(title)document.title=title.getAttribute(english?'data-title-en':'data-title-ro')+' · METEO NOW';
    }
    ro.addEventListener('click',function(){set('ro');});
    en.addEventListener('click',function(){set('en');});
    var language;
    try{language=localStorage.getItem('meteo-lang');}catch(ignore){}
    set(language==='ro'||language==='en'?language:((navigator.language||'ro').toLowerCase().indexOf('ro')===0?'ro':'en'));
})();
