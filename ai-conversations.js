/* Local conversations only. Weather snapshots are refreshed at each question. */
(function(root) {
    'use strict';
    var storageKey='meteo-ai-conversations-v1', saved=true;
    var state={version:1,active:null,conversations:[]};
    function id(){return root.crypto&&root.crypto.randomUUID?root.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
    function city(loc){return {name:String(loc&&loc.nume||'').slice(0,120),lat:loc&&isFinite(loc.lat)?+loc.lat:null,lon:loc&&isFinite(loc.lon)?+loc.lon:null};}
    function valid(c){return c&&typeof c.id==='string'&&c.id.length<128&&Array.isArray(c.messages)&&typeof c.updated==='number'&&isFinite(c.updated);}
    try {
        var raw=JSON.parse(root.localStorage.getItem(storageKey)||'null');
        if(raw&&raw.version===1&&Array.isArray(raw.conversations)){
            state.active=typeof raw.active==='string'?raw.active:null;
            state.conversations=raw.conversations.filter(valid).slice(0,30).map(function(c){
                c.title=String(c.title||'').slice(0,120);
                c.city=String(c.city||'').slice(0,120);
                c.messages=c.messages.filter(function(m){return m&&['user','model','error'].indexOf(m.role)>=0&&typeof m.text==='string';}).slice(-120).map(function(m){return {role:m.role,text:m.text.slice(0,8000),time:typeof m.time==='number'?m.time:c.updated,city:String(m.city||'').slice(0,120)};});
                return c;
            });
        }
    } catch(e){saved=false;}
    function find(cid){return state.conversations.find(function(c){return c.id===cid;})||null;}
    function persist(){
        state.conversations.sort(function(a,b){return b.updated-a.updated;});
        state.conversations=state.conversations.slice(0,30);
        // Bound local storage by actual payload size, not just conversation count.
        var encoded=JSON.stringify(state);
        while(encoded.length>220000&&state.conversations.length>1){
            var victim=state.conversations.length-1;
            if(state.conversations[victim].id===state.active)victim--;
            state.conversations.splice(victim,1);encoded=JSON.stringify(state);
        }
        if(state.conversations.length===1){
            var c=state.conversations[0];
            while(encoded.length>220000&&c.messages.length>2){c.messages.shift();c.truncated=true;encoded=JSON.stringify(state);}
        }
        try {root.localStorage.setItem(storageKey,encoded);saved=true;}catch(e){saved=false;}
        return saved;
    }
    function active(){return find(state.active);}
    function start(loc){
        var now=Date.now(),c={id:id(),title:'',city:city(loc).name,created:now,updated:now,messages:[]};
        state.conversations.unshift(c);state.active=c.id;persist();return c;
    }
    function append(cid,role,text,loc){
        var c=find(cid);if(!c||['user','model','error'].indexOf(role)<0)return false;
        text=String(text||'').slice(0,8000);if(!text.trim())return false;
        if(!c.title&&role==='user')c.title=text.slice(0,120);
        c.messages.push({role:role,text:text,time:Date.now(),city:city(loc).name});
        if(c.messages.length>120){c.messages=c.messages.slice(-120);c.truncated=true;}
        c.updated=Date.now();persist();return true;
    }
    root.MeteoConversations={
        active:active,start:start,append:append,get:find,
        list:function(){return state.conversations.filter(function(c){return c.messages.length;});},
        context:function(cid){var c=find(cid);return c?c.messages.filter(function(m){return m.role==='user'||m.role==='model';}).slice(-40).map(function(m){return {role:m.role,text:m.text};}):[];},
        select:function(cid){if(!find(cid))return false;state.active=cid;persist();return true;},
        blank:function(){state.active=null;persist();},
        remove:function(cid){state.conversations=state.conversations.filter(function(c){return c.id!==cid;});if(state.active===cid)state.active=null;persist();},
        saved:function(){return saved;}
    };
})(window);
