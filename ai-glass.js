/* Freeze the weather into frosted pixels once per AI opening. There is no live
   CSS backdrop filter behind interactive or animated AI content on any device. */
(function(root) {
    'use strict';
    var surfaces = new WeakMap();
    function drawable(source) {
        return source && (source.tagName === 'VIDEO' ? source.readyState >= 2 : source.complete && source.naturalWidth > 0);
    }
    function paint(ctx, source, panel, pad) {
        if (!drawable(source)) return;
        var r=source.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var w=source.videoWidth || source.naturalWidth,h=source.videoHeight || source.naturalHeight;
        var scale=Math.max(r.width/w,r.height/h),position=getComputedStyle(source).objectPosition.split(' ');
        var fx=/%$/.test(position[0]) ? parseFloat(position[0])/100 : .5;
        var fy=/%$/.test(position[1]) ? parseFloat(position[1])/100 : .5;
        ctx.drawImage(source,r.left-panel.left+pad+(r.width-w*scale)*fx,
            r.top-panel.top+pad+(r.height-h*scale)*fy,w*scale,h*scale);
    }
    function capture(panel) {
        if (!panel || !panel.classList.contains('open')) return;
        var r=panel.getBoundingClientRect(),width=Math.ceil(r.width),height=Math.ceil(r.height);
        if (!width || !height) return;
        var state=surfaces.get(panel);
        if (!state) {
            var canvas=document.createElement('canvas');canvas.className='ai-glass-bitmap';
            canvas.setAttribute('aria-hidden','true');panel.prepend(canvas);
            state={canvas:canvas,width:0};surfaces.set(panel,state);
        }
        state.width=width;
        var output=state.canvas;output.width=width;output.height=height;
        var ctx=output.getContext('2d',{alpha:false});
        if (!ctx) return;
        ctx.fillStyle='#152039';ctx.fillRect(0,0,width,height);
        var weather=document.getElementById('mobCer');
        var work=document.createElement('canvas'),pad=64;
        work.width=width+pad*2;work.height=height+pad*2;
        try {
            var brush=work.getContext('2d',{alpha:false});
            if (!brush) return;
            brush.fillStyle='#152039';brush.fillRect(0,0,work.width,work.height);
            // Blur is baked into the bitmap, never applied to a live DOM ancestor.
            brush.filter='blur(24px) saturate(135%)';
            if (weather) {
                var video=weather.querySelector('.weather-video.is-visible');
                if (drawable(video)) paint(brush,video,r,pad);
                else {
                    paint(brush,weather.querySelector('.weather-city-sky[src]'),r,pad);
                    paint(brush,weather.querySelector('.weather-photo.is-visible'),r,pad);
                }
            }
            ctx.drawImage(work,pad,pad,width,height,0,0,width,height);
            ctx.fillStyle='rgba(6,12,28,.28)';ctx.fillRect(0,0,width,height);
            panel.dataset.aiGlass='bitmap';
        } catch(ignored) {
            // Missing media/unsupported canvas keeps an opaque, stable glass tint.
            ctx.fillStyle='#152039';ctx.fillRect(0,0,width,height);
        } finally { work.width=work.height=0; }
    }
    function release(panel) {
        var state=surfaces.get(panel);
        if (state) { state.canvas.width=state.canvas.height=0;state.width=0; }
    }
    // Keyboard height changes simply fit the cached pixels. Repaint only on a
    // genuine width change (rotation/resizing), never on finger or scroll events.
    root.addEventListener('resize',function() {
        var panel=document.getElementById('chatWindow'),state=panel&&surfaces.get(panel);
        if (state && panel.classList.contains('open') && Math.abs(panel.getBoundingClientRect().width-state.width)>20)
            root.requestAnimationFrame(function(){capture(panel);});
    },{passive:true});
    root.MeteoAIGlass={capture:capture,release:release};
})(window);
