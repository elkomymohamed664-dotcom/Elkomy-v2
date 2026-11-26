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
  var searchForm=document.getElementById('transcript-search');
  var searchInput=document.getElementById('reader-search');
  var searchResults=document.getElementById('search-results');
  var pageSelect=document.getElementById('page-select');
  var bookmarkButton=document.getElementById('bookmark-toggle');
  var themeButton=document.getElementById('theme-toggle');
  if(!stage||!pages.length||!previous||!next||!status||!progress||!progressFill)return;

  var current=0;
  var turning=false;
  var midpointTimer=null;
  var finishTimer=null;
  var reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var turnDuration=reducedMotion?0:160;
  var bookName=document.body.getAttribute('data-book-name')||'الإصدار';
  var storageKey='phyto-reader:'+window.location.pathname;
  var PageAudio=window.AudioContext||window.webkitAudioContext;
  var audioContext=null;
  var noiseBuffer=null;
  var soundEnabled=!!PageAudio;
  var bookmarks=[];
  function readStored(key,fallback){try{var value=window.localStorage.getItem(key);return value===null?fallback:value;}catch(error){return fallback;}}
  function writeStored(key,value){try{window.localStorage.setItem(key,value);}catch(error){/* Reading still works when storage is unavailable. */}}
  try{bookmarks=JSON.parse(readStored(storageKey+':bookmarks','[]'))||[];}catch(error){bookmarks=[];}
  if(!Array.isArray(bookmarks))bookmarks=[];

  function digits(number){try{return new Intl.NumberFormat('ar-EG').format(number);}catch(error){return String(number);}}
  function normalize(value){return String(value||'').toLocaleLowerCase('ar').normalize('NFD').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/\s+/g,' ').trim();}
  function updateSoundControl(){
    if(!soundButton)return;
    soundButton.setAttribute('aria-pressed',String(soundEnabled));
    soundButton.setAttribute('aria-label',soundEnabled?'كتم صوت تقليب الصفحات':'تشغيل صوت تقليب الصفحات');
    soundButton.title=soundEnabled?'كتم صوت تقليب الصفحات':'تشغيل صوت تقليب الصفحات';
    if(soundLabel)soundLabel.textContent=soundEnabled?'الصوت: يعمل':'الصوت: مكتوم';
  }
  function updateBookmarkControl(){
    if(!bookmarkButton)return;
    var saved=bookmarks.indexOf(current)!==-1;
    bookmarkButton.setAttribute('aria-pressed',String(saved));
    bookmarkButton.textContent=saved?'★ الصفحة محفوظة':'☆ حفظ الصفحة';
  }
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
    if(pageSelect)pageSelect.value=String(current);
    updateBookmarkControl();
  }
  function savePosition(index){writeStored(storageKey+':last-page',String(index));}
  function reflectPage(index){
    pages.forEach(function(page,pageIndex){page.hidden=pageIndex!==index;page.classList.remove('turning-forward','turning-backward','entering-forward','entering-backward');});
    current=index;updateControls();savePosition(index);
    try{window.history.replaceState(null,'',window.location.pathname+window.location.search+'#page-'+(index+1));}catch(error){}
  }
  function audioReady(){
    if(!PageAudio)return Promise.resolve(null);
    try{if(!audioContext)audioContext=new PageAudio();}catch(error){return Promise.resolve(null);}
    if(audioContext.state==='suspended')return audioContext.resume().then(function(){return audioContext;}).catch(function(){return null;});
    return Promise.resolve(audioContext);
  }
  function makePageNoise(context){
    if(noiseBuffer)return noiseBuffer;
    var duration=.42;var length=Math.floor(context.sampleRate*duration);var buffer=context.createBuffer(1,length,context.sampleRate);var samples=buffer.getChannelData(0);
    for(var i=0;i<length;i++){var time=i/context.sampleRate;var attack=Math.min(1,time/.012);var first=Math.exp(-Math.pow((time-.055)/.043,2));var second=.72*Math.exp(-Math.pow((time-.18)/.067,2));var tail=.4*Math.exp(-Math.pow((time-.32)/.05,2));samples[i]=(Math.random()*2-1)*attack*(first+second+tail)*.7;}
    noiseBuffer=buffer;return buffer;
  }
  function playPageTurnSound(){
    if(!soundEnabled||!PageAudio)return;
    audioReady().then(function(context){if(!context||!soundEnabled)return;try{var source=context.createBufferSource();var high=context.createBiquadFilter();var low=context.createBiquadFilter();var gain=context.createGain();source.buffer=makePageNoise(context);high.type='highpass';high.frequency.value=340;low.type='lowpass';low.frequency.value=6200;gain.gain.value=.48;source.connect(high);high.connect(low);low.connect(gain);gain.connect(context.destination);source.start();}catch(error){/* Page navigation does not depend on audio. */}}).catch(function(){});
  }
  function turnTo(index){
    if(turning||index<0||index>=pages.length||index===current)return;
    playPageTurnSound();
    if(turnDuration===0){reflectPage(index);if(stage.scrollIntoView)stage.scrollIntoView({behavior:'auto',block:'start'});return;}
    var oldPage=pages[current];var newPage=pages[index];var direction=index>current?'forward':'backward';turning=true;updateControls();oldPage.classList.add('turning-'+direction);
    midpointTimer=window.setTimeout(function(){
      oldPage.hidden=true;oldPage.classList.remove('turning-'+direction);newPage.hidden=false;current=index;newPage.classList.add('entering-'+direction);updateControls();savePosition(index);
      try{window.history.replaceState(null,'',window.location.pathname+window.location.search+'#page-'+(index+1));}catch(error){}
      midpointTimer=null;
    },turnDuration);
    finishTimer=window.setTimeout(function(){newPage.classList.remove('entering-'+direction);turning=false;updateControls();finishTimer=null;if(stage.scrollIntoView)stage.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'start'});},turnDuration*2);
  }
  function buildContents(){
    if(!pageSelect)return;
    pages.forEach(function(page,index){var option=document.createElement('option');option.value=String(index);option.textContent='صفحة '+digits(index+1)+' · '+(page.getAttribute('data-page-title')||'');pageSelect.appendChild(option);});
    pageSelect.addEventListener('change',function(){turnTo(Number(pageSelect.value));});
  }
  function showSearchResults(query){
    if(!searchResults)return;
    searchResults.textContent='';
    var normalized=normalize(query);
    if(!normalized){searchResults.textContent='اكتب كلمة أو عبارة للبحث في نصوص الصفحات.';return;}
    var matches=[];
    pages.forEach(function(page,index){
      var transcript=page.querySelector('.page-transcript pre');
      var haystack=normalize(transcript?transcript.textContent:page.textContent);
      if(haystack.indexOf(normalized)!==-1)matches.push({page:page,index:index});
    });
    if(!matches.length){searchResults.textContent='لا توجد نتائج في صفحات هذا الإصدار. جرّب كلمة أخرى.';return;}
    var summary=document.createElement('span');summary.className='search-summary';summary.textContent='عُثر على الكلمة في '+digits(matches.length)+' صفحة:';searchResults.appendChild(summary);
    matches.forEach(function(match){
      var button=document.createElement('button');button.type='button';button.className='search-result';
      button.textContent='صفحة '+digits(match.index+1)+' · '+(match.page.getAttribute('data-page-title')||'');
      button.addEventListener('click',function(){var transcript=match.page.querySelector('.page-transcript');if(transcript)transcript.open=true;turnTo(match.index);});
      searchResults.appendChild(button);
    });
  }
  if(searchForm&&searchInput)searchForm.addEventListener('submit',function(event){event.preventDefault();showSearchResults(searchInput.value);});
  if(searchInput)searchInput.addEventListener('search',function(){if(!searchInput.value&&searchResults)searchResults.textContent='';});
  if(bookmarkButton)bookmarkButton.addEventListener('click',function(){
    var index=bookmarks.indexOf(current);
    if(index===-1)bookmarks.push(current);else bookmarks.splice(index,1);
    bookmarks.sort(function(a,b){return a-b;});writeStored(storageKey+':bookmarks',JSON.stringify(bookmarks));updateBookmarkControl();
  });
  if(themeButton){
    var day=readStored(storageKey+':day','false')==='true';
    document.body.classList.toggle('reader-day',day);
    function updateThemeButton(){themeButton.setAttribute('aria-pressed',String(day));themeButton.textContent=day?'◐ وضع القراءة الليلي':'☼ وضع القراءة النهاري';}
    themeButton.addEventListener('click',function(){day=!day;document.body.classList.toggle('reader-day',day);writeStored(storageKey+':day',String(day));updateThemeButton();});
    updateThemeButton();
  }

  previous.addEventListener('click',function(){turnTo(current-1);});
  next.addEventListener('click',function(){turnTo(current+1);});
  if(soundButton){
    if(!PageAudio){soundEnabled=false;soundButton.disabled=true;soundButton.title='الصوت غير مدعوم في هذا المتصفح';soundButton.setAttribute('aria-label','الصوت غير مدعوم في هذا المتصفح');if(soundLabel)soundLabel.textContent='الصوت غير متاح';}
    else{soundButton.addEventListener('click',function(){soundEnabled=!soundEnabled;updateSoundControl();if(soundEnabled)audioReady();});updateSoundControl();}
  }
  stage.addEventListener('click',function(event){if(event.target.closest('.page-image'))stage.focus({preventScroll:true});});
  stage.addEventListener('keydown',function(event){
    if(event.target!==stage&&event.target.closest('button,a,summary,input,textarea,select'))return;
    if(event.key==='ArrowLeft'&&current<pages.length-1){event.preventDefault();turnTo(current+1);}else if(event.key==='ArrowRight'&&current>0){event.preventDefault();turnTo(current-1);}
  });
  var swipeStart=null;
  stage.addEventListener('pointerdown',function(event){if(event.pointerType==='mouse'||event.target.closest('button,a,summary,input,textarea,select'))return;swipeStart={x:event.clientX,y:event.clientY};});
  stage.addEventListener('pointerup',function(event){if(!swipeStart)return;var dx=event.clientX-swipeStart.x;var dy=event.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.25)return;if(dx<0)turnTo(current+1);else turnTo(current-1);});
  stage.addEventListener('pointercancel',function(){swipeStart=null;});

  buildContents();
  var hash=window.location.hash.match(/^#page-(\d+)$/);
  var stored=Number(readStored(storageKey+':last-page','0'));
  var first=hash?Math.min(pages.length-1,Math.max(0,Number(hash[1])-1)):Math.min(pages.length-1,Math.max(0,isFinite(stored)?stored:0));
  pages.forEach(function(page,index){page.hidden=index!==first;});
  current=first;updateControls();
})();
