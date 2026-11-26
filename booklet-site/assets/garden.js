(function(){
  'use strict';
  var body=document.body;
  if(!body)return;

  var layer=document.createElement('div');
  layer.className='garden-background';
  layer.setAttribute('aria-hidden','true');
  var frond='<svg viewBox="0 0 220 310" fill="none" focusable="false"><path d="M110 300C117 245 87 194 106 130 119 85 116 49 107 15" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M110 257C70 264 35 236 40 197c40-4 71 19 70 60ZM109 215c38 6 72-20 68-58-39-3-69 18-68 58ZM108 169c-34 0-57-25-54-57 33-2 57 18 54 57ZM111 126c32 3 53-18 50-49-31-3-52 14-50 49ZM109 86C83 76 78 49 95 29c27 13 36 34 14 57Z" fill="currentColor" fill-opacity=".10" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m45 205 65 52m59-94-60 52m-52-98 53 49m49-83-49 34m-13-75 14 54M110 300l-23 7m23-7 23 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  ['one','two','three','four'].forEach(function(which){var sprig=document.createElement('div');sprig.className='garden-frond garden-frond--'+which;sprig.innerHTML=frond;layer.appendChild(sprig);});
  var tree='<svg viewBox="0 0 260 430" fill="none" focusable="false"><path d="M130 430V208M130 324 73 256M130 300l57-77M129 260l-30-79m31 57 31-88m-31 6-4-53" stroke="currentColor" stroke-width="13" stroke-linecap="round"/><path d="M127 430h16" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M128 43c-29-30-75-6-68 30-40 7-45 61-12 78-9 37 27 63 58 45 18 31 64 27 75-5 38 4 58-42 32-67 21-34-11-77-45-64-7-34-45-47-66-17Z" fill="currentColor" fill-opacity=".24" stroke="currentColor" stroke-width="2"/><path d="M47 112c27 10 44 30 51 57m24-126c-2 31 7 53 26 71m49-48c-26 18-40 41-44 68m59 19c-28-5-49 2-64 22M77 51c8 26 23 43 46 53" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".75"/></svg>';
  ['left','right'].forEach(function(side){var oak=document.createElement('div');oak.className='garden-tree garden-tree--'+side;oak.innerHTML=tree;layer.appendChild(oak);});
  body.insertBefore(layer,body.firstChild);

  var button=document.createElement('button');
  button.type='button';button.className='garden-sound-toggle';button.setAttribute('aria-pressed','true');
  button.setAttribute('aria-label','كتم صوت الحديقة');button.title='صوت حديقة هادئ — كتم';
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/></svg><span class="garden-sound-label">صوت الحديقة يعمل · كتم</span>';
  body.appendChild(button);

  var ambience=document.getElementById('garden-ambience');
  if(!ambience){ambience=document.createElement('audio');body.appendChild(ambience);}
  ambience.className='garden-ambience';ambience.loop=true;ambience.preload='auto';
  ambience.setAttribute('aria-hidden','true');ambience.setAttribute('playsinline','');
  var enabled=true,ducked=false,playingAudio=new Set();

  function setVolume(){ambience.volume=enabled?(ducked ? .045 : .20):0;}
  function announce(){
    button.setAttribute('aria-pressed',String(enabled));
    button.setAttribute('aria-label',enabled?'كتم صوت الحديقة':'تشغيل صوت الحديقة');
    button.title=enabled?'صوت حديقة هادئ — كتم':'تشغيل صوت الحديقة';
    var label=button.querySelector('.garden-sound-label');
    if(label)label.textContent=enabled?(ambience.paused?'الصوت جاهز · اضغط للتشغيل':'صوت الحديقة يعمل · كتم'):'تشغيل صوت الحديقة';
  }
  function startAmbience(){
    if(!enabled)return Promise.resolve();
    setVolume();
    var result;
    try{result=ambience.play();}catch(error){announce();return Promise.resolve();}
    if(result&&typeof result.then==='function')return result.then(announce).catch(announce);
    announce();return Promise.resolve();
  }
  function setDucked(value){ducked=!!value;setVolume();}

  button.addEventListener('click',function(){
    if(enabled&&!ambience.paused){enabled=false;ambience.pause();setVolume();announce();}
    else{enabled=true;setVolume();startAmbience();}
  });
  function resumeAfterGesture(event){
    if(!enabled||event.target===button||!ambience.paused)return;
    startAmbience();
  }
  document.addEventListener('pointerdown',resumeAfterGesture,{passive:true});
  document.addEventListener('keydown',resumeAfterGesture);
  document.addEventListener('play',function(event){
    var audio=event.target;
    if(!audio||audio.tagName!=='AUDIO'||audio===ambience)return;
    playingAudio.add(audio);setDucked(true);
  },true);
  function audioStopped(event){
    var audio=event.target;
    if(audio&&audio.tagName==='AUDIO'&&audio!==ambience){playingAudio.delete(audio);setDucked(playingAudio.size>0);}
  }
  document.addEventListener('pause',audioStopped,true);
  document.addEventListener('ended',audioStopped,true);
  ambience.addEventListener('play',announce);
  ambience.addEventListener('pause',announce);
  ambience.addEventListener('error',function(){var label=button.querySelector('.garden-sound-label');if(label)label.textContent='تعذّر تحميل صوت الحديقة';});
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){ambience.pause();return;}
    if(enabled)startAmbience();
  });
  if(window.speechSynthesis){window.setInterval(function(){if(enabled)setDucked(playingAudio.size>0||window.speechSynthesis.speaking||window.speechSynthesis.pending);},900);}
  window.addEventListener('pagehide',function(event){if(!event.persisted)ambience.pause();});
  announce();
  startAmbience();
})();
