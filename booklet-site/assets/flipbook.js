(function(){
  'use strict';
  var stage=document.getElementById('page-stage');
  var pages=Array.prototype.slice.call(document.querySelectorAll('[data-book-page]'));
  var previous=document.getElementById('previous-page');
  var next=document.getElementById('next-page');
  var status=document.getElementById('page-status');
  var progress=document.getElementById('page-progress');
  var progressFill=document.getElementById('progress-fill');
  var soundButton=document.getElementById('sound-toggle');
  var soundLabel=document.getElementById('sound-label');
  var current=0;
  var turning=false;
  var soundEnabled=true;
  var audioContext=null;
  var noiseBuffer=null;
  var midpointTimer=null;
  var finishTimer=null;
  var reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var halfTurn=reducedMotion?0:280;
  var bookName=document.body.getAttribute('data-book-name')||'الكتيّب';
  var PageAudio=window.AudioContext||window.webkitAudioContext;

  function digits(n){try{return new Intl.NumberFormat('ar-EG').format(n);}catch(error){return String(n);}}
  function updateControls(){
    var total=pages.length;
    var page=pages[current];
    if(!page)return;
    status.textContent='صفحة '+digits(current+1)+' من '+digits(total)+' · '+(page.getAttribute('data-page-title')||'');
    previous.disabled=turning||current===0;
    next.disabled=turning||current===total-1;
    progress.setAttribute('aria-valuemax',String(total));
    progress.setAttribute('aria-valuenow',String(current+1));
    progressFill.style.width=((current+1)/total*100)+'%';
    stage.setAttribute('aria-label',bookName+' — الصفحة '+digits(current+1)+' من '+digits(total));
  }
  function reflectPage(index){
    pages.forEach(function(page,i){
      page.hidden=i!==index;
      page.classList.remove('turning-forward','turning-backward','entering-forward','entering-backward');
    });
    current=index;
    updateControls();
    try{history.replaceState(null,'',location.pathname+location.search+'#page-'+(index+1));}catch(error){}
  }
  function clearTurn(){
    if(midpointTimer!==null)clearTimeout(midpointTimer);
    if(finishTimer!==null)clearTimeout(finishTimer);
    midpointTimer=null;finishTimer=null;turning=false;
    pages.forEach(function(page){page.classList.remove('turning-forward','turning-backward','entering-forward','entering-backward');});
  }
  function audioReady(){
    if(!PageAudio)return Promise.resolve(null);
    try{if(!audioContext)audioContext=new PageAudio();}catch(error){return Promise.resolve(null);}
    if(audioContext.state==='suspended')return audioContext.resume().then(function(){return audioContext;}).catch(function(){return null;});
    return Promise.resolve(audioContext);
  }
  function makeNoise(context){
    if(noiseBuffer)return noiseBuffer;
    var duration=.42;
    var length=Math.floor(context.sampleRate*duration);
    var buffer=context.createBuffer(1,length,context.sampleRate);
    var samples=buffer.getChannelData(0);
    for(var i=0;i<length;i++){
      var t=i/context.sampleRate;
      var attack=Math.min(1,t/.012);
      var first=Math.exp(-Math.pow((t-.055)/.043,2));
      var second=.72*Math.exp(-Math.pow((t-.18)/.067,2));
      var tail=.4*Math.exp(-Math.pow((t-.32)/.05,2));
      samples[i]=(Math.random()*2-1)*attack*(first+second+tail)*.7;
    }
    noiseBuffer=buffer;
    return buffer;
  }
  function rustle(){
    if(!soundEnabled)return;
    audioReady().then(function(context){
      if(!context||!soundEnabled)return;
      try{
        var source=context.createBufferSource();
        var high=context.createBiquadFilter();
        var low=context.createBiquadFilter();
        var gain=context.createGain();
        source.buffer=makeNoise(context);
        high.type='highpass';high.frequency.value=340;
        low.type='lowpass';low.frequency.value=6200;
        gain.gain.value=.48;
        source.connect(high);high.connect(low);low.connect(gain);gain.connect(context.destination);
        source.start();
      }catch(error){/* Audio is optional; the HTML book remains usable without it. */}
    });
  }
  function turnTo(index){
    if(turning||index<0||index>=pages.length||index===current)return;
    var oldIndex=current;
    var oldPage=pages[oldIndex];
    var newPage=pages[index];
    var direction=index>oldIndex?'forward':'backward';
    rustle();
    if(halfTurn===0){reflectPage(index);stage.scrollIntoView({behavior:'auto',block:'start'});return;}
    turning=true;
    updateControls();
    oldPage.classList.add('turning-'+direction);
    midpointTimer=setTimeout(function(){
      oldPage.hidden=true;
      oldPage.classList.remove('turning-'+direction);
      newPage.hidden=false;
      current=index;
      newPage.classList.add('entering-'+direction);
      updateControls();
      try{history.replaceState(null,'',location.pathname+location.search+'#page-'+(index+1));}catch(error){}
      midpointTimer=null;
    },halfTurn);
    finishTimer=setTimeout(function(){
      newPage.classList.remove('entering-'+direction);
      turning=false;
      updateControls();
      finishTimer=null;
      stage.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'start'});
    },halfTurn*2);
  }
  previous.addEventListener('click',function(){turnTo(current-1);});
  next.addEventListener('click',function(){turnTo(current+1);});
  soundButton.addEventListener('click',function(){
    soundEnabled=!soundEnabled;
    soundButton.setAttribute('aria-pressed',String(soundEnabled));
    soundButton.setAttribute('aria-label',soundEnabled?'إيقاف صوت تقليب الورق':'تشغيل صوت تقليب الورق');
    soundLabel.textContent=soundEnabled?'صوت الورق: شغّال':'صوت الورق: مكتوم';
    if(soundEnabled)audioReady();
  });
  if(!PageAudio){soundEnabled=false;soundButton.disabled=true;soundButton.setAttribute('aria-pressed','false');soundButton.setAttribute('aria-label','الصوت غير مدعوم في هذا المتصفح');soundLabel.textContent='الصوت غير مدعوم';}
  stage.addEventListener('click',function(event){if(event.target.closest('.page-image'))stage.focus({preventScroll:true});});
  stage.addEventListener('keydown',function(event){
    if(event.target!==stage&&event.target.closest('button,a,summary,input,textarea,select'))return;
    if(event.key==='ArrowLeft'&&current<pages.length-1){event.preventDefault();turnTo(current+1);}
    else if(event.key==='ArrowRight'&&current>0){event.preventDefault();turnTo(current-1);}
  });
  var swipeStart=null;
  stage.addEventListener('pointerdown',function(event){
    if(event.pointerType==='mouse'||event.target.closest('button,a,summary,input,textarea,select'))return;
    swipeStart={x:event.clientX,y:event.clientY};
  });
  stage.addEventListener('pointerup',function(event){
    if(!swipeStart)return;
    var dx=event.clientX-swipeStart.x;
    var dy=event.clientY-swipeStart.y;
    swipeStart=null;
    if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.25)return;
    if(dx<0)turnTo(current+1);else turnTo(current-1);
  });
  stage.addEventListener('pointercancel',function(){swipeStart=null;});

  var hash=location.hash.match(/^#page-(\d+)$/);
  var first=hash?Math.min(pages.length-1,Math.max(0,Number(hash[1])-1)):0;
  pages.forEach(function(page,index){page.hidden=index!==first;});
  current=first;
  updateControls();
})();
