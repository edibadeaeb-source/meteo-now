'use strict';
(() => {
  const $=id=>document.getElementById(id);
  let history=[],busy=false;
  const panel=$('chatPanel'),launcher=$('chatLauncher'),input=$('chatInput'),messages=$('chatMessages');
  function welcome(){messages.replaceChildren($('chatWelcome').content.cloneNode(true));}
  function idle(){panel.dataset.idle=String(!busy&&!input.value.trim());}
  function open(){panel.hidden=false;launcher.setAttribute('aria-expanded','true');idle();input.focus();}
  function close(){panel.hidden=true;launcher.setAttribute('aria-expanded','false');launcher.focus();}
  launcher.addEventListener('click',()=>panel.hidden?open():close());
  $('chatClose').addEventListener('click',close);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close();}});
  function message(text,kind){const bubble=document.createElement('div');bubble.className=`chat-message ${kind}`;bubble.textContent=text;messages.append(bubble);messages.scrollTop=messages.scrollHeight;return bubble;}
  function setBusy(value){busy=value;idle();$('chatSend').disabled=value;$('chatReset').disabled=value;document.querySelectorAll('[data-question]').forEach(b=>b.disabled=value);$('chatForm').setAttribute('aria-busy',String(value));}
  async function send(question){
    if(busy || !question.trim())return;
    if(question.trim().length>1200){$('chatFeedback').textContent='Întrebarea poate avea maximum 1.200 de caractere.';return;}
    if(!navigator.onLine){$('chatFeedback').textContent='AI-ul are nevoie de internet. Măsurătorile deja afișate rămân disponibile.';return;}
    const context=window.StandSnapshot;
    if(!context){$('chatFeedback').textContent='Datele dashboardului se pregătesc. Încearcă peste câteva secunde.';return;}
    const text=question.trim();input.value='';message(text,'user');setBusy(true);$('chatFeedback').textContent='';
    const waiting=message('Analizez măsurătorile…','pending');const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),80000);
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({question:text,sensors:context.sensors,history:history.slice(-8)})});
      const result=await response.json();
      if(!response.ok || typeof result.answer!=='string')throw new Error(result.error || 'Asistentul nu este disponibil acum.');
      waiting.remove();message(result.answer,'assistant');
      history.push({role:'user',text:text.slice(0,1500)},{role:'model',text:result.answer.slice(0,1500)});history=history.slice(-8);
    }catch(error){waiting.remove();message(error.name==='AbortError'?'Răspunsul durează prea mult. Încearcă din nou.':error.message==='Failed to fetch'?'Conexiunea cu asistentul s-a întrerupt. Încearcă din nou.':error.message,'error');input.value=text;}
    finally{clearTimeout(timeout);setBusy(false);if(!panel.hidden)input.focus();}
  }
  $('chatForm').addEventListener('submit',event=>{event.preventDefault();send(input.value);});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send(input.value);}});
  document.querySelectorAll('[data-question]').forEach(button=>button.addEventListener('click',()=>send(button.dataset.question)));
  $('chatReset').addEventListener('click',()=>{if(busy)return;history=[];welcome();$('chatFeedback').textContent='';input.value='';idle();input.focus();});
  input.addEventListener('input',idle);welcome();idle();
})();
