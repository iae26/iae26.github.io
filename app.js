'use strict';
(() => {
  const data = window.DEMO_DATA;
  const domains = {speech: 'Speech', music: 'Music', audio: 'Sound'};
  const names = {anchored_ae:'Anchored AE',noise_025:'Noise (0.25)',noise_035:'Noise (0.35)',va_vae:'VA-VAE',iae:'IAE',ae_sem:'AE + clean semantic',noise_025_sem:'Noise (0.25) + semantic',noise_035_sem:'Noise (0.35) + semantic'};
  const original = ['anchored_ae','noise_025','noise_035','va_vae','iae'];
  const controls = ['anchored_ae','ae_sem','noise_025_sem','noise_035_sem','iae'];
  const state = {
    generation:{domain:'speech',index:0},
    tokenizer:{domain:'speech',index:0,mode:'interpolation',panel:'original',alpha:'0.50'}
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock = value => `${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
  const icons = '<svg class="play-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5 11 6l-8 4.5z"/></svg><svg class="pause-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1h3v10H2zm5 0h3v10H7z"/></svg>';
  let serial = 0;

  function player(path, method, options={}) {
    const meta = data.audio[path];
    if (!meta) return '';
    const id = `audio-${++serial}`;
    const title = options.label || names[method] || method;
    const fullLabel = `${options.context || ''} ${title}`.trim();
    const bars = meta.peaks.map((p,i) => `<rect x="${i*3}" y="${(32-Math.max(2,p*29))/2}" width="1.6" height="${Math.max(2,p*29)}" rx=".8"/>`).join('');
    const waveform = `<svg viewBox="0 0 192 32" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
    return `<div class="audio-card ${method==='iae'?'ours':''}">
      <div class="method-label"><span>${escape(title)}</span>${method==='iae'?'<span class="ours-badge">Ours</span>':''}</div>
      <div class="player" data-label="${escape(fullLabel)}">
        <audio id="${id}" preload="none" src="${escape(path)}"></audio>
        <button class="play-button" type="button" aria-label="Play ${escape(fullLabel)}" aria-controls="${id}">${icons}</button>
        <div class="wave-container">${waveform}<div class="wave-progress">${waveform}</div><input type="range" min="0" max="${meta.duration}" step="0.01" value="0" aria-label="Seek ${escape(fullLabel)}" aria-controls="${id}" aria-valuetext="0 seconds"></div>
      </div>
      <div class="player-footer"><span><span class="current-time">0:00</span> / ${clock(meta.duration)}</span><a href="${escape(path)}" download aria-label="Download ${escape(fullLabel)}" title="Download WAV">↓</a></div>
    </div>`;
  }

  function header(item, list, scope) {
    return `<div class="sample-header"><div class="sample-context"><span class="sample-badge">${escape(item.dataset||domains[item.category])}</span><span class="sample-id">${escape(item.sample_id)}</span></div><div class="sample-navigation"><button class="arrow-button" data-action="previous" data-scope="${scope}" aria-label="Previous ${scope} example" ${state[scope].index===0?'disabled':''}>‹</button><select data-action="sample" data-scope="${scope}" aria-label="Select ${scope} example">${list.map((r,i)=>`<option value="${i}" ${i===state[scope].index?'selected':''}>Example ${String(i+1).padStart(2,'0')} / ${String(list.length).padStart(2,'0')}</option>`).join('')}</select><button class="arrow-button" data-action="next" data-scope="${scope}" aria-label="Next ${scope} example" ${state[scope].index===list.length-1?'disabled':''}>›</button></div></div>`;
  }
  function generationMarkup(scope) {
    const s=state[scope];
    const list=data.generation.filter(r=>r.category===s.domain&&r.selection_type!=='diagnostic_failure');
    s.index=Math.min(s.index,list.length-1);
    const item=list[s.index];
    if (!item) return '<p class="panel-footnote">No audio is available for this selection.</p>';
    return header(item,list,scope)+
      `<div class="prompt-row"><div><div class="prompt-label">${s.domain==='speech'?'Target transcript':'Text prompt'}</div><p class="prompt-text">${escape(item.text)}</p></div><div class="reference-player">${player(item.reference,'reference',{label:'Dataset reference',context:item.sample_id})}</div></div>`+
      `<div class="audio-grid">${original.map(method=>{const r=item.methods.find(x=>x.method===method);return r?player(r.path,method,{context:item.sample_id}):'';}).join('')}</div>`+
      `<p class="panel-footnote">${s.domain==='speech'?'Transcript-only generation; the reference voice is not a conditioning input.':'Reference audio is provided for context and is not a conditioning input.'}</p>`;
  }
  function tokenizerMarkup(scope) {
    const s=state[scope];
    if(s.mode==='reconstruction') {
      const list=data.reconstruction.filter(r=>r.category===s.domain);
      s.index=Math.min(s.index,list.length-1);
      const item=list[s.index];
      return header(item,list,scope)+`<div class="interp-top"><div><div class="interpolation-formula">x̂ = D(E(x))</div><p class="interp-helper">Clean reconstruction · semantic-supervision controls</p></div><div class="source-player">${player(item.source,'source',{label:'Original source',context:item.sample_id})}</div></div><div style="height:20px"></div><div class="audio-grid">${controls.map(method=>{const r=item.methods.find(x=>x.method===method);return r?player(r.path,method,{context:item.sample_id}):'';}).join('')}</div><p class="panel-footnote">All outputs reconstruct the same source recording. Additional DiT generation results for these controls are forthcoming.</p>`;
    }
    const list=data.interpolation.filter(r=>r.category===s.domain&&r.selection_type!=='diagnostic_failure');
    s.index=Math.min(s.index,list.length-1);
    const item=list[s.index];
    const order=s.panel==='controls'?controls:original;
    const methods=order.map(m=>item.methods.find(r=>r.method===m)).filter(Boolean);
    return header(item,list,scope)+
      `<div class="interp-top"><div><div class="interpolation-formula">z̃ = (1 − α)z + αz<sup>+</sup></div><p class="interp-helper">Decode between the source and its nearest neighbor.</p></div><div class="source-player">${player(item.source,'source',{label:'Original source',context:item.sample_id})}</div></div>`+
      `<div class="panel-controls"><label>Compare<select data-action="panel" data-scope="${scope}" aria-label="${scope} method group"><option value="original" ${s.panel==='original'?'selected':''}>Original methods</option><option value="controls" ${s.panel==='controls'?'selected':''}>Semantic-supervision controls</option></select></label><div class="segmented subtle" role="group" aria-label="${scope} interpolation position"><button data-action="alpha" data-alpha="0.00" data-scope="${scope}" aria-pressed="${s.alpha==='0.00'}">α = 0 · Clean</button><button data-action="alpha" data-alpha="0.50" data-scope="${scope}" aria-pressed="${s.alpha==='0.50'}">α = 0.5 · Midpoint</button></div></div>`+
      `<div class="audio-grid">${methods.map(r=>player(r.audio[s.alpha],r.method,{context:`${item.sample_id}, alpha ${s.alpha}`})).join('')}</div>`+
      `<details class="neighbor-details"><summary>Listen to each model’s retrieved neighbor</summary><p>Neighbors differ across tokenizers. The same source recording is used in every column.</p><div class="audio-grid">${methods.map(r=>player(r.neighbor,r.method,{context:`${item.sample_id}, neighbor`})).join('')}</div></details>`;
  }
  function render(scope) {
    const target=document.getElementById(`${scope}-content`);
    target.querySelectorAll('audio').forEach(a=>a.pause());
    target.innerHTML=scope==='generation'?generationMarkup(scope):tokenizerMarkup(scope);
    document.querySelectorAll(`#${scope}-domain button`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.domain===state[scope].domain)));
    document.querySelectorAll(`#${scope}-mode button`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state[scope].mode)));
  }
  for(const scope of Object.keys(state)) {
    document.getElementById(`${scope}-domain`).innerHTML=Object.entries(domains).map(([k,v])=>`<button type="button" data-domain="${k}" data-scope="${scope}" aria-pressed="${state[scope].domain===k}">${v}</button>`).join('');
    const modes=document.getElementById(`${scope}-mode`);
    if(modes)modes.querySelectorAll('button').forEach(b=>b.dataset.scope=scope);
    render(scope);
  }
  document.addEventListener('click', async event=>{
    const button=event.target.closest('button');
    if(!button) return;
    if(button.classList.contains('play-button')) {
      const p=button.closest('.player'),a=p.querySelector('audio');
      if(!a.paused){a.pause();return;}
      document.querySelectorAll('audio').forEach(other=>{if(other!==a)other.pause();});
      if(a.ended)a.currentTime=0;
      try{await a.play();}catch(error){document.getElementById('player-status').textContent='Unable to play this audio. Try downloading the WAV.';const card=p.closest('.audio-card');if(!card.querySelector('.play-error'))card.insertAdjacentHTML('beforeend','<div class="play-error">Playback unavailable. Download WAV to listen.</div>');}
      return;
    }
    const scope=button.dataset.scope;
    if(!scope) return;
    if(button.dataset.domain){state[scope].domain=button.dataset.domain;state[scope].index=0;}
    if(button.dataset.mode){state[scope].mode=button.dataset.mode;state[scope].index=0;}
    if(button.dataset.action==='previous')state[scope].index--;
    if(button.dataset.action==='next')state[scope].index++;
    if(button.dataset.action==='alpha')state[scope].alpha=button.dataset.alpha;
    const restore=button.dataset.action==='alpha'?`[data-alpha="${button.dataset.alpha}"]`:button.dataset.action==='next'||button.dataset.action==='previous'?`[data-action="${button.dataset.action}"]`:null;
    render(scope);
    if(restore){const replacement=document.querySelector(`#${scope}-content ${restore}`);if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});}
  });
  document.addEventListener('change',event=>{
    const el=event.target,scope=el.dataset.scope;
    if(!scope)return;
    if(el.dataset.action==='sample')state[scope].index=Number(el.value);
    if(el.dataset.action==='panel')state[scope].panel=el.value;
    render(scope);
    document.querySelector(`#${scope}-content [data-action="${el.dataset.action}"]`)?.focus({preventScroll:true});
  });
  document.addEventListener('input',event=>{
    const input=event.target;
    if(!input.matches('.wave-container input'))return;
    const p=input.closest('.player'),a=p.querySelector('audio'),time=Number(input.value);
    p.style.setProperty('--progress',`${time/Number(input.max)*100}%`);
    if(a.readyState>=1)a.currentTime=time;
    else{a.addEventListener('loadedmetadata',()=>{a.currentTime=time;},{once:true});a.load();}
    input.setAttribute('aria-valuetext',`${Math.floor(time)} seconds`);
    p.closest('.audio-card').querySelector('.current-time').textContent=clock(time);
  });
  ['play','pause','ended','timeupdate'].forEach(type=>document.addEventListener(type,event=>{
    if(event.target.tagName!=='AUDIO')return;
    const a=event.target,p=a.closest('.player'),button=p.querySelector('.play-button'),input=p.querySelector('input');
    p.classList.toggle('playing',!a.paused);
    button.setAttribute('aria-label',`${a.paused?'Play':'Pause'} ${p.dataset.label}`);
    if(type==='play')document.getElementById('player-status').textContent=`Playing ${p.dataset.label}`;
    if(type==='timeupdate'||type==='ended'){
      input.value=a.currentTime;
      input.setAttribute('aria-valuetext',`${Math.floor(a.currentTime)} seconds`);
      p.style.setProperty('--progress',`${a.currentTime/Number(input.max)*100}%`);
      p.closest('.audio-card').querySelector('.current-time').textContent=clock(a.currentTime);
    }
  },true));
})();
