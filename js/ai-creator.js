(() => {
  const APP = document.currentScript?.dataset.appId || 'pixel-app';
  const SPECS = {
    pixelArt: ['pixel-art sprite', 'Return JSON only: {"width":16,"height":16,"palette":["#hex"],"pixels":[[...]]}. pixels is height rows of width palette indexes. Use transparent as -1.'],
    pixelText: ['pixel lettering or icon art', 'Return JSON only: {"width":16,"height":16,"palette":["#hex"],"pixels":[[...]]}. pixels is height rows of width palette indexes. Use transparent as -1.'],
    pixelTilemap: ['seamless pixel tile', 'Return JSON only: {"width":16,"height":16,"palette":["#hex"],"pixels":[[...]]}. Make the edges tile seamlessly. pixels is height rows of width palette indexes; transparent is -1.'],
    pixelDualTilemaps: ['seamless dual tilemap tile', 'Return JSON only: {"width":16,"height":16,"palette":["#hex"],"pixels":[[...]]}. Make the edges tile seamlessly and use clear readable shapes. pixels is height rows of width palette indexes; transparent is -1.'],
    pixelPose: ['2D character pose', 'Return JSON only: {"nodes":[{"id":"node-id","x":0,"y":0}]}. Only include IDs from the supplied skeleton. Coordinates are in the editor character-local coordinate system. Keep feet near ground and limb lengths plausible.'],
    pixelMusic: ['8-bit sound effect', 'Return JSON only: {"name":"short sound name","settings":{"attack":0,"sustain":0,"punch":0,"decay":0,"frequency":0,"slide":0,"deltaSlide":0,"vibratoEnable":false,"vibratoDepth":0,"vibratoSpeed":0,"arpEnable":false,"arpMult":1,"arpSpeed":0,"duty":50,"dutySweep":0,"waveform":"square","lpfEnable":false,"lpf":22050,"hpfEnable":false,"hpf":0,"gain":-10}}. Tune numbers to make the requested sound.'],
    pixelIsometric: ['isometric 3D scene', 'Return JSON only: {"objects":[{"type":"cube|sphere|cylinder|ramp|wall|building","position":[x,y,z],"scale":[x,y,z],"color":"#hex","name":"short name"}]}. Use at most 12 objects and coordinates between -8 and 8.'],
  };
  const spec = SPECS[APP];
  if (!spec) return;
  const style = document.createElement('style');
  style.textContent = `
    #pixel-ai-create-launch{position:fixed;right:18px;bottom:18px;z-index:9998;background:#7048e8;color:#fff;border:0;border-radius:10px;padding:11px 16px;font:600 14px 'Inter',system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.35);cursor:pointer;transition:all .2s cubic-bezier(.4,0,.2,1)}
    #pixel-ai-create-launch:hover{background:#8257f0;transform:translateY(-1px);box-shadow:0 6px 22px rgba(112,72,232,.45)}
    #pixel-ai-create-launch:active{transform:translateY(0)}

    #pixel-ai-create{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;font:14px 'Inter',system-ui,sans-serif;color:var(--text-primary,#e0e7ff)}
    #pixel-ai-create.open{display:flex}
    #pixel-ai-create .card{position:relative;background:var(--bg-dark,#1a1a2e);border:1px solid var(--border-color,#2d3748);border-radius:8px;padding:20px;width:min(640px,94vw);max-height:88vh;overflow:auto;box-sizing:border-box;box-shadow:0 10px 25px rgba(0,0,0,.5);color:var(--text-primary,#e0e7ff)}
    #pixel-ai-create h2{margin:0 0 15px;padding-bottom:15px;border-bottom:1px solid var(--border-color,#2d3748);display:flex;align-items:center;gap:8px;color:var(--accent-primary,#00ff41);font-size:1.2rem;font-weight:600}
    #pixel-ai-create p{margin:0 0 15px;color:var(--text-secondary,#94a3b8);font-size:.8rem;line-height:1.5}
    #pixel-ai-create textarea{box-sizing:border-box;width:100%;min-height:100px;padding:10px;background:var(--bg-light,#1e293b);border:1px solid var(--border-color,#2d3748);border-radius:4px;color:var(--text-primary,#e0e7ff);font:inherit;font-size:.8rem;line-height:1.5;resize:vertical;outline:none;transition:all .2s}
    #pixel-ai-create textarea::placeholder{color:var(--text-secondary,#64748b)}
    #pixel-ai-create textarea:focus{border-color:var(--accent-primary,#00ff41);box-shadow:0 0 8px var(--border-glow,rgba(0,255,65,.3))}

    #pixel-ai-create .actions{display:flex;justify-content:flex-end;align-items:center;gap:10px;flex-wrap:wrap;margin-top:15px;padding-top:15px;border-top:1px solid var(--border-color,#2d3748)}
    #pixel-ai-create button{appearance:none;display:flex;align-items:center;justify-content:center;gap:6px;min-width:100px;padding:6px 12px;border:1px solid var(--border-color,#2d3748);border-radius:4px;background:var(--bg-light,#1e293b);color:var(--text-primary,#e0e7ff);font-family:inherit;font-size:12px;cursor:pointer;transition:all .2s cubic-bezier(.4,0,.2,1);box-shadow:0 1px 2px rgba(0,0,0,.1)}
    #pixel-ai-create button:hover:not(:disabled){background:var(--bg-medium,#16213e);border-color:var(--text-secondary,#94a3b8);transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,.15)}
    #pixel-ai-create button:active:not(:disabled){transform:translateY(0);box-shadow:0 1px 2px rgba(0,0,0,.1)}
    #pixel-ai-create button.generate{background:var(--accent-primary,#00ff41);border:none;color:#000;font-weight:bold;box-shadow:0 0 10px rgba(0,255,65,.2);animation:pixelAiCreatePulse 2s ease infinite}
    #pixel-ai-create button.generate:hover{box-shadow:0 0 15px rgba(0,255,65,.3);transform:translateY(-1px) scale(1.02)}
    #pixel-ai-create button.apply{background:var(--bg-medium,#16213e);color:var(--text-secondary,#94a3b8)}
    #pixel-ai-create button.apply:hover:not(:disabled){background:var(--bg-light,#1e293b);color:var(--text-primary,#e0e7ff)}
    #pixel-ai-create button.apply:disabled{opacity:.5;cursor:not-allowed;box-shadow:none;transform:none}
    #pixel-ai-create button.close{background:transparent;color:var(--text-secondary,#94a3b8);box-shadow:none}
    #pixel-ai-create button.close:hover{background:var(--bg-light,#1e293b);color:var(--text-primary,#e0e7ff)}

    #pixel-ai-create .status{min-height:20px;margin:15px 0;color:var(--text-secondary,#94a3b8);font-size:.78rem;line-height:1.45}
    #pixel-ai-create .preview{white-space:pre-wrap;word-break:break-word;max-height:34vh;overflow:auto;margin:0;background:var(--bg-medium,#16213e);border:1px solid var(--border-color,#2d3748);color:var(--accent-tertiary,#00d9ff);padding:12px;border-radius:4px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    @keyframes pixelAiCreatePulse{0%,100%{box-shadow:0 0 10px rgba(0,255,65,.2)}50%{box-shadow:0 0 16px rgba(0,255,65,.38)}}
    @media (max-width:640px){#pixel-ai-create .card{padding:16px}#pixel-ai-create .actions{gap:8px}#pixel-ai-create button{flex:1 1 auto;min-width:0}}
  `;
  document.head.appendChild(style);
  const launch = document.createElement('button'); launch.id='pixel-ai-create-launch'; launch.type='button'; launch.textContent='✦ AI Create';
  const modal = document.createElement('div'); modal.id='pixel-ai-create'; modal.innerHTML=`<section class="card" role="dialog" aria-modal="true" aria-labelledby="pixel-ai-title"><h2 id="pixel-ai-title"><i class="fas fa-wand-magic-sparkles"></i> AI Create</h2><p>Describe what you want to make in ${spec[0]}. The generated result is previewed before it changes the editor.</p><textarea id="pixel-ai-prompt" placeholder="Describe what you want to create…"></textarea><div class="actions"><button type="button" class="generate"><i class="fas fa-play"></i> Generate preview</button><button type="button" class="apply" disabled><i class="fas fa-check"></i> Apply to editor</button><button type="button" class="close"><i class="fas fa-times"></i> Close</button></div><p class="status" role="status"></p><pre class="preview">Your preview will appear here.</pre></section>`;
  document.body.append(launch,modal);
  const status=modal.querySelector('.status'), preview=modal.querySelector('.preview'), apply=modal.querySelector('.apply');
  let result=null;
  launch.onclick=()=>modal.classList.add('open');
  modal.querySelector('.close').onclick=()=>modal.classList.remove('open');
  modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
  modal.querySelector('.generate').onclick=async()=>{
    try{
      if(!window.PixelAIProvider) throw new Error('AI provider settings are unavailable. Refresh the page and try again.');
      const prompt=modal.querySelector('#pixel-ai-prompt').value.trim();
      if(!prompt) throw new Error('Describe what you want to create first.');
      status.textContent='Generating preview…'; apply.disabled=true;
      let context='';
      if(APP==='pixelPose'&&window.PixelPoseAIContext) context=' Current skeleton nodes: '+JSON.stringify(window.PixelPoseAIContext());
      const text=await window.PixelAIProvider.generateText(`Create ${spec[0]} for this request: ${prompt}.${context} ${spec[1]}`,'You generate safe, valid JSON for a creative editor. Return only one JSON object with no markdown fences.');
      result=JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
      preview.textContent=JSON.stringify(result,null,2); apply.disabled=false; status.textContent='Preview ready. Review it, then apply it to the current document.';
    }catch(error){result=null;preview.textContent='No result.';status.textContent=error.message||String(error)}
  };
  apply.onclick=()=>{
    if(!result)return;
    try{
      if(['pixelArt','pixelText','pixelTilemap','pixelDualTilemaps'].includes(APP)) applyPixelGrid(result,APP);
      else { const adapter=window['PixelAIApply_'+APP]; if(typeof adapter!=='function')throw new Error('The editor AI adapter is not ready. Refresh the page and try again.'); adapter(result); }
      status.textContent='Applied to the editor.';
    }catch(error){status.textContent=error.message||String(error)}
  };
  function applyPixelGrid(data, appId){
    if(!Array.isArray(data.pixels)||!data.pixels.length||!Array.isArray(data.palette)||!data.palette.length)throw new Error('The generated pixel grid is incomplete. Generate another preview.');
    if(appId==='pixelArt'||appId==='pixelText'){
      const s=typeof State!=='undefined'?State:null, cm=typeof CanvasManager!=='undefined'?CanvasManager:null;
      const layer=s?.frames?.[s.currentFrameIndex]?.layers?.[s.activeLayerIndex];
      if(!layer?.data||!cm?.render)throw new Error('Could not find the active drawing layer.');
      const image=layer.data, w=image.width, h=image.height, pixels=data.pixels, palette=data.palette;
      const sourceH=pixels.length, sourceW=Math.max(...pixels.map(row=>Array.isArray(row)?row.length:0));
      if(!sourceW)throw new Error('The generated pixel grid is empty.');
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const index=pixels[Math.floor(y*sourceH/h)]?.[Math.floor(x*sourceW/w)];
        if(index===-1||index===null||index===undefined)continue;
        const color=palette[Number(index)]; if(!color)continue;
        const hex=String(color).replace('#',''); if(!/^[0-9a-f]{6}$/i.test(hex))continue;
        const p=(y*w+x)*4; image.data[p]=parseInt(hex.slice(0,2),16);image.data[p+1]=parseInt(hex.slice(2,4),16);image.data[p+2]=parseInt(hex.slice(4,6),16);image.data[p+3]=255;
      }
      cm.render(); if(typeof InputHandler!=='undefined')InputHandler.saveState?.();
    }else{
      const s=typeof State!=='undefined'?State:null, layer=s?.layers?.[s.activeLayerIndex], canvas=layer?.canvas;
      if(!canvas)throw new Error('Could not find the active tile layer.');
      const ctx=canvas.getContext('2d'), pixels=data.pixels, palette=data.palette;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        const index=pixels[Math.floor(y*pixels.length/canvas.height)]?.[Math.floor(x*Math.max(...pixels.map(r=>r.length))/canvas.width)];
        if(index===-1||index===null||index===undefined)continue;
        const color=palette[Number(index)]; if(color){ctx.fillStyle=color;ctx.fillRect(x,y,1,1)}
      }
      if(typeof TilemapCore!=='undefined')TilemapCore.updatePreviews?.(); s.hasUnsavedChanges=true;
    }
  }
})();
