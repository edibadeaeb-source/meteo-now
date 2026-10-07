/* Licensed films. Pick once per city/weather during a visit, never on touch. */
(function(root) {
    'use strict';
    var clips=Object.create(null), pools=Object.create(null), visit=Object.create(null);
    var storageKey='meteo-weather-rotation-v1', history={};
    try { history=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}; } catch(e) {}
    if(typeof history!=='object'||Array.isArray(history))history={};
    function original(movie,base,quality) {
        var landscape=/^(new-york|miami|tropical-coast|coast|coast-cloudy|highland)$/.test(movie);
        clips[movie]={id:movie,base:base||movie,quality:quality||'2k',version:2,native:false,
            poster:landscape?'assets/weather-video/v2/'+movie+'.webp':'assets/weather/v1/'+movie+'.webp'};
        pools[movie]=[movie];
    }
    ['clear-day','clear-night','partly-cloudy','overcast','rain','storm','snow','fog','twilight',
     'new-york','miami','tropical-coast','coast','coast-cloudy','highland'].forEach(function(movie) {
        original(movie,/^(rain|storm|fog)$/.test(movie)?'overcast':movie,
            /^(clear-day|twilight|tropical-coast)$/.test(movie)?'hd':'2k');
    });
    function add(movie,qualityA,qualityB) {
        ['a','b'].forEach(function(letter,i) {
            // Withdrawn: soft HD sunset with a distracting green lens flare and judder.
            if (movie === 'twilight' && letter === 'a') return;
            var id=movie+'-'+letter;
            clips[id]={id:id,base:id,quality:i?qualityB:qualityA,version:3,native:true,
                precipitation:movie==='rain'||movie==='snow',poster:'assets/weather-video/v3/'+id+'.webp'};
            pools[movie].push(id);
        });
    }
    add('clear-day','hd','2k'); add('clear-night','hd','hd');
    // Replaces a mislabeled source containing falling white particles.
    clips['clear-night-a'].version = 5; clips['clear-night-a'].quality = '2k';
    clips['clear-night-a'].poster = 'assets/weather-video/v5/clear-night-a.webp';
    add('partly-cloudy','2k','2k'); add('overcast','2k','2k');
    add('rain','2k','2k');
    ['a','b'].forEach(function(letter) {
        var clip=clips['rain-'+letter]; clip.version=6;
        clip.poster='assets/weather-video/v6/rain-'+letter+'.webp';
    }); add('storm','hd','hd'); add('snow','hd','hd');
    add('fog','2k','hd'); add('twilight','hd','hd');
    add('new-york','2k','2k'); add('miami','2k','hd');
    function register(movie,records) {
        if (!records || !records.length || pools[movie]) return;
        pools[movie]=records.map(function(clip) { clips[clip.id]=clip; return clip.id; });
    }
    function pick(movie,night,loc) {
        var pool=pools[movie];
        if (!pool) return null;
        loc=loc||{};
        var key=(+loc.lat).toFixed(3)+','+(+loc.lon).toFixed(3)+':'+movie+':'+(night?'night':'day');
        if (visit[key]) return clips[visit[key]];
        var previous=pool.indexOf(history[key]), index=previous<0?0:(previous+1)%pool.length;
        var id=pool[index]; visit[key]=id;
        // Keep only recent choices, bounded independently of the media cache.
        delete history[key]; history[key]=id;
        var keys=Object.keys(history);
        while(keys.length>64)delete history[keys.shift()];
        try { localStorage.setItem(storageKey,JSON.stringify(history)); } catch(e) {}
        return clips[id];
    }
    function restore(id,movie) {
        // Cached atmosphere can only refer to an asset in this fixed catalogue.
        return pools[movie]&&pools[movie].indexOf(id)>=0?clips[id]:null;
    }
    root.MeteoWeatherLibrary={pick:pick,restore:restore,register:register,has:function(movie){return !!pools[movie];}};
})(window);
