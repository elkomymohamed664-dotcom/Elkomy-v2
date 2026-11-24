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
    }else{
      window.setTimeout(function(){if(audio.paused)explainBlockedPlayback();},350);
    }
  }

  button.addEventListener('click',function(){
    if(audio.paused){playWelcome();return;}
    audio.pause();
  });
  audio.addEventListener('play',function(){
    setPlaying(true);
    if(status)status.textContent='يُشغّل الآن إرشاد اختيار الإصدار.';
  });
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

(function(){
  'use strict';

  var form=document.getElementById('contact-form');
  var status=document.getElementById('contact-status');
  if(!form||!status)return;

  var submit=form.querySelector('button[type="submit"]');
  var submitLabel=submit&&submit.querySelector('span');
  var originalLabel=submitLabel?submitLabel.textContent:'إرسال الرسالة';

  function showStatus(message,state){
    status.textContent=message;
    status.setAttribute('data-state',state||'');
  }

  form.addEventListener('submit',function(event){
    event.preventDefault();
    if(!form.reportValidity())return;

    var fields=new FormData(form);
    var payload={
      name:fields.get('name'),
      email:fields.get('email'),
      message:fields.get('message'),
      website:fields.get('website')
    };
    if(submit)submit.disabled=true;
    if(submitLabel)submitLabel.textContent='جارٍ الإرسال…';
    showStatus('جارٍ إرسال رسالتك…','');

    window.fetch(form.action,{
      method:'POST',
      credentials:'same-origin',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(payload)
    }).then(function(response){
      return response.json().catch(function(){return {};}).then(function(data){
        if(!response.ok||!data.ok){
          var error=new Error(data.message||'تعذّر إرسال الرسالة الآن. حاول لاحقًا.');
          error.publicMessage=data.message||'تعذّر إرسال الرسالة الآن. حاول لاحقًا.';
          throw error;
        }
        form.reset();
        showStatus(data.message||'وصلت رسالتك بنجاح، شكرًا لتواصلك.','success');
      });
    }).catch(function(error){
      showStatus(error&&error.publicMessage||'تعذّر الاتصال بخدمة البريد. تحقق من الاتصال وحاول مرة أخرى.','error');
    }).finally(function(){
      if(submit)submit.disabled=false;
      if(submitLabel)submitLabel.textContent=originalLabel;
    });
  });
})();
