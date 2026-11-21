(function(){
  'use strict';

  var stage=document.getElementById('page-stage');
  var pages=Array.prototype.slice.call(document.querySelectorAll('[data-book-page]'));
  var previous=document.getElementById('previous-page');
  var next=document.getElementById('next-page');
  var status=document.getElementById('page-status');
  var progress=document.getElementById('page-progress');
  var progressFill=document.getElementById('progress-fill');
  if(!stage||!pages.length||!previous||!next||!status||!progress||!progressFill)return;

  var current=0;
  var turning=false;
  var midpointTimer=null;
  var finishTimer=null;
  var reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var turnDuration=reducedMotion?0:160;
  var bookName=document.body.getAttribute('data-book-name')||'الإصدار';

  function digits(number){
    try{return new Intl.NumberFormat('ar-EG').format(number);}
    catch(error){return String(number);}
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
  }

  function reflectPage(index){
    pages.forEach(function(page,pageIndex){
      page.hidden=pageIndex!==index;
      page.classList.remove('turning-forward','turning-backward','entering-forward','entering-backward');
    });
    current=index;
    updateControls();
    try{window.history.replaceState(null,'',window.location.pathname+window.location.search+'#page-'+(index+1));}catch(error){}
  }

  function turnTo(index){
    if(turning||index<0||index>=pages.length||index===current)return;
    if(turnDuration===0){
      reflectPage(index);
      if(stage.scrollIntoView)stage.scrollIntoView({behavior:'auto',block:'start'});
      return;
    }

    var oldIndex=current;
    var oldPage=pages[oldIndex];
    var newPage=pages[index];
    var direction=index>oldIndex?'forward':'backward';
    turning=true;
    updateControls();
    oldPage.classList.add('turning-'+direction);

    midpointTimer=window.setTimeout(function(){
      oldPage.hidden=true;
      oldPage.classList.remove('turning-'+direction);
      newPage.hidden=false;
      current=index;
      newPage.classList.add('entering-'+direction);
      updateControls();
      try{window.history.replaceState(null,'',window.location.pathname+window.location.search+'#page-'+(index+1));}catch(error){}
      midpointTimer=null;
    },turnDuration);

    finishTimer=window.setTimeout(function(){
      newPage.classList.remove('entering-'+direction);
      turning=false;
      updateControls();
      finishTimer=null;
      if(stage.scrollIntoView)stage.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'start'});
    },turnDuration*2);
  }

  previous.addEventListener('click',function(){turnTo(current-1);});
  next.addEventListener('click',function(){turnTo(current+1);});
  stage.addEventListener('click',function(event){
    if(event.target.closest('.page-image'))stage.focus({preventScroll:true});
  });
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

  var hash=window.location.hash.match(/^#page-(\d+)$/);
  var first=hash?Math.min(pages.length-1,Math.max(0,Number(hash[1])-1)):0;
  pages.forEach(function(page,index){page.hidden=index!==first;});
  current=first;
  updateControls();
})();
