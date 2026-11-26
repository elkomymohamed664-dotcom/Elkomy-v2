(function(){
  'use strict';
  var body=document.body;
  if(!body)return;

  var layer=document.createElement('div');
  layer.className='garden-background';
  layer.setAttribute('aria-hidden','true');
  var frond='<svg viewBox="0 0 220 310" fill="none" focusable="false"><path d="M110 300C117 245 87 194 106 130 119 85 116 49 107 15" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M110 257C70 264 35 236 40 197c40-4 71 19 70 60ZM109 215c38 6 72-20 68-58-39-3-69 18-68 58ZM108 169c-34 0-57-25-54-57 33-2 57 18 54 57ZM111 126c32 3 53-18 50-49-31-3-52 14-50 49ZM109 86C83 76 78 49 95 29c27 13 36 34 14 57Z" fill="currentColor" fill-opacity=".10" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m45 205 65 52m59-94-60 52m-52-98 53 49m49-83-49 34m-13-75 14 54M110 300l-23 7m23-7 23 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  ['one','two','three','four'].forEach(function(which){var sprig=document.createElement('div');sprig.className='garden-frond garden-frond--'+which;sprig.innerHTML=frond;layer.appendChild(sprig);});
  var tree='<svg viewBox="0 0 260 430" fill="none" focusable="false"><path d="M130 430V208M130 324 73 256M130 300l57-77M129 260l-30-79m31 57 31-88m-31 6-4-53" stroke="currentColor" stroke-width="13" stroke-linecap="round"/><path d="M127 430h16" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M128 43c-29-30-75-6-68 30-40 7-45 61-12 78-9 37 27 63 58 45 18 31 64 27 75-5 38 4 58-42 32-67 21-34-11-77-45-64-7-34-45-47-66-17Z" fill="currentColor" fill-opacity=".24" stroke="currentColor" stroke-width="2"/><path d="M47 112c27 10 44 30 51 57m24-126c-2 31 7 53 26 71m49-48c-26 18-40 41-44 68m59 19c-28-5-49 2-64 22M77 51c8 26 23 43 46 53" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".75"/></svg>' ;
  ['left','right'].forEach(function(side){var oak=document.createElement('div');oak.className='garden-tree garden-tree--'+side;oak.innerHTML=tree;layer.appendChild(oak);});
  body.insertBefore(layer,body.firstChild);

  var button=document.createElement('button');
  button.type='button';button.className='garden-sound-toggle';button.setAttribute('aria-pressed','true');
  button.setAttribute('aria-label','إيقاف صوت الحديقة');button.title='صوت هادئ لنسيم الأوراق وأجراس الريح';
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/></svg><span class="garden-sound-label">صوت هادئ يعمل · إيقاف</span>';
  body.appendChild(button);

  var AudioContextClass=window.AudioContext||window.webkitAudioContext;
  var context=null,master=null,started=false,enabled=true,hasChimed=false,chimeTimer=null,ambientNodes=[];
  var playingAudio=new Set(),ducked=false;
  var reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function announce(){
    button.setAttribute('aria-pressed',String(enabled));
    button.setAttribute('aria-label',enabled?'إيقاف صوت الحديقة':'تشغيل صوت الحديقة');
    button.title=enabled?'إيقاف صوت النسيم والأجراس':'تشغيل صوت النسيم والأجراس';
    var label=button.querySelector('.garden-sound-label');
    if(label)label.textContent=enabled?(context&&context.state==='running'?'صوت هادئ يعمل · إيقاف':'الصوت جاهز · اضغط للتشغيل'):'تشغيل الصوت الهادئ';
  }
  function makeBrownNoise(seconds){
    var length=Math.max(1,Math.floor(context.sampleRate*seconds));
    var buffer=context.createBuffer(1,length,context.sampleRate);
    var data=buffer.getChannelData(0),last=0;
    for(var i=0;i<length;i++){var white=Math.random()*2-1;last=(last+.02*white)/1.02;data[i]=last*3.4;}
    return buffer;
  }
  function buildGarden(){
    if(!context||started)return;
    started=true;
    master=context.createGain();master.gain.value=.0001;master.connect(context.destination);
    var noise=makeBrownNoise(4);
    [[430,.14,.055,135,.045],[1460,.075,.031,390,.024]].forEach(function(cfg){
      var source=context.createBufferSource();source.buffer=noise;source.loop=true;
      var filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=cfg[0];filter.Q.value=.55;
      var gain=context.createGain();gain.gain.value=.0001;
      var drift=context.createOscillator(),driftGain=context.createGain();drift.type='sine';drift.frequency.value=cfg[2];driftGain.gain.value=cfg[3];drift.connect(driftGain);driftGain.connect(filter.frequency);
      var swell=context.createOscillator(),swellGain=context.createGain();swell.type='sine';swell.frequency.value=cfg[2]*.42;swellGain.gain.value=cfg[4];swell.connect(swellGain);swellGain.connect(gain.gain);
      source.connect(filter);filter.connect(gain);gain.connect(master);
      source.start();drift.start();swell.start();
      ambientNodes.push(source,drift,swell);
      gain.gain.setTargetAtTime(cfg[1],context.currentTime,.8);
    });
    scheduleChime();
  }
  function setLevel(target){
    if(!context||!master)return;
    var level=target;
    if(ducked)level*=.12;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(level,context.currentTime,.45);
  }
  function makeBell(frequency,duration,offset,peak){
    if(!context||!master||!enabled||ducked)return;
    var start=context.currentTime+(offset||0);
    [[1,1],[2.76,.3],[5.4,.1]].forEach(function(part){
      var oscillator=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter();
      oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency*part[0],start);oscillator.detune.value=Math.random()*7-3.5;
      filter.type='lowpass';filter.frequency.setValueAtTime(frequency*part[0]*3.4,start);
      gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.00015,peak*part[1]),start+.02);gain.gain.exponentialRampToValueAtTime(.0001,start+duration*(part[0]>1?.45:1));
      oscillator.connect(filter);filter.connect(gain);gain.connect(master);oscillator.start(start);oscillator.stop(start+duration+.1);
    });
  }
  function chime(){
    if(!enabled||!context||context.state!=='running')return;
    if(!ducked&&!document.hidden){var scale=[523.25,587.33,659.25,783.99,880,1046.5],note=scale[Math.floor(Math.random()*scale.length)];makeBell(note,2.1,0,.014);if(Math.random()<.46)makeBell(scale[Math.floor(Math.random()*scale.length)]*2,1.5,.4+Math.random()*.9,.006);}
    scheduleChime();
  }
  function scheduleChime(){clearTimeout(chimeTimer);if(enabled)chimeTimer=window.setTimeout(chime,7000+Math.random()*10000);}
  function setDucked(value){
    ducked=!!value;
    if(enabled)setLevel(.20);
  }
  function audioStart(){
    if(!AudioContextClass){button.disabled=true;button.setAttribute('aria-label','الصوت غير مدعوم في هذا المتصفح');var label=button.querySelector('.garden-sound-label');if(label)label.textContent='الصوت غير متاح';return Promise.reject(new Error('Web Audio unavailable'));}
    try{if(!context)context=new AudioContextClass();buildGarden();}
    catch(error){button.disabled=true;return Promise.reject(error);}
    return (context.state==='suspended'?context.resume():Promise.resolve()).then(function(){if(enabled){setLevel(.20);if(!hasChimed){hasChimed=true;makeBell(659.25,2.4,0,.018);makeBell(987.77,1.8,.28,.008);}announce();}scheduleChime();});
  }
  button.addEventListener('click',function(){
    if(!AudioContextClass){audioStart().catch(function(){});return;}
    if(!enabled){enabled=true;hasChimed=false;announce();audioStart().catch(function(){});}
    else if(!context||context.state!=='running'){audioStart().catch(function(){});}
    else{enabled=false;announce();clearTimeout(chimeTimer);setLevel(.0001);}
  });
  function resumeOnGesture(event){
    if(!enabled||!AudioContextClass||event.target===button)return;
    if(!context||context.state!=='running')audioStart().catch(function(){});
  }
  document.addEventListener('pointerdown',resumeOnGesture,{passive:true});
  document.addEventListener('keydown',resumeOnGesture);
  document.addEventListener('play',function(event){var audio=event.target;if(!audio||audio.tagName!=='AUDIO')return;playingAudio.add(audio);setDucked(true);},true);
  function audioStopped(event){var audio=event.target;if(audio&&audio.tagName==='AUDIO'){playingAudio.delete(audio);setDucked(playingAudio.size>0);}}
  document.addEventListener('pause',audioStopped,true);document.addEventListener('ended',audioStopped,true);
  document.addEventListener('visibilitychange',function(){
    if(!context||!enabled)return;
    if(document.hidden){if(context.state==='running')context.suspend().catch(function(){});}
    else{context.resume().then(function(){setLevel(.20);scheduleChime();}).catch(function(){});}
  });
  if(window.speechSynthesis){window.setInterval(function(){if(enabled)setDucked(playingAudio.size>0||window.speechSynthesis.speaking||window.speechSynthesis.pending);},900);}
  window.addEventListener('pagehide',function(event){if(!event.persisted&&context){clearTimeout(chimeTimer);context.close().catch(function(){});}});
  if(!AudioContextClass){button.disabled=true;button.setAttribute('aria-label','الصوت غير مدعوم في هذا المتصفح');var unavailable=button.querySelector('.garden-sound-label');if(unavailable)unavailable.textContent='الصوت غير متاح';}
  announce();
  if(enabled&&AudioContextClass)audioStart().catch(function(){});
})();
