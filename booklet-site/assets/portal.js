(function(){
  'use strict';

  var audio=document.getElementById('welcome-audio');
  var button=document.getElementById('welcome-audio-button');
  var label=document.getElementById('welcome-audio-button-label');
  var status=document.getElementById('welcome-audio-status');
  if(!audio||!button)return;

  function setPlaying(playing){
    button.setAttribute('aria-pressed',String(playing));
    if(label)label.textContent=playing?'إيقاف الإرشاد مؤقتًا':'استمع إلى الإرشاد';
  }

  function explainBlockedPlayback(){
    setPlaying(false);
    if(status)status.textContent='قد يمنع المتصفح التشغيل التلقائي. اضغط «استمع إلى الإرشاد» لتشغيله يدويًا.';
  }

  function playWelcome(){
    var result;
    try{result=audio.play();}
    catch(error){explainBlockedPlayback();return;}
    if(result&&typeof result.then==='function'){
      result.then(function(){
        setPlaying(true);
        if(status)status.textContent='يُشغَّل الآن إرشاد اختيار الإصدار.';
      }).catch(explainBlockedPlayback);
    }
  }

  button.addEventListener('click',function(){
    if(audio.paused){playWelcome();return;}
    audio.pause();
  });
  audio.addEventListener('play',function(){setPlaying(true);});
  audio.addEventListener('pause',function(){
    setPlaying(false);
    if(!audio.ended&&status)status.textContent='توقف الإرشاد مؤقتًا. اضغط الزر لاستكماله.';
  });
  audio.addEventListener('ended',function(){
    setPlaying(false);
    if(status)status.textContent='انتهى الإرشاد. يمكنك اختيار الكتيّب الأول للمريض، أو المرجع الثاني للطبيب أو الصيدلي.';
  });
  audio.addEventListener('error',function(){
    setPlaying(false);
    if(status)status.textContent='تعذّر تحميل الإرشاد الصوتي. حدّث الصفحة أو اختر الإصدار مباشرة.';
  });

  playWelcome();
})();
