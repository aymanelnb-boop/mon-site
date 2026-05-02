// ══════════════════════════════════════════
//  REDIFF PLAYERS & SYNC
// ══════════════════════════════════════════
const rediffPlayers = {}; // {twitch: Twitch.Player}

function launchRediff(){
  if(!selectedVods.length) return;
  
  const welcome = document.getElementById('rediffWelcome');
  const area = document.getElementById('rediffArea');
  const layout = document.getElementById('rediffLayout');
  
  welcome.style.display = 'none';
  area.style.display = 'flex';
  layout.innerHTML = '';
  Object.keys(rediffPlayers).forEach(k => delete rediffPlayers[k]);

  layout.style.cssText = 'display:flex;width:100%;height:calc(100% - 48px);background:#000;overflow:hidden';

  // Barre de contrôles globaux rediff
  const ctrlBar = document.createElement('div');
  ctrlBar.id = 'rediffCtrlBar';
  ctrlBar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:48px;background:rgba(8,8,15,.95);backdrop-filter:blur(10px);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;padding:0 14px;z-index:10;flex-shrink:0';
  ctrlBar.innerHTML = `
    <span style="font-family:'Barlow Condensed',sans-serif;font-size:.65rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted)">📼 MULTI-REDIFF</span>
    <div style="display:flex;align-items:center;gap:5px;padding:3px 8px;background:var(--card2);border:1px solid var(--border);border-radius:8px">
      <button id="rdPlay" onclick="rediffPlayPause()" style="width:28px;height:28px;border-radius:5px;border:1px solid var(--border2);background:var(--card);color:var(--text);cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:all .14s" title="Play/Pause">⏸</button>
      <button id="rdMute" onclick="rediffMuteAll()" style="width:28px;height:28px;border-radius:5px;border:1px solid var(--border2);background:var(--card);color:var(--text);cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:all .14s" title="Mute">🔊</button>
      <div style="width:1px;height:18px;background:var(--border);margin:0 2px"></div>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:.65rem;color:var(--muted)">🔈</span>
      <input type="range" min="0" max="100" value="80" oninput="rediffVolumeAll(this.value)" style="width:70px;height:3px;accent-color:var(--accent);cursor:pointer" title="Volume">
      <div style="width:1px;height:18px;background:var(--border);margin:0 2px"></div>
      <button onclick="rediffSync()" style="padding:3px 10px;border-radius:5px;background:rgba(124,58,237,.18);border:1px solid var(--accent);color:var(--accent2);font-family:'Barlow Condensed',sans-serif;font-size:.7rem;font-weight:700;cursor:pointer;transition:all .14s" title="Synchroniser toutes les VODs sur le stream principal">🔄 Sync</button>
    </div>
    <div style="flex:1"></div>
    <div style="display:flex;gap:4px">
      ${selectedVods.map((v,i)=>`<div style="padding:2px 8px;border-radius:10px;background:${i===0?'rgba(124,58,237,.25)':'rgba(255,255,255,.06)'};border:1px solid ${i===0?'var(--accent)':'var(--border)'};font-family:'Barlow Condensed',sans-serif;font-size:.65rem;font-weight:700;color:${i===0?'var(--accent2)':'var(--muted)'}">${escHtml(v.nom)}</div>`).join('')}
    </div>
    <button onclick="stopRediff()" style="padding:4px 11px;border-radius:5px;border:1px solid var(--border2);background:var(--card);color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;transition:all .14s">✕ Stop</button>
  `;
  area.style.position = 'relative';
  area.appendChild(ctrlBar);

  if(selectedVods.length === 1){
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;height:100%;display:flex';
    const div = document.createElement('div');
    div.id = 'rdplayer-'+selectedVods[0].twitch;
    div.style.cssText = 'flex:1;height:100%';
    wrap.appendChild(div);
    layout.appendChild(wrap);
    setTimeout(()=>{
      rediffPlayers[selectedVods[0].twitch] = new Twitch.Player('rdplayer-'+selectedVods[0].twitch,{
        video: selectedVods[0].vodId, parent:[PARENT], autoplay:true, muted:false, width:'100%', height:'100%'
      });
    },100);
  } else {
    const mainPane = document.createElement('div');
    mainPane.style.cssText = 'width:62%;height:100%;position:relative;flex-shrink:0;background:#0a0a14';
    const mainDiv = document.createElement('div');
    mainDiv.id = 'rdplayer-'+selectedVods[0].twitch;
    mainDiv.style.cssText = 'width:100%;height:100%';
    const mainLabel = document.createElement('div');
    mainLabel.style.cssText = 'position:absolute;top:6px;left:6px;padding:2px 8px;border-radius:4px;background:rgba(124,58,237,.85);font-family:\'Barlow Condensed\',sans-serif;font-size:.68rem;font-weight:700;color:#fff;pointer-events:none;z-index:2;display:flex;align-items:center;gap:4px';
    mainLabel.innerHTML = '★ '+escHtml(selectedVods[0].nom);
    mainPane.appendChild(mainDiv);
    mainPane.appendChild(mainLabel);

    const vsplitter = document.createElement('div');
    vsplitter.style.cssText = 'width:4px;flex-shrink:0;background:rgba(255,255,255,.04);border-left:1px solid var(--border);cursor:col-resize';

    const secPane = document.createElement('div');
    secPane.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;background:#000';

    selectedVods.slice(1).forEach((v,i)=>{
      if(i>0){
        const hs = document.createElement('div');
        hs.style.cssText = 'height:4px;flex-shrink:0;background:rgba(255,255,255,.04);border-top:1px solid var(--border)';
        secPane.appendChild(hs);
      }
      const box = document.createElement('div');
      box.style.cssText = 'flex:1;position:relative;background:#0a0a14;min-height:60px';
      const div = document.createElement('div');
      div.id = 'rdplayer-'+v.twitch;
      div.style.cssText = 'width:100%;height:100%';
      const label = document.createElement('div');
      label.style.cssText = 'position:absolute;top:6px;left:6px;padding:2px 8px;border-radius:4px;background:rgba(0,0,0,.75);font-family:\'Barlow Condensed\',sans-serif;font-size:.68rem;font-weight:700;color:#fff;pointer-events:none;z-index:2';
      label.textContent = v.nom;
      box.appendChild(div);
      box.appendChild(label);
      secPane.appendChild(box);
    });

    layout.appendChild(mainPane);
    layout.appendChild(vsplitter);
    layout.appendChild(secPane);

    setTimeout(()=>{
      selectedVods.forEach((v,i)=>{
        rediffPlayers[v.twitch] = new Twitch.Player('rdplayer-'+v.twitch,{
          video: v.vodId, parent:[PARENT], autoplay:true, muted:i>0, width:'100%', height:'100%'
        });
      });
    },100);
  }

  closeVodPanel();
  showToast('📼 Multi-rediff lancé !');
}

let rediffPaused = false;
let rediffMuted = false;

function rediffPlayPause(){
  rediffPaused = !rediffPaused;
  const btn = document.getElementById('rdPlay');
  Object.values(rediffPlayers).forEach(p => { rediffPaused ? p.pause() : p.play(); });
  if(btn) btn.textContent = rediffPaused ? '▶' : '⏸';
  showToast(rediffPaused ? '⏸ Pause' : '▶ Lecture');
}

function rediffMuteAll(){
  rediffMuted = !rediffMuted;
  const btn = document.getElementById('rdMute');
  Object.values(rediffPlayers).forEach(p => p.setMuted(rediffMuted));
  if(btn) btn.textContent = rediffMuted ? '🔇' : '🔊';
  showToast(rediffMuted ? '🔇 Mutés' : '🔊 Son activé');
}

function rediffVolumeAll(val){
  const v = parseInt(val)/100;
  Object.values(rediffPlayers).forEach(p => { p.setVolume(v); p.setMuted(v===0); });
}

function rediffSync(){
  if(!selectedVods.length) return;
  const main = rediffPlayers[selectedVods[0].twitch];
  if(!main) return;
  try {
    const t = main.getCurrentTime();
    selectedVods.slice(1).forEach(v => {
      const p = rediffPlayers[v.twitch];
      if(p) p.seek(t);
    });
    showToast('🔄 VODs synchronisées !');
  } catch(e) {
    showToast('⚠️ Sync impossible (VODs pas encore chargées)');
  }
}

function stopRediff(){
  Object.keys(rediffPlayers).forEach(k => delete rediffPlayers[k]);
  rediffPaused = false;
  rediffMuted = false;
  document.getElementById('rediffArea').style.display = 'none';
  document.getElementById('rediffArea').innerHTML = '';
  const layout = document.getElementById('rediffLayout');
  if(layout) layout.innerHTML = '';
  document.getElementById('rediffWelcome').style.display = 'flex';
}
