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
  var botanicalLayer=document.createElement('div');
  botanicalLayer.className='garden-specimens';
  botanicalLayer.setAttribute('aria-hidden','true');
  [
    {name:'ginger',src:'assets/garden-ginger-cutout.png',width:664,height:946},
    {name:'peppermint',src:'assets/garden-peppermint-cutout.png',width:806,height:941},
    {name:'henbane',src:'assets/garden-henbane-cutout.png',width:840,height:992}
  ].forEach(function(plant){
    var figure=document.createElement('div');
    figure.className='garden-specimen garden-specimen--'+plant.name;
    var img=document.createElement('img');
    img.src=plant.src;img.alt='';img.width=plant.width;img.height=plant.height;img.decoding='async';
    figure.appendChild(img);botanicalLayer.appendChild(figure);
  });
  layer.appendChild(botanicalLayer);
  body.insertBefore(layer,body.firstChild);

  /* Generate the garden ambience in Web Audio, as on the main site: no media URL. */
  var enabled=true,ducked=false,ctx=null,master=null,chimeTimer=0,playingAudio=new Set();
  var AC=window.AudioContext||window.webkitAudioContext;
  function makeNoise(seconds){
    var length=Math.floor(ctx.sampleRate*seconds),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0),last=0;
    for(var i=0;i<length;i++){var white=Math.random()*2-1;last=(last+.02*white)/1.02;data[i]=last*3.4;}
    return buffer;
  }
  function bell(freq,delay,peak){
    if(!ctx||!master||!enabled||ctx.state!=='running')return;
    var at=ctx.currentTime+(delay||0);
    [[1,1],[2.76,.3],[5.4,.1]].forEach(function(part){
      var osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
      osc.type='sine';osc.frequency.setValueAtTime(freq*part[0],at);osc.detune.value=Math.random()*7-3.5;
      filter.type='lowpass';filter.frequency.setValueAtTime(freq*part[0]*3.4,at);
      gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,(peak||.022)*part[1]),at+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,at+(part[0]>1?.9:2.2));
      osc.connect(filter);filter.connect(gain);gain.connect(master);osc.start(at);osc.stop(at+2.4);
    });
  }
  function scheduleChime(){
    clearTimeout(chimeTimer);chimeTimer=window.setTimeout(function(){
      if(!document.hidden&&enabled&&ctx&&ctx.state==='running'){
        var scale=[523.25,587.33,659.25,783.99,880,1046.5];
        bell(scale[Math.floor(Math.random()*scale.length)],0,.018);
        if(Math.random()<.42)bell(scale[Math.floor(Math.random()*scale.length)]*1.5,.55+Math.random()*.6,.008);
      }
      scheduleChime();
    },7500+Math.random()*9500);
  }
  function initialize(){
    if(!AC)return false;
    if(!ctx){
      try{ctx=new AC();}catch(error){return false;}
      master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
      var noise=makeNoise(5);
      [[390,.018,.05,115,.008],[1280,.008,.035,360,.004]].forEach(function(cfg){
        var src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
        src.buffer=noise;src.loop=true;filter.type='bandpass';filter.frequency.value=cfg[0];filter.Q.value=.55;
        gain.gain.value=.0001;src.connect(filter);filter.connect(gain);gain.connect(master);
        var drift=ctx.createOscillator(),driftGain=ctx.createGain();drift.type='sine';drift.frequency.value=cfg[2];driftGain.gain.value=cfg[3];drift.connect(driftGain);driftGain.connect(filter.frequency);
        var swell=ctx.createOscillator(),swellGain=ctx.createGain();swell.type='sine';swell.frequency.value=cfg[2]*.42;swellGain.gain.value=cfg[4];swell.connect(swellGain);swellGain.connect(gain.gain);
        src.start();drift.start();swell.start();gain.gain.linearRampToValueAtTime(cfg[1],ctx.currentTime+6);
      });
      scheduleChime();
    }
    return true;
  }
  function updateLevel(){
    if(!master||!ctx)return;
    var speaking=ducked||(window.speechSynthesis&&(window.speechSynthesis.speaking||window.speechSynthesis.pending));
    master.gain.setTargetAtTime(enabled?(speaking ? .035 : .15):0,ctx.currentTime,.35);
  }
  function start(){
    if(!enabled||!initialize())return;
    if(ctx.state==='suspended'&&ctx.resume)ctx.resume().then(updateLevel).catch(function(){});
    else updateLevel();
  }
  function setDucked(value){ducked=!!value;updateLevel();}
  function resumeAfterGesture(){if(enabled)start();}
  document.addEventListener('pointerdown',resumeAfterGesture,{passive:true});
  document.addEventListener('keydown',resumeAfterGesture);
  document.addEventListener('play',function(event){var a=event.target;if(a&&a.tagName==='AUDIO'){playingAudio.add(a);setDucked(true);}},true);
  function audioStopped(event){var a=event.target;if(a&&a.tagName==='AUDIO'){playingAudio.delete(a);setDucked(playingAudio.size>0);}}
  document.addEventListener('pause',audioStopped,true);document.addEventListener('ended',audioStopped,true);
  document.addEventListener('visibilitychange',function(){
    if(!ctx)return;
    if(document.hidden&&ctx.suspend)ctx.suspend().catch(function(){});
    else if(enabled)start();
  });
  if(window.speechSynthesis)window.setInterval(updateLevel,800);
  window.addEventListener('pagehide',function(event){if(!event.persisted&&ctx&&ctx.suspend)ctx.suspend();});
  start();
})();
