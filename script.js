// ══════════════════════════════════════════
//  OWNER CONFIG
// ══════════════════════════════════════════
const OWNER_EMAIL = 'aymane.lnb@gmail.com';
const GRADES = [
  { id:'owner',   label:'👑 Owner',   color:'#f59e0b', bg:'rgba(245,158,11,.15)', border:'rgba(245,158,11,.4)' },
  { id:'admin',   label:'🛡️ Admin',   color:'#a855f7', bg:'rgba(168,85,247,.15)', border:'rgba(168,85,247,.4)' },
  { id:'mod',     label:'🔧 Mod',     color:'#3b82f6', bg:'rgba(59,130,246,.15)', border:'rgba(59,130,246,.4)' },
  { id:'vip',     label:'⚡ VIP',     color:'#ec4899', bg:'rgba(236,72,153,.15)', border:'rgba(236,72,153,.4)' },
  { id:'premium', label:'💎 Premium', color:'#14b8a6', bg:'rgba(20,184,166,.15)', border:'rgba(20,184,166,.4)' },
  { id:'member',  label:'👤 Membre',  color:'#6b6b8a', bg:'rgba(107,107,138,.1)', border:'rgba(107,107,138,.3)' },
];
function getGrade(id){ return GRADES.find(g=>g.id===id)||GRADES[GRADES.length-1]; }

function shareSession(){
  if(!selected.length){showToast('Sélectionne des streams d\'abord !');return;}
  const url=new URL(window.location.href);
  url.searchParams.set('streams',selected.join(','));
  navigator.clipboard.writeText(url.toString()).then(()=>showToast('🔗 Lien copié !')).catch(()=>{prompt('Copie ce lien :',url.toString());});
}
function loadSharedSession(){
  const params=new URLSearchParams(window.location.search);
  const shared=params.get('streams');
  if(!shared)return;
  const ids=shared.split(',').filter(Boolean);
  if(!ids.length)return;
  ids.forEach(id=>{if(!streamers.find(s=>s.twitch===id))streamers.push({twitch:id,nom:id});});
  selected=ids.slice(0,10);
  saveState();render();
  setTimeout(()=>launchStreams(),1500);
  history.replaceState(null,'',window.location.pathname);
}

// ══════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════
function getCurrentTheme(){ return document.documentElement.getAttribute('data-theme')||'dark'; }
function toggleTheme(){
  const next = getCurrentTheme()==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('ms_theme',next);
  const mIcon=document.getElementById('mnavThemeIcon');
  if(mIcon)mIcon.textContent=next==='dark'?'☀️':'🌙';
}
function initTheme(){
  const saved=localStorage.getItem('ms_theme')||'dark';
  document.documentElement.setAttribute('data-theme',saved);
  const mIcon=document.getElementById('mnavThemeIcon');
  if(mIcon)mIcon.textContent=saved==='dark'?'☀️':'🌙';
}
initTheme();

// ══════════════════════════════════════════
//  POPULAIRES FR
// ══════════════════════════════════════════
const POPULAR_FR = [
  {twitch:'squeezie',nom:'Squeezie'},{twitch:'zerator',nom:'ZeratoR'},
  {twitch:'domingo',nom:'Domingo'},{twitch:'kameto',nom:'Kameto'},
  {twitch:'gotaga',nom:'Gotaga'},{twitch:'mistermv',nom:'MisterMV'},
  {twitch:'maghla',nom:'Maghla'},{twitch:'etoiles',nom:'Etoiles'},
  {twitch:'ponce',nom:'Ponce'},{twitch:'baghera',nom:'Baghera'},
  {twitch:'skyyart',nom:'Skyyart'},{twitch:'horty',nom:'Horty'},
  {twitch:'alderiate',nom:'Alderiate'},{twitch:'locklear',nom:'Locklear'},
  {twitch:'valouzz',nom:'Valouzz'},{twitch:'ipromx',nom:'iProMx'},
  {twitch:'rivenzi',nom:'Rivenzi'},{twitch:'blitzstream',nom:'Blitzstream'},
  {twitch:'neekosofficial',nom:'Neekos'},{twitch:'otplol',nom:'OtpLol'},
];
const CAT_COLORS = ['#7c3aed','#a855f7','#ef4444','#f59e0b','#22c55e','#3b82f6','#ec4899','#14b8a6','#f97316','#8b5cf6'];
const PREFS_KEY = 'ms_prefs';

// ══════════════════════════════════════════
//  ÉTAT
// ══════════════════════════════════════════
let streamers=[], categories=[], selected=[], avatarCache={};
let liveData={}, liveset=new Set(), prevLiveset=new Set();
let popularLiveData={};
const TWITCH_CLIENT_ID='3ahij1el6hqbrnozq18kjtk01annpd';
const TWITCH_CLIENT_SECRET='2yaaw7p57xrhm825lzpwql6577q1n5';
let twitchToken=null;
let refreshCountdown=60, refreshTimer=null, countdownTimer=null;
let isStreamsLaunched=false, fsMode=false, chatOpen=false, mainPct=62;
let editingTwitch=null, currentUser=null, firestoreUnsub=null, saveDebounce=null;
const activeIframes={};
const twitchPlayers={};
const PARENT=location.hostname||'localhost';
const isMobile=()=>window.innerWidth<=768;
let isOwner=false;
let globalMuted=false, globalPaused=false;
let twitchUserToken=null;
const TWITCH_REDIRECT=encodeURIComponent('https://aymanelnb-boop.github.io/mon-site/');
const TWITCH_SCOPES='user:read:subscriptions';

// ══════════════════════════════════════════
//  TWITCH CONNECT
// ══════════════════════════════════════════
function connectTwitchAccount(){
  const url=`https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${TWITCH_REDIRECT}&response_type=token&scope=${TWITCH_SCOPES}&force_verify=true`;
  window.open(url,'_self');
}
function disconnectTwitchAccount(){
  twitchUserToken=null;
  localStorage.removeItem('ms_twitch_token');
  localStorage.removeItem('ms_twitch_user');
  document.getElementById('twitchConnectBtn').innerHTML='🔗 Connecter mon compte Twitch';
  document.getElementById('twitchConnectBtn').onclick=connectTwitchAccount;
  document.getElementById('twitchAccountInfo').style.display='none';
  showToast('Compte Twitch déconnecté');
  Object.keys(activeIframes).forEach(id=>{
    if(activeIframes[id].tagName==='IFRAME'){
      activeIframes[id].src=makeIframeSrc(id,true);
    }
  });
}
function checkTwitchCallback(){
  const hash=window.location.hash;
  if(!hash.includes('access_token'))return;
  const params=new URLSearchParams(hash.replace('#',''));
  const token=params.get('access_token');
  if(!token)return;
  twitchUserToken=token;
  localStorage.setItem('ms_twitch_token',token);
  history.replaceState(null,'',window.location.pathname);
  fetch('https://api.twitch.tv/helix/users',{
    headers:{'Client-ID':TWITCH_CLIENT_ID,'Authorization':'Bearer '+token}
  }).then(r=>r.json()).then(d=>{
    if(d.data&&d.data[0]){
      const u=d.data[0];
      localStorage.setItem('ms_twitch_user',JSON.stringify(u));
      updateTwitchConnectUI(u);
      showToast('✅ Compte Twitch connecté : '+u.display_name);
      reloadStreamsWithToken();
    }
  }).catch(()=>{});
}
function updateTwitchConnectUI(user){
  const btn=document.getElementById('twitchConnectBtn');
  const info=document.getElementById('twitchAccountInfo');
  if(!btn||!info)return;
  if(user){
    btn.innerHTML='🔓 Déconnecter Twitch';
    btn.onclick=disconnectTwitchAccount;
    info.style.display='flex';
    info.innerHTML=`<img src="${user.profile_image_url}" style="width:22px;height:22px;border-radius:50%;flex-shrink:0"><span style="font-family:'Barlow Condensed',sans-serif;font-size:.75rem;font-weight:700;color:var(--online)">${user.display_name}</span><span style="font-family:'Barlow Condensed',sans-serif;font-size:.65rem;color:var(--muted)">connecté</span>`;
  }
}
function reloadStreamsWithToken(){
  if(!twitchUserToken||!isStreamsLaunched)return;
  Object.keys(activeIframes).forEach(id=>{
    if(activeIframes[id].tagName==='IFRAME'){
      activeIframes[id].src=`https://player.twitch.tv/?channel=${id}&parent=${PARENT}&autoplay=true&muted=false&oauth_token=${twitchUserToken}`;
    }
  });
}
function initTwitchConnect(){
  checkTwitchCallback();
  const saved=localStorage.getItem('ms_twitch_token');
  const savedUser=localStorage.getItem('ms_twitch_user');
  if(saved){
    twitchUserToken=saved;
    if(savedUser){
      try{
        updateTwitchConnectUI(JSON.parse(savedUser));
        showToast('✅ Twitch reconnecté automatiquement !');
      }catch(e){
        localStorage.removeItem('ms_twitch_token');
        localStorage.removeItem('ms_twitch_user');
        twitchUserToken=null;
      }
    }
  }
}

// ══════════════════════════════════════════
//  LOCALSTORAGE
// ══════════════════════════════════════════
function lsGet(k,d){try{const v=localStorage.getItem(k);return v!=null?JSON.parse(v):d}catch{return d}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
function saveState(){lsSet('ms_sel',selected)}
function saveHistory(){
  if(!selected.length)return;
  let h=lsGet('ms_history',[]);
  const entry={ids:[...selected],date:new Date().toLocaleDateString('fr-FR')};
  h=h.filter(e=>JSON.stringify(e.ids)!==JSON.stringify(entry.ids));
  h.unshift(entry);if(h.length>5)h=h.slice(0,5);
  lsSet('ms_history',h);
}
function renderHistory(){
  const h=lsGet('ms_history',[]);
  const el=document.getElementById('historyList');if(!el)return;
  if(!h.length){el.innerHTML='<div style="font-size:.72rem;color:var(--muted);font-style:italic;padding:4px 7px">Aucun historique</div>';return;}
  el.innerHTML='';
  h.forEach((entry)=>{
    const names=entry.ids.map(id=>{const s=streamers.find(x=>x.twitch===id);return s?s.nom:id;}).join(', ');
    const div=document.createElement('div');
    div.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:5px 7px;border-bottom:1px solid var(--border);cursor:pointer;font-size:.72rem;gap:6px';
    div.innerHTML=`<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${names}</div><div style="font-size:.6rem;color:var(--muted);flex-shrink:0">${entry.date}</div><button style="background:rgba(124,58,237,.15);border:1px solid var(--accent);color:var(--accent2);border-radius:4px;font-family:'Barlow Condensed',sans-serif;font-size:.65rem;font-weight:700;cursor:pointer;padding:2px 7px;flex-shrink:0">▶</button>`;
    div.querySelector('button').onclick=(e)=>{e.stopPropagation();selected=[...entry.ids.filter(id=>streamers.find(s=>s.twitch===id))];saveState();render();launchStreams();showToast('▶ Session relancée !');};
    el.appendChild(div);
  });
}
function saveAvatars(){lsSet('ms_av',avatarCache)}
function saveCats(){lsSet('ms_cats',categories)}
function loadState(){selected=lsGet('ms_sel',[]);avatarCache=lsGet('ms_av',{});categories=lsGet('ms_cats',[]);}
function getPrefs(){return lsGet(PREFS_KEY,{});}
function savePref(k,v){const p=getPrefs();p[k]=v;lsSet(PREFS_KEY,p);}

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
function showForgotPanel(){
  document.getElementById('loginForm').style.display='none';
  document.getElementById('authTabsBar').style.display='none';
  document.getElementById('forgotPanel').classList.add('show');
  document.getElementById('forgotEmail').value=document.getElementById('loginEmail').value||'';
  ['forgotError','forgotSuccess'].forEach(id=>document.getElementById(id).classList.remove('show'));
}
function hideForgotPanel(){
  document.getElementById('forgotPanel').classList.remove('show');
  document.getElementById('loginForm').style.display='flex';
  document.getElementById('authTabsBar').style.display='flex';
}
async function doForgotPassword(){
  const auth=window._auth,fb=window._fb;if(!auth||!fb)return;
  const email=document.getElementById('forgotEmail').value.trim();
  const errEl=document.getElementById('forgotError'),sucEl=document.getElementById('forgotSuccess');
  errEl.classList.remove('show');sucEl.classList.remove('show');
  if(!email){errEl.textContent='Saisis ton email.';errEl.classList.add('show');return;}
  const btn=document.getElementById('forgotBtn'),sp=document.getElementById('forgotSpinner');
  btn.disabled=true;sp.classList.add('show');
  try{await fb.sendPasswordResetEmail(auth,email);sucEl.textContent='✓ Email envoyé !';sucEl.classList.add('show');}
  catch(e){errEl.textContent=e.message;errEl.classList.add('show');}
  finally{btn.disabled=false;sp.classList.remove('show');}
}
function switchAuthTab(tab){
  hideForgotPanel();
  document.getElementById('tabLogin').classList.toggle('active',tab==='login');
  document.getElementById('tabRegister').classList.toggle('active',tab==='register');
  document.getElementById('loginForm').style.display=tab==='login'?'flex':'none';
  document.getElementById('registerForm').style.display=tab==='register'?'flex':'none';
  ['loginError','registerError','registerSuccess'].forEach(id=>document.getElementById(id).classList.remove('show'));
}
function authErrFR(code){
  const map={'auth/invalid-email':'Email invalide.','auth/user-not-found':'Aucun compte.','auth/wrong-password':'Mot de passe incorrect.','auth/email-already-in-use':'Email déjà utilisé.','auth/weak-password':'Mot de passe trop court.','auth/too-many-requests':'Trop de tentatives.','auth/invalid-credential':'Email ou mot de passe incorrect.'};
  return map[code]||'Erreur : '+code;
}
async function doLogin(){
  const auth=window._auth,fb=window._fb;if(!auth||!fb)return;
  const email=document.getElementById('loginEmail').value.trim(),pw=document.getElementById('loginPassword').value;
  const errEl=document.getElementById('loginError');errEl.classList.remove('show');
  if(!email||!pw){errEl.textContent='Remplis tous les champs.';errEl.classList.add('show');return;}
  const btn=document.getElementById('loginBtn'),sp=document.getElementById('loginSpinner');
  btn.disabled=true;sp.classList.add('show');
  try{await fb.signInWithEmailAndPassword(auth,email,pw);}
  catch(e){errEl.textContent=authErrFR(e.code);errEl.classList.add('show');}
  finally{btn.disabled=false;sp.classList.remove('show');}
}
async function doRegister(){
  const auth=window._auth,fb=window._fb;if(!auth||!fb)return;
  const username=document.getElementById('regUsername').value.trim(),email=document.getElementById('regEmail').value.trim(),pw=document.getElementById('regPassword').value;
  const errEl=document.getElementById('registerError'),sucEl=document.getElementById('registerSuccess');
  errEl.classList.remove('show');sucEl.classList.remove('show');
  if(!username||!email||!pw){errEl.textContent='Remplis tous les champs.';errEl.classList.add('show');return;}
  const btn=document.getElementById('registerBtn'),sp=document.getElementById('registerSpinner');
  btn.disabled=true;sp.classList.add('show');
  try{
    const cred=await fb.createUserWithEmailAndPassword(auth,email,pw);
    await fb.updateProfile(cred.user,{displayName:username});
    await cloudSaveData(cred.user.uid,{streamers:[],avatars:{},categories:[],grade:'member',email});
    sucEl.textContent='✓ Compte créé ! Bienvenue '+username+' !';sucEl.classList.add('show');
  }catch(e){errEl.textContent=authErrFR(e.code);errEl.classList.add('show');}
  finally{btn.disabled=false;sp.classList.remove('show');}
}
async function doLogout(){
  const auth=window._auth,fb=window._fb;if(!auth||!fb)return;
  if(firestoreUnsub){firestoreUnsub();firestoreUnsub=null;}
  await fb.signOut(auth);currentUser=null;streamers=[];selected=[];categories=[];isOwner=false;
  document.getElementById('authOverlay').classList.remove('hidden');
  document.getElementById('userPanel').style.display='none';
  document.getElementById('ownerGradeBtn').classList.remove('show');
  document.getElementById('gradeBadgeHeader').classList.remove('show');
  showToast('👋 Déconnecté');
}

// ══════════════════════════════════════════
//  FIRESTORE
// ══════════════════════════════════════════
async function cloudSaveData(uid,data){
  const db=window._db,fb=window._fb;if(!db||!fb)return;
  try{setSyncDot(true);await fb.setDoc(fb.doc(db,'users',uid),data,{merge:true});setSyncDot(false);}
  catch(e){setSyncDot(false);}
}
function scheduleSave(){
  if(!currentUser)return;setSyncDot(true);
  if(saveDebounce)clearTimeout(saveDebounce);
  saveDebounce=setTimeout(()=>cloudSaveData(currentUser.uid,{streamers,avatars:avatarCache,categories}),1500);
}
function setSyncDot(syncing){const d=document.getElementById('userSync');if(d)d.classList.toggle('syncing',syncing);}
function listenUser(uid){
  const db=window._db,fb=window._fb;if(!db||!fb)return;
  if(firestoreUnsub){firestoreUnsub();firestoreUnsub=null;}
  firestoreUnsub=fb.onSnapshot(fb.doc(db,'users',uid),(snap)=>{
    if(snap.exists()){
      const data=snap.data();
      if(data.streamers)streamers=[...data.streamers];
      if(data.avatars)avatarCache={...data.avatars};
      if(data.categories)categories=[...data.categories];
      if(data.grade){
        const g=getGrade(data.grade);
        const el=document.getElementById('gradeBadgeHeader');
        el.textContent=g.label;
        el.style.cssText=`background:${g.bg};border:1px solid ${g.border};color:${g.color}`;
        if(isOwner)el.classList.add('show');
      }
      render();renderPopularGrid();
    }
  });
}

// ══════════════════════════════════════════
//  GRADE SYSTEM
// ══════════════════════════════════════════
function toggleGradePanel(){
  const panel=document.getElementById('gradePanel');
  const isOpen=panel.classList.contains('open');
  if(isOpen)panel.classList.remove('open');
  else{panel.classList.add('open');loadGradePanel();}
}
async function loadGradePanel(){
  const body=document.getElementById('gradePanelBody');
  body.innerHTML='<div class="grade-loading">Chargement…</div>';
  const db=window._db,fb=window._fb;if(!db||!fb){body.innerHTML='<div class="grade-loading">Firebase non disponible</div>';return;}
  try{
    const snap=await fb.getDocs(fb.collection(db,'users'));
    const users=[];snap.forEach(doc=>{const d=doc.data();users.push({uid:doc.id,...d});});
    body.innerHTML='';
    const statsRow=document.createElement('div');statsRow.className='grade-stats-row';
    statsRow.innerHTML=`<div class="grade-stat-card"><div class="grade-stat-num">${users.length}</div><div class="grade-stat-label">Membres</div></div><div class="grade-stat-card"><div class="grade-stat-num">${users.filter(u=>u.grade==='vip'||u.grade==='premium'||u.grade==='admin').length}</div><div class="grade-stat-label">VIP/Admin</div></div>`;
    body.appendChild(statsRow);
    const list=document.createElement('div');list.className='grade-user-list';
    users.sort((a,b)=>{const order=['owner','admin','mod','vip','premium','member'];return(order.indexOf(a.grade||'member'))-(order.indexOf(b.grade||'member'));});
    users.forEach(u=>{
      const g=getGrade(u.grade||'member');
      const item=document.createElement('div');item.className='grade-user-item';
      const name=u.displayName||u.email||u.uid.slice(0,8);
      item.innerHTML=`<div class="grade-user-av">${name[0].toUpperCase()}</div><div class="grade-user-info"><div class="grade-user-name">${escHtml(name)}</div><div class="grade-user-meta">${u.email||''}</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px"><span class="grade-badge" style="background:${g.bg};border:1px solid ${g.border};color:${g.color}">${g.label}</span><select class="grade-select" style="font-size:.6rem;padding:2px 5px" onchange="setUserGrade('${u.uid}',this.value)">${GRADES.map(gr=>`<option value="${gr.id}"${(u.grade||'member')===gr.id?' selected':''}>${gr.label}</option>`).join('')}</select></div>`;
      list.appendChild(item);
    });
    body.appendChild(list);
    if(!users.length){const empty=document.createElement('div');empty.className='grade-loading';empty.textContent='Aucun utilisateur';body.appendChild(empty);}
  }catch(e){body.innerHTML='<div class="grade-loading">Erreur : '+e.message+'</div>';}
}
async function setUserGrade(uid,gradeId){
  const db=window._db,fb=window._fb;if(!db||!fb)return;
  try{await fb.setDoc(fb.doc(db,'users',uid),{grade:gradeId},{merge:true});showToast('✅ Grade mis à jour !');}
  catch(e){showToast('Erreur : '+e.message);}
}

// ══════════════════════════════════════════
//  INIT APP
// ══════════════════════════════════════════
window._initApp = function(){
  const auth=window._auth,fb=window._fb;
  if(!auth){document.getElementById('loadingScreen').classList.add('hidden');loadState();startApp();return;}
  fb.onAuthStateChanged(auth,async(user)=>{
    if(user){
      currentUser=user;isOwner=(user.email===OWNER_EMAIL);
      document.getElementById('authOverlay').classList.add('hidden');
      document.getElementById('loadingScreen').classList.add('hidden');
      const up=document.getElementById('userPanel');if(up)up.style.display='flex';
      document.getElementById('userAvatar').textContent=(user.displayName||user.email||'?')[0].toUpperCase();
      document.getElementById('userName').textContent=user.displayName||user.email||'';
      if(isOwner){
        document.getElementById('ownerGradeBtn').classList.add('show');
        try{
          const db=window._db;const fb2=window._fb;
          const snap=await fb2.getDoc(fb2.doc(db,'users',user.uid));
          if(!snap.exists()||snap.data().grade!=='owner')await fb2.setDoc(fb2.doc(db,'users',user.uid),{grade:'owner',email:user.email,displayName:user.displayName||'Owner'},{merge:true});
        }catch(e){}
      }
      listenUser(user.uid);loadState();startApp();
    }else{
      currentUser=null;isOwner=false;
      document.getElementById('loadingScreen').classList.add('hidden');
      document.getElementById('authOverlay').classList.remove('hidden');
      document.getElementById('userPanel').style.display='none';
      document.getElementById('ownerGradeBtn').classList.remove('show');
      if(firestoreUnsub){firestoreUnsub();firestoreUnsub=null;}
    }
  });
};
if(window._firebaseReady)window._initApp();

function startApp(){
  initTwitchConnect();
  fetchLiveStatus();
  refreshTimer=setInterval(fetchLiveStatus,60000);
  startCountdown();renderPopularGrid();render();renderHistory();
  setTimeout(fetchPopularAvatars,800);
  loadSharedSession();
}

// ══════════════════════════════════════════
//  TWITCH API
// ══════════════════════════════════════════
async function getTwitchToken(){
  const r=await fetch('https://id.twitch.tv/oauth2/token?client_id='+TWITCH_CLIENT_ID+'&client_secret='+TWITCH_CLIENT_SECRET+'&grant_type=client_credentials',{method:'POST'});
  return (await r.json()).access_token;
}
async function fetchLiveStatus(){
  const dot=document.getElementById('refreshDot'),lbl=document.getElementById('refreshLabel');
  if(dot)dot.classList.add('refreshing');if(lbl)lbl.textContent='Màj…';
  try{
    if(!twitchToken)twitchToken=await getTwitchToken();
    const allLogins=[...new Set([...streamers.map(s=>s.twitch),...POPULAR_FR.map(s=>s.twitch)])];
    if(!allLogins.length){render();return;}
    const logins=allLogins.map(l=>'user_login='+l).join('&');
    const r=await fetch('https://api.twitch.tv/helix/streams?'+logins+'&first=100',{headers:{'Client-ID':TWITCH_CLIENT_ID,'Authorization':'Bearer '+twitchToken}});
    if(r.status===401){twitchToken=null;return fetchLiveStatus();}
    const d=await r.json();
    prevLiveset=new Set(liveset);liveData={};liveset=new Set();popularLiveData={};
    (d.data||[]).forEach(s=>{
      const l=s.user_login.toLowerCase();
      liveData[l]=s;liveset.add(l);
      if(POPULAR_FR.find(p=>p.twitch===l))popularLiveData[l]=s;
    });
    liveset.forEach(login=>{if(!prevLiveset.has(login)&&prevLiveset.size>0){const s=streamers.find(x=>x.twitch===login)||{nom:login};showNewLiveToast(s);}});
    render();renderPopularGrid();resetCountdown();
  }catch(e){console.warn('Twitch:',e);}
  finally{if(dot)dot.classList.remove('refreshing');if(lbl)lbl.textContent='Live';}
}
function resetCountdown(){refreshCountdown=60;updateCd();}
function startCountdown(){if(countdownTimer)clearInterval(countdownTimer);countdownTimer=setInterval(()=>{refreshCountdown=Math.max(0,refreshCountdown-1);updateCd();},1000);}
function updateCd(){const el=document.getElementById('refreshCd');if(el)el.textContent=refreshCountdown+'s';}
function getViewers(t){return liveData[t]?liveData[t].viewer_count:0;}
function getGame(t){return liveData[t]?liveData[t].game_name:'';}
function getTitle(t){return liveData[t]?liveData[t].title:'';}
function getThumbnail(t){if(!liveData[t]||!liveData[t].thumbnail_url)return null;return liveData[t].thumbnail_url.replace('{width}','440').replace('{height}','248');}
function fmtV(n){return n>=1000?(n/1000).toFixed(1).replace('.0','')+'k':String(n);}
let nlTimer=null;
function showNewLiveToast(s){
  const t=document.getElementById('newLiveToast'),m=document.getElementById('newLiveToastMsg');
  if(!t||!m)return;m.textContent=s.nom+' vient de commencer !';t.classList.add('show');
  if(nlTimer)clearTimeout(nlTimer);nlTimer=setTimeout(()=>t.classList.remove('show'),5000);
}

// ══════════════════════════════════════════
//  RECHERCHE TWITCH
// ══════════════════════════════════════════
async function searchTwitch(query){
  if(!query.trim())return null;
  try{
    if(!twitchToken)twitchToken=await getTwitchToken();
    const [rExact,rSearch]=await Promise.all([
      fetch('https://api.twitch.tv/helix/users?login='+encodeURIComponent(query.trim().toLowerCase()),{headers:{'Client-ID':TWITCH_CLIENT_ID,'Authorization':'Bearer '+twitchToken}}),
      fetch('https://api.twitch.tv/helix/search/channels?query='+encodeURIComponent(query)+'&first=6&live_only=false',{headers:{'Client-ID':TWITCH_CLIENT_ID,'Authorization':'Bearer '+twitchToken}})
    ]);
    const [dExact,dSearch]=await Promise.all([rExact.json(),rSearch.json()]);
    const results=[];const seen=new Set();
    if(dExact.data&&dExact.data[0]){
      const u=dExact.data[0];seen.add(u.login.toLowerCase());
      const si=liveData[u.login.toLowerCase()];
      results.push({twitch:u.login.toLowerCase(),nom:u.display_name,avatar:u.profile_image_url,isLive:!!si,viewers:si?si.viewer_count:0,game:si?si.game_name:''});
    }
    if(dSearch.data){dSearch.data.forEach(ch=>{
      const login=ch.broadcaster_login.toLowerCase();if(seen.has(login))return;seen.add(login);
      const si=liveData[login];
      results.push({twitch:login,nom:ch.display_name,avatar:ch.thumbnail_url||null,isLive:ch.is_live||!!si,viewers:si?si.viewer_count:0,game:ch.game_name||''});
    });}
    return results;
  }catch(e){return [];}
}
async function doSbSearch(){
  const q=document.getElementById('sbSearchInput').value.trim();if(!q)return;
  const btn=document.getElementById('sbSearchBtn');btn.disabled=true;btn.textContent='…';
  const res=document.getElementById('sbResults'),list=document.getElementById('sbResultsList'),title=document.getElementById('sbResultsTitle');
  list.innerHTML='<div class="search-loading">Recherche…</div>';res.classList.remove('hidden');
  try{
    const results=await searchTwitch(q);
    if(!results||!results.length){list.innerHTML='<div class="search-empty">Aucun résultat</div>';return;}
    title.textContent=results.length+' résultat(s)';list.innerHTML='';
    results.forEach(r=>{
      const isAdded=streamers.find(s=>s.twitch===r.twitch);
      const div=document.createElement('div');div.className='search-result-item';
      const avHtml=r.avatar?`<div class="sr-av"><img src="${r.avatar}" alt="${r.nom}" onerror="this.style.display='none'"></div>`:`<div class="sr-av-ph">${r.nom[0]}</div>`;
      const subHtml=r.isLive?`<div style="font-size:.65rem;color:var(--online);margin-top:1px"><span class="sr-live-dot"></span>EN LIVE · ${fmtV(r.viewers)}</div>`:`<div style="font-size:.65rem;color:var(--muted);margin-top:1px">Hors ligne</div>`;
      div.innerHTML=`${avHtml}<div class="s-info"><div class="sr-name">${r.nom}</div>${subHtml}</div><button class="sr-add-btn${isAdded?' added':''}" ${isAdded?'disabled':''}>${isAdded?'✓ Ajouté':'+ Ajouter'}</button>`;
      if(!isAdded){div.querySelector('button').onclick=(e)=>{e.stopPropagation();addStreamer(r);div.querySelector('button').textContent='✓ Ajouté';div.querySelector('button').className='sr-add-btn added';div.querySelector('button').disabled=true;};}
      list.appendChild(div);
    });
  }catch(e){list.innerHTML='<div class="search-empty">Erreur</div>';}
  finally{btn.disabled=false;btn.textContent='Go';}
}
function closeSbResults(){document.getElementById('sbResults').classList.add('hidden');document.getElementById('sbSearchInput').value='';}
async function doWelcomeSearch(){
  const q=document.getElementById('welcomeSearchInput').value.trim();if(!q)return;
  const btn=document.getElementById('welcomeSearchBtn');btn.disabled=true;btn.textContent='Recherche…';
  const res=document.getElementById('welcomeResults'),list=document.getElementById('welcomeResultsList'),title=document.getElementById('welcomeResultsTitle');
  list.innerHTML='<div class="search-loading">Recherche en cours…</div>';res.classList.remove('hidden');
  try{
    const results=await searchTwitch(q);
    if(!results||!results.length){list.innerHTML='<div class="search-empty">Aucun résultat pour "'+q+'"</div>';return;}
    title.textContent=results.length+' résultat(s)';list.innerHTML='';
    results.forEach(r=>{
      const div=document.createElement('div');div.className='welcome-result-item';
      const avHtml=r.avatar?`<div class="wr-av"><img src="${r.avatar}" alt="${r.nom}" onerror="this.style.display='none'"></div>`:`<div class="wr-av-ph">${r.nom[0]}</div>`;
      const isAdded=streamers.find(s=>s.twitch===r.twitch);
      const statusHtml=r.isLive?`<div class="wr-status live"><span class="live-dot" style="width:5px;height:5px;margin-right:4px"></span>EN LIVE · ${fmtV(r.viewers)}</div>`:`<div class="wr-status">Hors ligne</div>`;
      div.innerHTML=`${avHtml}<div class="wr-info"><div class="wr-name">${r.nom}</div>${statusHtml}</div><button class="wr-add-btn${isAdded?' added':''}" ${isAdded?'disabled':''}>${isAdded?'✓ Ajouté':'+ Ajouter'}</button>`;
      if(!isAdded){div.querySelector('button').onclick=()=>{addStreamer(r);div.querySelector('button').textContent='✓ Ajouté';div.querySelector('button').className='wr-add-btn added';div.querySelector('button').disabled=true;};}
      list.appendChild(div);
    });
  }catch(e){list.innerHTML='<div class="search-empty">Erreur de recherche</div>';}
  finally{btn.disabled=false;btn.textContent='🔍 Rechercher';}
}
function closeWelcomeResults(){document.getElementById('welcomeResults').classList.add('hidden');document.getElementById('welcomeSearchInput').value='';}

// ══════════════════════════════════════════
//  POPULAIRES
// ══════════════════════════════════════════
async function fetchPopularAvatars(){
  try{
    if(!twitchToken)twitchToken=await getTwitchToken();
    const needFetch=POPULAR_FR.filter(s=>!avatarCache[s.twitch]);if(!needFetch.length){renderPopularGrid();return;}
    const logins=needFetch.map(s=>'login='+s.twitch).join('&');
    const r=await fetch('https://api.twitch.tv/helix/users?'+logins,{headers:{'Client-ID':TWITCH_CLIENT_ID,'Authorization':'Bearer '+twitchToken}});
    if(!r.ok)return;const d=await r.json();
    (d.data||[]).forEach(u=>{avatarCache[u.login.toLowerCase()]=u.profile_image_url;});
    saveAvatars();scheduleSave();renderPopularGrid();
  }catch(e){console.warn('Popular avatars:',e);}
}
function renderPopularGrid(){
  const grid=document.getElementById('popularGrid');if(!grid)return;grid.innerHTML='';
  const sorted=[...POPULAR_FR].sort((a,b)=>{const aL=popularLiveData[a.twitch]?1:0,bL=popularLiveData[b.twitch]?1:0;if(bL!==aL)return bL-aL;return getViewers(b.twitch)-getViewers(a.twitch);});
  sorted.forEach(p=>{
    const isLive=!!popularLiveData[p.twitch],isAdded=streamers.find(s=>s.twitch===p.twitch);
    const card=document.createElement('div');card.className='popular-card'+(isLive?' is-live':'')+(isAdded?' already-added':'');
    const avUrl=avatarCache[p.twitch];
    const avHtml=avUrl?`<div class="pc-av"><img src="${avUrl}" alt="${p.nom}"></div>`:`<div class="pc-av-ph" style="background:linear-gradient(135deg,#4c1d95,#7c3aed)">${p.nom[0]}</div>`;
    const viewers=getViewers(p.twitch);
    const subHtml=isLive?`<div class="pc-live"><span class="pc-live-dot"></span>${fmtV(viewers)}</div>`:`<div class="pc-sub">Hors ligne</div>`;
    card.innerHTML=`${avHtml}<div class="pc-info"><div class="pc-name">${p.nom}</div>${subHtml}</div>`;
    if(!isAdded){card.onclick=()=>{addStreamer({twitch:p.twitch,nom:p.nom,avatar:avatarCache[p.twitch]||null,isLive});card.classList.add('already-added');};}
    grid.appendChild(card);
  });
  renderSbSuggestions();
}
function renderSbSuggestions(){
  const pills=document.getElementById('sbSuggestionsPills');if(!pills)return;
  const sugg=document.getElementById('sbSuggestions');
  if(streamers.length>3){if(sugg)sugg.style.display='none';return;}
  if(sugg)sugg.style.display='';pills.innerHTML='';
  const sorted=[...POPULAR_FR].sort((a,b)=>(liveset.has(b.twitch)?1:0)-(liveset.has(a.twitch)?1:0)).slice(0,10);
  sorted.forEach(p=>{
    if(streamers.find(s=>s.twitch===p.twitch))return;
    const pill=document.createElement('button');pill.className='suggest-pill'+(liveset.has(p.twitch)?' live':'');
    pill.textContent=(liveset.has(p.twitch)?'🔴 ':'')+p.nom;
    pill.onclick=()=>{addStreamer({twitch:p.twitch,nom:p.nom,avatar:avatarCache[p.twitch]||null});};
    pills.appendChild(pill);
  });
}

// ══════════════════════════════════════════
//  GESTION STREAMEURS
// ══════════════════════════════════════════
function addStreamer(r){
  if(streamers.find(s=>s.twitch===r.twitch)){showToast(r.nom+' déjà dans ta liste !');return;}
  if(r.avatar)avatarCache[r.twitch]=r.avatar;
  streamers.push({twitch:r.twitch,nom:r.nom});
  render();scheduleSave();saveAvatars();
  showToast('✅ '+r.nom+' ajouté !');
}
function deleteStreamer(twitch){
  const s=streamers.find(x=>x.twitch===twitch)||{nom:twitch};
  if(!confirm('Supprimer '+s.nom+' ?'))return;
  streamers=streamers.filter(x=>x.twitch!==twitch);
  selected=selected.filter(id=>id!==twitch);
  categories.forEach(cat=>{cat.members=cat.members.filter(m=>m!==twitch);});
  if(activeIframes[twitch]){activeIframes[twitch].src='about:blank';delete activeIframes[twitch];}
  saveState();saveCats();scheduleSave();render();
  if(isStreamsLaunched){if(!selected.length)endStreams();else updateStreamsLayout();}
  showToast('Streameur supprimé');
}
function openEditModal(twitch){
  const s=streamers.find(x=>x.twitch===twitch);if(!s)return;
  editingTwitch=twitch;document.getElementById('editNom').value=s.nom||'';
  document.getElementById('editModal').classList.add('open');
}
function closeEditModal(){document.getElementById('editModal').classList.remove('open');editingTwitch=null;}
function saveEdit(){
  if(!editingTwitch)return;const s=streamers.find(x=>x.twitch===editingTwitch);if(!s)return;
  const nom=document.getElementById('editNom').value.trim();if(!nom){showToast('Nom vide !');return;}
  s.nom=nom;closeEditModal();render();scheduleSave();showToast('✅ Mis à jour !');
}
document.getElementById('editModal').addEventListener('click',function(e){if(e.target===this)closeEditModal();});

// ══════════════════════════════════════════
//  CATEGORIES
// ══════════════════════════════════════════
function genCatId(){return 'cat_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);}
function openCatModal(){renderCatModal();document.getElementById('catModal').classList.add('open');}
function closeCatModal(){document.getElementById('catModal').classList.remove('open');}
document.getElementById('catModal').addEventListener('click',function(e){if(e.target===this)closeCatModal();});
function renderCatModal(){
  const body=document.getElementById('catModalBody');body.innerHTML='';
  if(categories.length){
    const catList=document.createElement('div');catList.className='cat-list';
    categories.forEach((cat,ci)=>{
      const card=document.createElement('div');card.className='cat-card';
      const membersHtml=buildCatMembersHtml(cat);
      const countLive=cat.members.filter(m=>liveset.has(m)).length;
      card.innerHTML=`<div class="cat-card-header" onclick="toggleCatExpand(this)"><div class="cat-color-dot" style="background:${cat.color}"></div><span class="cat-name">${escHtml(cat.name)}</span>${countLive>0?`<span style="font-family:'Barlow Condensed',sans-serif;font-size:.6rem;font-weight:700;color:var(--online);background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.22);padding:1px 5px;border-radius:6px">🔴 ${countLive}</span>`:''}<span class="cat-count">${cat.members.length}</span><div class="cat-actions"><button class="cat-action-btn" onclick="event.stopPropagation();launchCategory(${ci})">▶ Lancer</button><button class="cat-action-btn danger" onclick="event.stopPropagation();deleteCategory(${ci})">🗑</button></div><button class="cat-expand-btn" tabindex="-1">▼</button></div><div class="cat-members" id="catmembers_${ci}">${membersHtml}</div><div id="cataddmember_${ci}" style="display:none;padding:0 11px 9px"><div class="cat-add-member"><input class="cat-add-member-input" id="catAddInput_${ci}" placeholder="Nom Twitch…" onkeydown="if(event.key==='Enter')addMemberToCat(${ci})"/><button class="btn sm primary" onclick="addMemberToCat(${ci})">+ Add</button></div><div class="cat-member-suggestions" id="catSuggest_${ci}"></div></div>`;
      const addBtn=document.createElement('button');addBtn.className='cat-action-btn';addBtn.textContent='+ Membre';addBtn.onclick=(e)=>{e.stopPropagation();toggleCatAddMember(ci,card);};
      card.querySelector('.cat-actions').insertBefore(addBtn,card.querySelector('.cat-actions').firstChild);
      catList.appendChild(card);
    });
    body.appendChild(catList);
  }
  const nc=document.createElement('div');nc.className='new-cat-section';
  let newCatColor=CAT_COLORS[categories.length%CAT_COLORS.length];
  const swatches=CAT_COLORS.map((c)=>`<div class="color-swatch${c===newCatColor?' active':''}" style="background:${c}" onclick="selectNewCatColor(this,'${c}')"></div>`).join('');
  nc.innerHTML=`<div class="new-cat-title">✦ Nouvelle catégorie</div><div class="new-cat-row"><input class="new-cat-input" id="newCatName" placeholder="Ex: JL, Zlan…" onkeydown="if(event.key==='Enter')createCategory()"/><button class="btn primary sm" onclick="createCategory()">Créer</button></div><div class="color-picker-wrap">${swatches}</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:.62rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:5px">Membres</div><div class="cat-member-suggestions" id="newCatSuggest">${buildNewCatSuggest()}</div><div id="newCatSelected" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px"></div>`;
  body.appendChild(nc);
  window._newCatMembers=[];window._newCatColor=newCatColor;
}
function buildNewCatSuggest(){return streamers.map(s=>`<div class="cat-memb-suggest${liveset.has(s.twitch)?' is-live':''}" onclick="toggleNewCatMember('${s.twitch}','${escHtml(s.nom)}')">${liveset.has(s.twitch)?'🔴 ':''}${escHtml(s.nom)}</div>`).join('');}
function toggleNewCatMember(twitch,nom){
  if(!window._newCatMembers)window._newCatMembers=[];
  const idx=window._newCatMembers.indexOf(twitch);
  if(idx>=0)window._newCatMembers.splice(idx,1);else window._newCatMembers.push(twitch);
  const sel=document.getElementById('newCatSelected');if(!sel)return;sel.innerHTML='';
  window._newCatMembers.forEach(t=>{const s=streamers.find(x=>x.twitch===t)||{nom:t};const chip=document.createElement('div');chip.className='cat-member-chip';chip.innerHTML=`${escHtml(s.nom)}<button class="cat-member-remove" onclick="event.stopPropagation();toggleNewCatMember('${t}','')">✕</button>`;sel.appendChild(chip);});
}
function selectNewCatColor(el,color){window._newCatColor=color;document.querySelectorAll('.new-cat-section .color-swatch').forEach(s=>s.classList.remove('active'));el.classList.add('active');}
function createCategory(){
  const nameEl=document.getElementById('newCatName');if(!nameEl)return;
  const name=nameEl.value.trim();if(!name){showToast('Donne un nom !');return;}
  const color=window._newCatColor||CAT_COLORS[0];
  const members=[...(window._newCatMembers||[])];
  categories.push({id:genCatId(),name,color,members});
  saveCats();scheduleSave();showToast('🏷️ "'+name+'" créée !');renderCatModal();renderSidebar();
}
function deleteCategory(ci){const cat=categories[ci];if(!cat)return;if(!confirm('Supprimer "'+cat.name+'" ?'))return;categories.splice(ci,1);saveCats();scheduleSave();renderCatModal();renderSidebar();showToast('Catégorie supprimée');}
function launchCategory(ci){
  const cat=categories[ci];if(!cat||!cat.members.length){showToast('Catégorie vide !');return;}
  selected=[];cat.members.forEach(t=>{if(selected.length<10&&streamers.find(s=>s.twitch===t))selected.push(t);});
  saveState();render();closeCatModal();if(selected.length){launchStreams();showToast('▶ "'+cat.name+'" lancée !');}
  else showToast('Aucun streameur dans ta liste !');
}
function toggleCatExpand(header){const card=header.closest('.cat-card');const membDiv=card.querySelector('.cat-members');const btn=header.querySelector('.cat-expand-btn');const isOpen=membDiv.classList.contains('open');membDiv.classList.toggle('open',!isOpen);btn.classList.toggle('open',!isOpen);}
function toggleCatAddMember(ci,card){
  const addDiv=card.querySelector(`#cataddmember_${ci}`);const membDiv=card.querySelector(`#catmembers_${ci}`);
  const isHidden=addDiv.style.display==='none';addDiv.style.display=isHidden?'block':'none';
  if(isHidden){membDiv.classList.add('open');card.querySelector('.cat-expand-btn').classList.add('open');
    const suggest=card.querySelector(`#catSuggest_${ci}`);const cat=categories[ci];suggest.innerHTML='';
    streamers.forEach(s=>{if(cat.members.includes(s.twitch))return;const el=document.createElement('div');el.className='cat-memb-suggest'+(liveset.has(s.twitch)?' is-live':'');el.textContent=(liveset.has(s.twitch)?'🔴 ':'')+s.nom;el.onclick=()=>{addMemberToCatDirect(ci,s.twitch);renderCatModal();};suggest.appendChild(el);});
    setTimeout(()=>{const inp=card.querySelector(`#catAddInput_${ci}`);if(inp)inp.focus();},50);
  }
}
function addMemberToCat(ci){const inp=document.getElementById(`catAddInput_${ci}`);if(!inp)return;const val=inp.value.trim().toLowerCase();if(!val)return;const s=streamers.find(x=>x.twitch===val||x.nom.toLowerCase()===val);if(!s){showToast('Streameur non trouvé !');return;}addMemberToCatDirect(ci,s.twitch);renderCatModal();}
function addMemberToCatDirect(ci,twitch){const cat=categories[ci];if(!cat)return;if(cat.members.includes(twitch)){showToast('Déjà dans cette catégorie !');return;}cat.members.push(twitch);saveCats();scheduleSave();renderSidebar();showToast('✅ Ajouté !');}
function removeMemberFromCat(ci,twitch){const cat=categories[ci];if(!cat)return;cat.members=cat.members.filter(m=>m!==twitch);saveCats();scheduleSave();renderCatModal();renderSidebar();}
function buildCatMembersHtml(cat){
  if(!cat.members.length)return '<div style="font-size:.7rem;color:var(--muted);padding:0 3px 3px;font-style:italic">Aucun membre</div>';
  const ci=categories.indexOf(cat);
  return cat.members.map((t,idx)=>{
    const s=streamers.find(x=>x.twitch===t)||{nom:t};
    const isL=liveset.has(t);
    const catOptions=categories.map((c,i)=>`<option value="${i}"${i===ci?' selected':''}>${escHtml(c.name)}</option>`).join('');
    return `<div class="cat-member-chip${isL?' is-live':''}" style="display:flex;align-items:center;gap:3px;padding:3px 6px">
      <span>${isL?'🔴 ':''}${escHtml(s.nom)}</span>
      <button onclick="event.stopPropagation();moveMemberUp(${ci},${idx})" title="Monter" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:.7rem;padding:0 1px">⬆️</button>
      <button onclick="event.stopPropagation();moveMemberDown(${ci},${idx})" title="Descendre" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:.7rem;padding:0 1px">⬇️</button>
      <select onchange="event.stopPropagation();changeMemberCat(${ci},${idx},this.value)" style="font-size:.6rem;padding:1px 3px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);cursor:pointer">${catOptions}</select>
      <button class="cat-member-remove" onclick="event.stopPropagation();removeMemberFromCat(${ci},'${t}')">✕</button>
    </div>`;
  }).join('');
}
function moveMemberUp(ci,idx){
  const cat=categories[ci];if(!cat||idx<=0)return;
  [cat.members[idx-1],cat.members[idx]]=[cat.members[idx],cat.members[idx-1]];
  saveCats();scheduleSave();renderCatModal();renderSidebar();
}

function moveMemberDown(ci,idx){
  const cat=categories[ci];if(!cat||idx>=cat.members.length-1)return;
  [cat.members[idx+1],cat.members[idx]]=[cat.members[idx],cat.members[idx+1]];
  saveCats();scheduleSave();renderCatModal();renderSidebar();
}

function changeMemberCat(fromCi,idx,toCiStr){
  const toCi=parseInt(toCiStr);
  if(fromCi===toCi)return;
  const fromCat=categories[fromCi];const toCat=categories[toCi];
  if(!fromCat||!toCat)return;
  const twitch=fromCat.members[idx];
  if(toCat.members.includes(twitch)){showToast('Déjà dans cette catégorie !');return;}
  fromCat.members.splice(idx,1);
  toCat.members.push(twitch);
  saveCats();scheduleSave();renderCatModal();renderSidebar();
  showToast('✅ Déplacé vers "'+toCat.name+'" !');
}
function escHtml(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ══════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════
function render(){renderSidebar();renderChips();renderLivePanel();updateHeader();updateMnavBadge();updateMobileNav();}
function renderSidebar(){
  const el=document.getElementById('sbList');const cnt=document.getElementById('sbListCount');el.innerHTML='';if(cnt)cnt.textContent=streamers.length;
  if(!streamers.length){const empty=document.createElement('div');empty.className='sb-empty';empty.innerHTML=`<div class="sb-empty-icon">📺</div><div class="sb-empty-title">Aucun streameur</div><div class="sb-empty-sub">Recherche un streameur ou clique sur un populaire</div>`;el.appendChild(empty);return;}
  if(categories.length){
    categories.forEach((cat,ci)=>{
      const catMembers=cat.members.filter(t=>streamers.find(s=>s.twitch===t));if(!catMembers.length)return;
      const liveInCat=catMembers.filter(t=>liveset.has(t)).length;
      const header=document.createElement('div');header.className='cat-section-header';
      header.innerHTML=`<div class="cat-section-label"><span class="cat-section-dot" style="background:${cat.color}"></span><span style="color:${cat.color}">${escHtml(cat.name)}</span>${liveInCat?`<span style="font-family:'Barlow Condensed',sans-serif;font-size:.58rem;font-weight:700;color:var(--online);background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.22);padding:1px 4px;border-radius:5px">🔴${liveInCat}</span>`:''}</div><button class="cat-launch-sm" onclick="launchCategory(${ci})">▶ Tout</button>`;
      el.appendChild(header);
      const sorted=[...catMembers].sort((a,b)=>{const aL=liveset.has(a)?1:0,bL=liveset.has(b)?1:0;if(bL!==aL)return bL-aL;return getViewers(b)-getViewers(a);});
      sorted.forEach(t=>{const s=streamers.find(x=>x.twitch===t);if(s)el.appendChild(buildItem(s));});
    });
    const uncategorized=streamers.filter(s=>!categories.some(c=>c.members.includes(s.twitch)));
    if(uncategorized.length){
      const divider=document.createElement('div');divider.style.cssText='font-family:\'Barlow Condensed\',sans-serif;font-size:.6rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);padding:7px 7px 3px;margin-top:3px;border-top:1px solid var(--border)';divider.textContent='Sans catégorie';el.appendChild(divider);
      const sortedUncat=[...uncategorized].sort((a,b)=>{const aL=liveset.has(a.twitch)?1:0,bL=liveset.has(b.twitch)?1:0;if(bL!==aL)return bL-aL;return getViewers(b.twitch)-getViewers(a.twitch);});
      sortedUncat.forEach(s=>el.appendChild(buildItem(s)));
    }
  }else{
    const sorted=[...streamers].sort((a,b)=>{const aL=liveset.has(a.twitch)?1:0,bL=liveset.has(b.twitch)?1:0;if(bL!==aL)return bL-aL;return getViewers(b.twitch)-getViewers(a.twitch);});
    const liveList=sorted.filter(s=>liveset.has(s.twitch)),offlineList=sorted.filter(s=>!liveset.has(s.twitch));
    if(liveList.length){const lbl=document.createElement('div');lbl.style.cssText='font-family:\'Barlow Condensed\',sans-serif;font-size:.6rem;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--online);padding:7px 7px 3px;margin-top:2px;display:flex;align-items:center;gap:5px';lbl.innerHTML='<span class="live-dot"></span>En live';el.appendChild(lbl);liveList.forEach(s=>el.appendChild(buildItem(s)));}
    if(offlineList.length){if(liveList.length){const l2=document.createElement('div');l2.style.cssText='font-family:\'Barlow Condensed\',sans-serif;font-size:.6rem;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);padding:7px 7px 3px;margin-top:2px';l2.textContent='Hors ligne';el.appendChild(l2);}offlineList.forEach(s=>el.appendChild(buildItem(s)));}
  }
  renderSbSuggestions();
}
function buildItem(s){
  const isSel=selected.includes(s.twitch),isLive=liveset.has(s.twitch),viewers=getViewers(s.twitch);
  const d=document.createElement('div');
  let cls='s-item';if(isSel)cls+=' sel';if(isLive)cls+=' is-live';d.className=cls;
  d.onclick=(e)=>{if(e.target.closest('.s-del')||e.target.closest('.s-edit-btn'))return;toggle(s.twitch);if(isMobile())setTimeout(()=>closeMobileSidebar(),150);};
  const avUrl=avatarCache[s.twitch];
  const avHtml=avUrl?`<div class="av av-default"><img src="${avUrl}" alt="${s.nom}"></div>`:`<div class="av av-default">${s.nom[0]}</div>`;
  const vBadge=isLive?`<span class="s-viewers">👁 ${fmtV(viewers)}</span>`:'';
  const thumb=isLive?buildThumb(s):'';
  d.innerHTML=`${avHtml}<div class="s-info"><div class="s-name">${s.nom}${isLive?' 🔴':''}</div><div class="s-sub">${s.twitch}</div></div><div class="s-right">${vBadge}<div class="${isLive?'online-dot':'offline-dot'}"></div><div class="chk">${isSel?'✓':''}</div><button class="s-edit-btn" onclick="event.stopPropagation();openEditModal('${s.twitch}')" style="display:none;background:none;border:none;cursor:pointer;font-size:.7rem;padding:2px 4px;border-radius:3px;color:var(--muted)">✏️</button><button class="s-del" onclick="event.stopPropagation();deleteStreamer('${s.twitch}')">🗑</button></div>${thumb}`;
  d.addEventListener('mouseenter',()=>{const e=d.querySelector('.s-edit-btn');if(e)e.style.display='flex';});
  d.addEventListener('mouseleave',()=>{const e=d.querySelector('.s-edit-btn');if(e)e.style.display='none';});
  return d;
}
function buildThumb(s){
  const thumb=getThumbnail(s.twitch),viewers=getViewers(s.twitch),game=getGame(s.twitch),title=getTitle(s.twitch);
  const imgEl=thumb?`<img class="s-thumb-img" src="${thumb}" alt="${s.nom}">`:`<div style="width:100%;aspect-ratio:16/9;background:var(--bg);display:flex;align-items:center;justify-content:center;opacity:.3">📺</div>`;
  return`<div class="s-thumb-wrap">${imgEl}<div class="s-thumb-info"><div class="s-thumb-name">${s.nom}</div>${game?`<div class="s-thumb-game">🎮 ${game}</div>`:''}<div class="s-thumb-row"><span class="s-thumb-live">LIVE</span><span class="s-thumb-viewers">👁 ${fmtV(viewers)}</span></div>${title?`<div class="s-thumb-game" style="margin-top:4px;font-style:italic">${title.length>55?title.substring(0,55)+'…':title}</div>`:''}</div></div>`;
}
function renderLivePanel(){
  const liveSt=streamers.filter(s=>liveset.has(s.twitch)).sort((a,b)=>getViewers(b.twitch)-getViewers(a.twitch));
  document.getElementById('liveCount').textContent=liveSt.length+' en live';
  const cards=document.getElementById('liveCards');
  if(!liveSt.length){cards.innerHTML='<span class="no-live">Aucun de tes streameurs en live</span>';return;}
  cards.innerHTML='';
  liveSt.forEach(s=>{const card=document.createElement('div');card.className='live-card';card.onclick=()=>{if(!selected.includes(s.twitch))toggle(s.twitch);};card.innerHTML=`<div class="live-dot" style="flex-shrink:0"></div><span class="live-card-name">${s.nom}</span><span class="live-viewers-badge">👁 ${fmtV(getViewers(s.twitch))}</span>`;cards.appendChild(card);});
}
function updateHeader(){
  const n=selected.length;
  const tag=document.getElementById('limitTag');tag.textContent=n+'/10';tag.className='limit-tag '+(n>=8?'limit-warn':'limit-ok');
  const btnL=document.getElementById('btnLaunch');btnL.disabled=n===0;btnL.textContent=n===0?'▶ Lancer':(n===1?'▶ Lancer':'▶ '+n);
  const fab=document.getElementById('mobileLaunchFab');
  if(fab){fab.disabled=n===0;fab.textContent=isStreamsLaunched?'⛶':'▶';fab.classList.toggle('launched',isStreamsLaunched);fab.onclick=isStreamsLaunched?openStreamsFsOverlay:mobileLaunch;}
}
function updateMnavBadge(){const n=liveset.size,badge=document.getElementById('mnavLiveBadge');if(!badge)return;badge.textContent=n;badge.classList.toggle('vis',n>0);}
function updateMobileNav(){
  const nav=document.getElementById('mobileStreamsNav'),ctrl=document.getElementById('mobileStreamControls');
  if(!nav)return;
  if(!isMobile()||!isStreamsLaunched||!selected.length){nav.style.display='none';if(ctrl)ctrl.classList.add('hidden');return;}
  nav.style.display='flex';if(ctrl){ctrl.classList.remove('hidden');const c=document.getElementById('mscCount');if(c)c.textContent=selected.length;}
  nav.innerHTML='';
  selected.forEach((_,i)=>{const dot=document.createElement('div');dot.className='msn-dot'+(i===0?' active':'');dot.onclick=()=>{const boxes=document.querySelectorAll('.stream-box');if(boxes[i])boxes[i].scrollIntoView({behavior:'smooth'});document.querySelectorAll('.msn-dot').forEach((d,j)=>d.classList.toggle('active',j===i));};nav.appendChild(dot);});
}

// ══════════════════════════════════════════
//  LOGO LIVE MODAL
// ══════════════════════════════════════════
function openLogoLiveModal(){
  const modal=document.getElementById('logoLiveModal'),grid=document.getElementById('logoLiveGrid'),count=document.getElementById('logoLiveCount');
  const lives=streamers.filter(s=>liveset.has(s.twitch)).sort((a,b)=>getViewers(b.twitch)-getViewers(a.twitch));
  count.textContent=lives.length>0?lives.length+' en live':'Personne en live';grid.innerHTML='';
  if(!lives.length){grid.innerHTML='<div style="padding:36px;text-align:center;color:var(--muted)">Aucun de tes streameurs n\'est en live</div>';modal.style.display='flex';return;}
  lives.forEach(s=>{
    const card=document.createElement('div');card.style.cssText='background:var(--card);border:1px solid var(--border);border-radius:11px;overflow:hidden;cursor:pointer;transition:all .2s';
    card.onmouseenter=()=>{card.style.borderColor='var(--accent)';card.style.transform='translateY(-2px)'};card.onmouseleave=()=>{card.style.borderColor='var(--border)';card.style.transform=''};
    card.onclick=()=>{toggle(s.twitch);closeLogoLiveModal();};
    const thumb=getThumbnail(s.twitch),isSel=selected.includes(s.twitch);
    card.innerHTML=`<div style="position:relative">${thumb?`<img src="${thumb}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block" alt="${s.nom}">`:'<div style="width:100%;aspect-ratio:16/9;background:var(--bg);display:flex;align-items:center;justify-content:center;opacity:.2;font-size:2rem">📺</div>'}<span style="position:absolute;top:7px;left:7px;background:var(--live);color:#fff;font-family:\'Barlow Condensed\',sans-serif;font-size:.65rem;font-weight:700;padding:2px 6px;border-radius:4px">LIVE</span><span style="position:absolute;top:7px;right:7px;background:rgba(0,0,0,.75);color:#fff;font-family:\'Barlow Condensed\',sans-serif;font-size:.68rem;font-weight:700;padding:2px 6px;border-radius:4px">👁 ${fmtV(getViewers(s.twitch))}</span></div><div style="padding:10px 12px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:.92rem;font-weight:700;color:var(--text)">${s.nom}</div>${getGame(s.twitch)?`<div style="font-size:.68rem;color:var(--muted2);margin-top:2px">🎮 ${getGame(s.twitch)}</div>`:''}</div><div style="margin:0 12px 10px;padding:5px;text-align:center;background:${isSel?'var(--accent)':'rgba(124,58,237,.1)'};border:1px solid var(--accent);border-radius:6px;color:${isSel?'#fff':'var(--accent2)'};font-family:\'Barlow Condensed\',sans-serif;font-size:.74rem;font-weight:700">${isSel?'✓ Dans le multistream':'▶ Ajouter'}</div>`;
    grid.appendChild(card);
  });
  modal.style.display='flex';
}
function closeLogoLiveModal(){document.getElementById('logoLiveModal').style.display='none';}
document.getElementById('logoLiveModal').addEventListener('click',function(e){if(e.target===this)closeLogoLiveModal();});

// ══════════════════════════════════════════
//  CHIPS
// ══════════════════════════════════════════
let chipDragSrc=null;
function renderChips(){
  const area=document.getElementById('chips');
  if(!selected.length){area.innerHTML='<span class="empty-chips">Sélectionne des streameurs…</span>';return;}
  area.innerHTML='';
  selected.forEach(id=>{
    const s=streamers.find(x=>x.twitch===id)||{nom:id};
    const chip=document.createElement('div');chip.className='chip';chip.draggable=true;chip.dataset.id=id;
    chip.innerHTML=`<span class="chip-drag-handle">⠿</span>${s.nom} <button class="chip-x" onclick="event.stopPropagation();toggle('${id}')">✕</button>`;
    chip.addEventListener('dragstart',e=>{chipDragSrc=id;e.dataTransfer.setData('text/plain',id);});
    chip.addEventListener('dragover',e=>e.preventDefault());
    chip.addEventListener('drop',e=>{e.preventDefault();if(!chipDragSrc||chipDragSrc===id)return;const ia=selected.indexOf(chipDragSrc),ib=selected.indexOf(id);if(ia!==-1&&ib!==-1){[selected[ia],selected[ib]]=[selected[ib],selected[ia]];saveState();renderChips();if(isStreamsLaunched)updateStreamsLayout();}});
    area.appendChild(chip);
  });
}

// ══════════════════════════════════════════
//  TOGGLE / LAUNCH
// ══════════════════════════════════════════
function toggle(id){
  const idx=selected.indexOf(id);
  if(idx>=0){selected.splice(idx,1);if(activeIframes[id]){activeIframes[id].src='about:blank';delete activeIframes[id];}if(isStreamsLaunched){updateStreamsLayout();if(!selected.length)endStreams();}}
  else{if(selected.length>=10){showToast('Maximum 10 streams !');return;}selected.push(id);if(isStreamsLaunched)updateStreamsLayout();}
  saveState();render();
}
function clearAll(){
  if(isMobile()&&selected.length){if(!confirm('Effacer tous les streams ?'))return;}
  selected=[];Object.keys(activeIframes).forEach(id=>{activeIframes[id].src='about:blank';delete activeIframes[id];});
  saveState();render();if(isStreamsLaunched)endStreams();
}
function launchStreams(){
  if(!selected.length)return;
  saveHistory();
  const ws=document.getElementById('welcomeScreen');
  const sa=document.getElementById('streamsArea');
  if(ws)ws.style.display='none';
  if(sa){sa.classList.add('active');}
  isStreamsLaunched=true;
  buildStreamsLayout(document.getElementById('streamsLayout'),selected);
  if(chatOpen)updateChatSelect();
  updateMobileNav();updateHeader();
}
function endStreams(){
  const sa=document.getElementById('streamsArea');
  const ws=document.getElementById('welcomeScreen');
  if(sa){sa.classList.remove('active');}
  document.getElementById('streamsLayout').innerHTML='';
  if(ws)ws.style.display='flex';
  if(fsMode)closeStreamsFsOverlay();
  isStreamsLaunched=false;
  updateMobileNav();
}
function mobileLaunch(){if(!selected.length)return;launchStreams();}
function removeStream(id){selected=selected.filter(s=>s!==id);if(activeIframes[id]){activeIframes[id].src='about:blank';delete activeIframes[id];}saveState();render();if(!selected.length)endStreams();else updateStreamsLayout();updateMobileNav();}
function promoteStream(id){const idx=selected.indexOf(id);if(idx<=0)return;selected.splice(idx,1);selected.unshift(id);saveState();updateStreamsLayout();showToast('★ '+(streamers.find(x=>x.twitch===id)?.nom||id)+' mis en principal');render();}

// ══════════════════════════════════════════
//  IFRAMES
// ══════════════════════════════════════════
function makeIframeSrc(id,muted){return `https://player.twitch.tv/?channel=${id}&parent=${PARENT}&autoplay=true&muted=${muted}`;}
function getOrCreateIframe(id,isMain){
  if(activeIframes[id])return activeIframes[id];
  if(isMobile()){
    const f=document.createElement('iframe');
    f.src=`https://player.twitch.tv/?channel=${id}&parent=${PARENT}&autoplay=true&muted=${!isMain}`;
    f.allowFullscreen=true;
    f.setAttribute('allow','autoplay');
    f.style.cssText='width:100%;height:100%;border:none';
    activeIframes[id]=f;
    return f;
  }
  const div=document.createElement('div');
  div.id='twitch-player-'+id;
  div.style.cssText='width:100%;height:100%';
  activeIframes[id]=div;
  setTimeout(()=>{
    const player=new Twitch.Player('twitch-player-'+id,{
      channel:id,parent:[PARENT],autoplay:true,muted:!isMain,width:'100%',height:'100%'
    });
    twitchPlayers[id]=player;
  },100);
  return div;
}
function updateStreamsLayout(){
  if(!isStreamsLaunched)return;
  const container=document.getElementById('streamsLayout');
  const currentIds=[...container.querySelectorAll('.stream-box')].map(b=>b.dataset.id);
  if(JSON.stringify(currentIds)===JSON.stringify(selected))return;
  buildStreamsLayout(container,selected);
}
function createStreamBox(id,isMain){
  const s=streamers.find(x=>x.twitch===id)||{nom:id};
  const box=document.createElement('div');box.className='stream-box';box.id='box-'+id;box.dataset.id=id;box.style.width='100%';box.style.height='100%';
  const ov=document.createElement('div');ov.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2';
  const v=getViewers(id),isLive=liveset.has(id);
  const mainBadge=isMain&&selected.length>1?'<div class="main-badge">★ Principal</div>':'';
  const promBtn=isMain||selected.length===1?'':`<button class="stream-promote-btn" style="pointer-events:all" onclick="promoteStream('${id}')">★ Principal</button>`;
  ov.innerHTML=`${mainBadge}<div class="stream-label">${s.nom}</div>${isLive?`<div class="stream-viewers" style="pointer-events:none"><div class="stream-viewers-dot"></div>${fmtV(v)}</div>`:''}<button class="stream-fs-btn" style="pointer-events:all" onclick="openFullscreen('${id}')">⛶</button><button class="stream-close" style="pointer-events:all" onclick="removeStream('${id}')">✕</button><button class="stream-chat-btn" style="pointer-events:all" onclick="openChatFor('${id}')">💬 Chat</button>${promBtn}`;
  const iframe=getOrCreateIframe(id,isMain);box.appendChild(iframe);box.appendChild(ov);box.addEventListener('dblclick',()=>openFullscreen(id));return box;
}
function attachVSplitter(sp,lp,cont){
  let drag=false,sx=0,sw=0;
  const dn=cx=>{drag=true;sx=cx;sw=lp.offsetWidth;sp.classList.add('dragging');document.body.style.cursor='col-resize';document.body.style.userSelect='none';document.querySelectorAll('iframe').forEach(f=>f.style.pointerEvents='none');};
  const mv=cx=>{if(!drag)return;const cw=cont.getBoundingClientRect().width;const nw=Math.min(cw*.92,Math.max(cw*.08,sw+(cx-sx)));lp.style.width=nw+'px';mainPct=Math.round((nw/cw)*100);};
  const up=()=>{if(!drag)return;drag=false;sp.classList.remove('dragging');document.body.style.cursor='';document.body.style.userSelect='';document.querySelectorAll('iframe').forEach(f=>f.style.pointerEvents='');};
  sp.addEventListener('mousedown',e=>{e.preventDefault();dn(e.clientX);});document.addEventListener('mousemove',e=>mv(e.clientX));document.addEventListener('mouseup',up);
  sp.addEventListener('touchstart',e=>{e.preventDefault();dn(e.touches[0].clientX);},{passive:false});document.addEventListener('touchmove',e=>{if(drag){e.preventDefault();mv(e.touches[0].clientX);}},{passive:false});document.addEventListener('touchend',up);
}
function attachHSplitter(sp,tb,sec){
  let drag=false,sy=0,sh=0,th=0;
  const dn=cy=>{drag=true;sy=cy;sh=tb.offsetHeight;th=sec.getBoundingClientRect().height;sp.classList.add('dragging');document.body.style.cursor='row-resize';document.body.style.userSelect='none';document.querySelectorAll('iframe').forEach(f=>f.style.pointerEvents='none');};
  const mv=cy=>{if(!drag)return;const nh=Math.min(th*.92,Math.max(th*.08,sh+(cy-sy)));tb.style.height=nh+'px';tb.style.flex='none';};
  const up=()=>{if(!drag)return;drag=false;sp.classList.remove('dragging');document.body.style.cursor='';document.body.style.userSelect='';document.querySelectorAll('iframe').forEach(f=>f.style.pointerEvents='');};
  sp.addEventListener('mousedown',e=>{e.preventDefault();dn(e.clientY);});document.addEventListener('mousemove',e=>mv(e.clientY));document.addEventListener('mouseup',up);
  sp.addEventListener('touchstart',e=>{e.preventDefault();dn(e.touches[0].clientY);},{passive:false});document.addEventListener('touchmove',e=>{if(drag){e.preventDefault();mv(e.touches[0].clientY);}},{passive:false});document.addEventListener('touchend',up);
}
function buildStreamsLayout(container,ids){
  container.innerHTML='';if(!ids.length)return;
  if(isMobile()){
    container.style.flexDirection='column';container.style.overflowY='auto';
    if(ids.length===1){const box=createStreamBox(ids[0],true);box.style.flex='1';box.style.width='100%';box.style.height='100%';container.appendChild(box);}
    else ids.forEach((id,i)=>{const box=createStreamBox(id,i===0);box.style.flex='none';box.style.width='100%';box.style.height='50vw';box.style.minHeight='180px';container.appendChild(box);});
    updateMobileNav();return;
  }
  if(ids.length===1){const box=createStreamBox(ids[0],true);box.style.flex='1';container.appendChild(box);return;}
  const lp=document.createElement('div');lp.className='main-stream-pane';lp.style.width=mainPct+'%';
  const mb=createStreamBox(ids[0],true);mb.style.width='100%';mb.style.height='100%';lp.appendChild(mb);
  const vs=document.createElement('div');vs.className='v-splitter';
  const sec=document.createElement('div');sec.className='secondary-pane';
  ids.slice(1).forEach((id,i)=>{
    if(i>0){const hs=document.createElement('div');hs.className='h-splitter';sec.appendChild(hs);requestAnimationFrame(()=>{const boxes=sec.querySelectorAll('.stream-box');if(boxes[i-1]&&boxes[i])attachHSplitter(hs,boxes[i-1],sec);});}
    const box=createStreamBox(id,false);box.style.flex='1';box.style.width='100%';box.style.minHeight='60px';sec.appendChild(box);
  });
  container.appendChild(lp);container.appendChild(vs);container.appendChild(sec);attachVSplitter(vs,lp,container);
}

// ══════════════════════════════════════════
//  FULLSCREEN
// ══════════════════════════════════════════
function openStreamsFsOverlay(){
  if(!selected.length)return;
  if(!isStreamsLaunched)launchStreams();
  fsMode=true;
  const sa=document.getElementById('streamsArea');
  const fb=document.getElementById('fsFloatBar');
  if(sa){sa.style.position='fixed';sa.style.inset='42px 0 0 0';sa.style.zIndex='1000';}
  if(fb)fb.style.display='flex';
  if(!chatOpen){
    chatOpen=true;
    const p=document.getElementById('chatPanel'),r=document.getElementById('chatResize'),b=document.getElementById('btnChat');
    p.classList.remove('hidden');
    if(!isMobile()){r.style.display='block';}
    b.style.cssText='background:var(--accent);border-color:var(--accent);color:#fff';
    updateChatSelect();
    if(selected.length){document.getElementById('chatSelect').value=selected[0];switchChat();}
  }
  const cp=document.getElementById('chatPanel');const cr=document.getElementById('chatResize');
  if(cp){cp.style.position='fixed';cp.style.right='0';cp.style.top='42px';cp.style.bottom='0';cp.style.height='auto';cp.style.zIndex='1001';}
  if(cr){cr.style.position='fixed';cr.style.right=cp?cp.offsetWidth+'px':'300px';cr.style.top='42px';cr.style.bottom='0';cr.style.zIndex='1001';}
}
function closeStreamsFsOverlay(){
  fsMode=false;
  const sa=document.getElementById('streamsArea'),fb=document.getElementById('fsFloatBar');
  if(sa){sa.style.position='';sa.style.inset='';sa.style.zIndex='';}
  if(fb)fb.style.display='none';
  const cp=document.getElementById('chatPanel'),cr=document.getElementById('chatResize');
  if(cp){cp.style.position='';cp.style.right='';cp.style.top='';cp.style.bottom='';cp.style.height='';cp.style.zIndex='';}
  if(cr){cr.style.position='';cr.style.right='';cr.style.top='';cr.style.bottom='';cr.style.zIndex='';}
  updateHeader();
}
function openFullscreen(id){const s=streamers.find(x=>x.twitch===id)||{nom:id};document.getElementById('fsTitle').textContent='⛶ '+s.nom;document.getElementById('fsIframe').src=`https://player.twitch.tv/?channel=${id}&parent=${PARENT}&autoplay=true&muted=false`;document.getElementById('fsOverlay').classList.add('open');}
function closeFullscreen(){document.getElementById('fsOverlay').classList.remove('open');document.getElementById('fsIframe').src='';}

// ══════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════
function openChatFor(id){
  if(!chatOpen){chatOpen=true;const p=document.getElementById('chatPanel'),r=document.getElementById('chatResize'),b=document.getElementById('btnChat');p.classList.remove('hidden');if(!isMobile()){r.style.display='block';}b.style.cssText='background:var(--accent);border-color:var(--accent);color:#fff';}
  updateChatSelect();document.getElementById('chatSelect').value=id;switchChat();
}
function toggleChat(){
  chatOpen=!chatOpen;
  const p=document.getElementById('chatPanel'),r=document.getElementById('chatResize'),b=document.getElementById('btnChat');
  p.classList.toggle('hidden',!chatOpen);
  if(!isMobile()){r.style.display=chatOpen?'block':'none';}
  b.style.cssText=chatOpen?'background:var(--accent);border-color:var(--accent);color:#fff':'';
  if(chatOpen){updateChatSelect();if(selected.length){document.getElementById('chatSelect').value=selected[0];switchChat();}}
}
function updateChatSelect(){const sel=document.getElementById('chatSelect'),cur=sel.value;sel.innerHTML='<option value="">-- Stream --</option>';selected.forEach(id=>{const s=streamers.find(x=>x.twitch===id)||{nom:id};const o=document.createElement('option');o.value=id;o.textContent=s.nom;if(id===cur)o.selected=true;sel.appendChild(o);});if(!cur&&selected.length){sel.value=selected[0];switchChat();}}
function switchChat(){const id=document.getElementById('chatSelect').value,w=document.getElementById('chatIframeWrap');if(!id){w.innerHTML='';return;}w.innerHTML=`<iframe src="https://www.twitch.tv/embed/${id}/chat?parent=${PARENT}&darkpopout" style="width:100%;height:100%;border:none" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>`;}

// Chat resize
(function(){
  const h=document.getElementById('chatResize'),p=document.getElementById('chatPanel');
  if(!h||!p)return;
  let drag=false,sx,sw;
  h.addEventListener('mousedown',e=>{if(isMobile())return;drag=true;sx=e.clientX;sw=p.offsetWidth;document.body.style.cssText='cursor:col-resize;user-select:none';});
  document.addEventListener('mousemove',e=>{if(!drag)return;const w=Math.min(600,Math.max(200,sw-(e.clientX-sx)));p.style.width=w+'px';});
  document.addEventListener('mouseup',()=>{if(!drag)return;drag=false;document.body.style.cssText='';});
})();

// Sidebar resize
(function(){
  const h=document.getElementById('sideResize'),s=document.getElementById('sidebar');
  if(!h||!s)return;
  let drag=false,sx,sw;
  h.addEventListener('mousedown',e=>{if(isMobile())return;drag=true;sx=e.clientX;sw=s.offsetWidth;document.body.style.cssText='cursor:col-resize;user-select:none';});
  document.addEventListener('mousemove',e=>{if(!drag)return;const w=Math.min(480,Math.max(160,sw+(e.clientX-sx)));s.style.width=w+'px';s.style.minWidth=w+'px';});
  document.addEventListener('mouseup',()=>{if(!drag)return;drag=false;document.body.style.cssText='';});
})();

// ══════════════════════════════════════════
//  MOBILE SIDEBAR
// ══════════════════════════════════════════
function openMobileSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('sidebarOverlay').classList.add('open');}
function closeMobileSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebarOverlay').classList.remove('open');}
function toggleMobileSidebar(){const s=document.getElementById('sidebar');if(s.classList.contains('open'))closeMobileSidebar();else openMobileSidebar();}

// ══════════════════════════════════════════
//  GLOBAL CONTROLS
// ══════════════════════════════════════════
function toggleAllStreams(){
  globalPaused=!globalPaused;
  const btn=document.getElementById('gcPlay');
  if(btn){btn.textContent=globalPaused?'▶':'⏸';btn.classList.toggle('active',globalPaused);}
  Object.values(twitchPlayers).forEach(p=>{globalPaused?p.pause():p.play();});
  showToast(globalPaused?'⏸ Pause':'▶ Lecture');
}
function toggleMuteAll(){
  globalMuted=!globalMuted;
  const btn=document.getElementById('gcMute');
  if(btn){btn.textContent=globalMuted?'🔇':'🔊';btn.classList.toggle('active',globalMuted);}
  Object.values(twitchPlayers).forEach(p=>{p.setMuted(globalMuted);});
  showToast(globalMuted?'🔇 Tous mutés':'🔊 Son réactivé');
}
function setVolumeAll(val){
  const volume=parseInt(val)/100;
  Object.values(twitchPlayers).forEach(p=>{p.setVolume(volume);p.setMuted(volume===0);});
  showToast('🔈 Volume : '+val+'%');
}

// ══════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════
document.addEventListener('keydown',e=>{
  if(isMobile())return;if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  switch(e.key){
    case 'Escape':
      if(fsMode){closeStreamsFsOverlay();break;}
      if(document.getElementById('fsOverlay').classList.contains('open')){closeFullscreen();break;}
      if(document.getElementById('catModal').classList.contains('open')){closeCatModal();break;}
      if(document.getElementById('editModal').classList.contains('open')){closeEditModal();break;}
      if(document.getElementById('gradePanel').classList.contains('open')){toggleGradePanel();break;}
      break;
    case 'f':case 'F':if(document.getElementById('fsOverlay').classList.contains('open'))closeFullscreen();else if(selected.length)openFullscreen(selected[0]);break;
    case 'g':case 'G':if(selected.length){if(fsMode)closeStreamsFsOverlay();else openStreamsFsOverlay();}break;
    case 'c':case 'C':toggleChat();break;
    case 't':case 'T':toggleTheme();break;
    case ' ':e.preventDefault();toggleAllStreams();break;
    case 'm':case 'M':toggleMuteAll();break;
    case 'p':case 'P':openSettings();break;
    case 'Enter':if(!document.getElementById('btnLaunch').disabled)launchStreams();break;
    case 'ArrowRight':if(selected.length>1){selected.push(selected.shift());saveState();render();if(isStreamsLaunched)updateStreamsLayout();}break;
    case 'ArrowLeft':if(selected.length>1){selected.unshift(selected.pop());saveState();render();if(isStreamsLaunched)updateStreamsLayout();}break;
  }
});

// ══════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════
function openSettings(){
  const s=document.getElementById('settingsOverlay');s.classList.add('open');
  const ts=document.getElementById('themeSelect');if(ts)ts.value=getCurrentTheme();
  const p=getPrefs();
  ['notifLive','muteSec'].forEach(id=>{const el=document.getElementById(id);if(el&&p[id]!==undefined)el.checked=p[id];});
  const qs=document.getElementById('qualitySelect');if(qs&&p.quality)qs.value=p.quality;
}
function closeSettings(){document.getElementById('settingsOverlay').classList.remove('open');}
function switchSettingsTab(tab,btn){
  ['general','shortcuts','stream','twitch'].forEach(t=>{const el=document.getElementById('settingsTab'+t.charAt(0).toUpperCase()+t.slice(1));if(el)el.style.display=t===tab?'flex':'none';});
  document.querySelectorAll('.settings-tab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
}
function setTheme(val){document.documentElement.setAttribute('data-theme',val);localStorage.setItem('ms_theme',val);const mIcon=document.getElementById('mnavThemeIcon');if(mIcon)mIcon.textContent=val==='dark'?'☀️':'🌙';}
function setLang(val){lsSet('ms_lang',val);showToast('🌐 Langue changée !');}
function setChatWidth(w){const p=document.getElementById('chatPanel');if(p){p.style.width=w+'px';p.style.minWidth=w+'px';}}

// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}

// ══════════════════════════════════════════
//  CONTACT MODAL
// ══════════════════════════════════════════
function openContactModal(){const m=document.getElementById('contactModal');m.style.display='flex';document.getElementById('contactSuccess').style.display='none';}
function closeContactModal(){document.getElementById('contactModal').style.display='none';}
function sendContact(){
  const nom=document.getElementById('contactNom').value.trim();
  const email=document.getElementById('contactEmail').value.trim();
  const msg=document.getElementById('contactMsg').value.trim();
  if(!nom||!email||!msg){showToast('Remplis tous les champs !');return;}
  emailjs.send('service_8xk2oar','shnnv2m',{name:nom,email:email,message:msg})
    .then(()=>{document.getElementById('contactSuccess').style.display='block';document.getElementById('contactNom').value='';document.getElementById('contactEmail').value='';document.getElementById('contactMsg').value='';setTimeout(()=>closeContactModal(),2000);})
    .catch(()=>showToast('Erreur envoi, réessaie !'));
}

function showPage(p){document.getElementById('pageLive').classList.toggle('active',p==='live');document.getElementById('navLive').classList.toggle('active',p==='live');}

window.addEventListener('resize',()=>{if(isStreamsLaunched)updateStreamsLayout();});
let topBarVisible = true;
let topBarVisible = true;
function toggleTopBar(){
  const selBar = document.querySelector('.sel-bar');
  const livePanel = document.getElementById('livePanel');
  const btn = document.getElementById('topBarToggleBtn');
  topBarVisible = !topBarVisible;
  if(selBar) selBar.style.display = topBarVisible ? '' : 'none';
  if(livePanel){
    livePanel.style.overflow = topBarVisible ? '' : 'visible';
    // cache tout sauf le bouton
    Array.from(livePanel.children).forEach(child => {
      if(child !== btn) child.style.display = topBarVisible ? '' : 'none';
    });
    livePanel.style.padding = topBarVisible ? '' : '0';
    livePanel.style.minHeight = topBarVisible ? '' : '12px';
    livePanel.style.borderBottom = topBarVisible ? '' : 'none';
  }
  btn.textContent = topBarVisible ? '▲' : '▼';
  btn.style.background = topBarVisible ? 'var(--card)' : 'var(--accent)';
  btn.style.color = topBarVisible ? 'var(--muted)' : '#fff';
  btn.style.borderColor = topBarVisible ? 'var(--border2)' : 'var(--accent)';
  btn.style.bottom = topBarVisible ? '-12px' : '-12px';
}
