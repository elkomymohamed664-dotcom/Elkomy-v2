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
  var searchForm=document.getElementById('book-search');
  var searchInput=document.getElementById('book-search-input');
  var searchClear=document.getElementById('search-clear');
  var searchFeedback=document.getElementById('search-feedback');
  var searchResultsShell=document.getElementById('search-results-shell');
  var searchResults=document.getElementById('search-results');
  var pageIndex=document.getElementById('page-index');
  var pageThumbnails=document.getElementById('page-thumbnails');
  var pageIndexCount=document.getElementById('page-index-count');
  var highlightStatus=document.getElementById('page-highlight-status');
  var pageReadButton=document.getElementById('page-read-toggle');
  var pageReadLabel=document.getElementById('page-read-label');
  var speechSynthesis=window.speechSynthesis||null;
  var SpeechUtterance=window.SpeechSynthesisUtterance||null;
  var readingMap={};
  if(window.fetch){
    window.fetch('assets/reading-map.json',{cache:'force-cache'})
      .then(function(response){if(!response.ok)throw new Error('Reading map unavailable');return response.json();})
      .then(function(data){readingMap=data&&data.pages?data.pages:{};})
      .catch(function(){readingMap={};});
  }
  if(!stage||!pages.length||!previous||!next||!status||!progress||!progressFill)return;

  var current=0;
  var turning=false;
  var ignoreImageClickUntil=0;
  var midpointTimer=null;
  var finishTimer=null;
  var reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var turnDuration=reducedMotion?0:160;
  var bookName=document.body.getAttribute('data-book-name')||'الإصدار';
  var PageAudio=window.AudioContext||window.webkitAudioContext;
  var audioContext=null;
  var noiseBuffer=null;
  var soundEnabled=!!PageAudio;
  var speechActive=false;
  var speechSession=0;
  var searchIndex=[];
  var activeHighlight=null;
  var highlightAnnouncementTimer=null;
  // Percentages match the original JPG dimensions; table rows need precise tap targets because the art is rasterized.
  var tableHighlightMap={
    'assets/patient-pages/page-06.jpg':{
      title:'جدول مقارنة النباتات الطبية',left:6.8,width:86.5,
      header:{top:16.4,bottom:22.0,label:'عناوين أعمدة جدول المقارنة',speech:'عناوين الجدول: النبات، طريقة الاستخدام، دوره في دوار السفر، درجة الحذر، وأهم الموانع.'},
      rows:[
        {label:'الزنجبيل',top:22.0,bottom:29.0,speech:'الزنجبيل، Zingiber officinale. كبسولات أو أقراص عن طريق الفم. يهدئ المعدة ويخفف الغثيان والقيء والعرق البارد. درجة الحذر: متوسط. أهم المحاذير: أدوية السيولة، اضطرابات النزيف، حصوات المرارة، والتوقف قبل الجراحة بأسبوعين.'},
        {label:'النعناع الفلفلي',top:29.0,bottom:36.35,speech:'النعناع الفلفلي، Mentha × piperita. مستنشق أنفي بالرائحة العطرية. ينعش الحواس ويخفف الشعور المفاجئ بالغثيان أثناء الطريق. لطيف للبالغين، لكنه خطر على الرضع؛ يُمنع قرب وجه أو أنف الرضع والأطفال الصغار، ويُستخدم بحذر لمرضى الارتجاع.'},
        {label:'السيكران الأسود',top:36.35,bottom:43.25,speech:'السيكران الأسود، Hyoscyamus niger. تركيبة صيدلانية معايرة مع الزنجبيل. يمنع إشارة الدوار من مركز التوازن في الدماغ، وله أقوى تأثير. درجة الحذر: عالٍ جدًا. تشمل الموانع المياه الزرقاء، ومشكلات البروستاتا والقلب، والحمل والرضاعة، والأطفال وكبار السن.'}
      ]
    },
    'assets/clinician-pages/page-02.jpg':{
      title:'Phytochemical Profile & Structure–Activity Relationships',left:6.2,width:87.3,
      header:{top:42.2,bottom:45.65,label:'Column headings of the phytochemical profile table',speech:'Table headings: constituent class; key bioactive compounds; chemical or thermal origin; and pharmacological significance.'},
      rows:[
        {label:'Gingerols (Non-volatile)',top:45.65,bottom:50.45,speech:'Gingerols, non-volatile. Key compounds: six-gingerol, the major compound, plus eight- and ten-gingerol. Phenolic arylalkanones with a beta-hydroxy-keto alkyl side chain. Non-competitive five-HT-three blockade; COX-two and five-LOX inhibition; antioxidant activity and TRPV-one activation.'},
        {label:'Shogaols (Dehydrated)',top:50.45,bottom:55.17,speech:'Shogaols, formed by dehydration. Six-, eight- and ten-shogaol; alpha, beta-unsaturated ketones produced from gingerols. Two to three times more pungent, with higher blood-brain barrier permeability; potent anti-five-HT-three and anti-ulcer effects, and N-R-F-two induction.'},
        {label:'Zingerone & Paradols',top:55.17,bottom:60.01,speech:'Zingerone and paradols. Zingerone, also called vanillylacetone, and six-paradol. Formed by thermal retro-aldol cleavage and side-chain reduction. Lower pungency; antidiarrheal, radical-scavenging and anti-inflammatory activity.'},
        {label:'Volatile Oil',top:60.01,bottom:64.92,speech:'Volatile oil, one-point-five to three percent. Alpha-zingiberene, beta-sesquiphellandrene, ar-curcumene and citral. Monocyclic sesquiterpene hydrocarbons and monoterpenes. Carminative aroma, smooth-muscle spasmolysis and gastric mucosal cytoprotection.'}
      ]
    },
    'assets/clinician-pages/page-03.jpg':{
      title:'Phytochemical Constituents, Molecular Targets & Clinical Relevance',left:6.2,width:87.3,
      header:{top:38.2,bottom:40.95,label:'Column headings of the phytochemical constituents table',speech:'Table headings: constituent; European Pharmacopoeia percentage; molecular or cellular target; and clinical and toxicological consequence.'},
      rows:[
        {label:'(−)-Menthol',top:40.95,bottom:45.65,speech:'Minus-menthol, a monoterpene alcohol, thirty to fifty-five percent. TRPM-eight cold agonist; competitive L-type calcium-channel blocker; kappa-opioid modulation. Cooling and decongestant effect; gastrointestinal and lower-esophageal-sphincter smooth-muscle relaxation, with reflux risk; infant laryngospasm trigger.'},
        {label:'Menthone & Isomenthone',top:45.65,bottom:50.26,speech:'Menthone and isomenthone, fourteen to thirty-two percent and one-point-five to ten percent. Ketone precursors to menthol; volatile trigeminal and olfactory stimulants. Sharp peppermint aroma; contributes to inhaled antiemetic efficacy and mucosal irritation.'},
        {label:'Menthofuran & Pulegone',top:50.26,bottom:54.91,speech:'Menthofuran and pulegone, one to nine percent and up to three to four percent. Bioactivated via hepatic cytochrome P-four-fifty to reactive epoxides and alpha, beta-enones. Dose-dependent hepatotoxic potential; strictly limited in pharmacopoeial-grade oil.'},
        {label:'Leaf Phenolics',top:54.91,bottom:59.12,speech:'Leaf phenolics, non-volatile, six-point-six to fifteen percent. Rosmarinic acid, eriocitrin, luteolin-seven-O-rutinoside and hesperidin. Antioxidant and radical-scavenging activity, with mild choleretic and anti-inflammatory effects in infusions.'}
      ]
    },
    'assets/clinician-pages/page-04.jpg':{
      title:'Comparative botanical and safety table',left:6.2,width:87.3,
      header:{top:65.15,bottom:68.75,label:'Column headings of the comparative safety table',speech:'Table headings: botanical species; marker compounds; primary mechanism; risk index; key contraindications; and critical interactions.'},
      rows:[
        {label:'Z. officinale',top:68.75,bottom:73.03,speech:'Zingiber officinale. Markers: six, eight and ten-gingerols, and six-shogaol. Peripheral five-HT-three and N-K-one block; decreased vasopressin. Risk: moderate. Contraindications: bleeding disorders, stop two weeks before surgery, and gallstones. Interactions: warfarin, dabigatran, N-S-A-I-Ds and antidiabetics.'},
        {label:'M. × piperita',top:73.03,bottom:76.98,speech:'Mentha × piperita. Markers: minus-menthol and menthone. T-R-P-M-eight agonism; L-type calcium-channel block in the gastrointestinal tract and lower esophageal sphincter. Risk depends on route. Contraindications: infants under two years for facial oil, reflux disease and biliary disorders. Interactions: antacids and acid-suppressing medicines with enteric capsules, felodipine and cyclosporine.'},
        {label:'H. niger',top:76.98,bottom:80.74,speech:'Hyoscyamus niger. Markers: minus-hyoscyamine and scopolamine. Central and peripheral M-one to M-five blockade; crosses the blood-brain barrier. High risk and narrow therapeutic index. Contraindications: glaucoma, benign prostatic hyperplasia, myasthenia gravis, cardiovascular disease, pregnancy and Down syndrome. Interactions: anticholinergics, antihistamines, tricyclic antidepressants and antipsychotics.'}
      ]
    }
  };

  function digits(number){
    try{return new Intl.NumberFormat('ar-EG').format(number);}
    catch(error){return String(number);}
  }

  function pageCountPhrase(count){
    if(count===1)return 'صفحة واحدة';
    if(count===2)return 'صفحتين';
    return digits(count)+' صفحات';
  }

  function normalizeWithMap(value){
    var source=String(value||'');
    var normalized='';
    var offsets=[];
    var marks=/[\u064b-\u065f\u0670\u06d6-\u06ed]/g;
    for(var i=0;i<source.length;i++){
      var part=source.charAt(i);
      try{if(part.normalize)part=part.normalize('NFKC');}catch(error){}
      part=part.toLowerCase().replace(marks,'').replace(/\u0640/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي');
      for(var j=0;j<part.length;j++){
        var character=part.charAt(j);
        if(/\s/.test(character)){
          if(!normalized||normalized.charAt(normalized.length-1)===' ')continue;
          normalized+=' ';
          offsets.push(i);
        }else{
          normalized+=character;
          offsets.push(i);
        }
      }
    }
    return {value:normalized,map:offsets};
  }

  function buildSearchIndex(){
    searchIndex=pages.map(function(page,index){
      var title=page.getAttribute('data-page-title')||('صفحة '+digits(index+1));
      var transcript=page.querySelector('.page-transcript pre');
      var text=title+'\n'+(transcript?transcript.textContent:'');
      return {index:index,title:title,text:text,normalized:normalizeWithMap(text)};
    });
  }

  function clearHighlight(){
    if(highlightAnnouncementTimer){
      window.clearTimeout(highlightAnnouncementTimer);
      highlightAnnouncementTimer=null;
    }
    if(highlightStatus)highlightStatus.textContent='';
    if(!activeHighlight)return;
    activeHighlight.visual.classList.remove('has-highlight');
    if(activeHighlight.button)activeHighlight.button.setAttribute('aria-pressed','false');
    activeHighlight=null;
  }

  function announceHighlight(message){
    if(!highlightStatus)return;
    if(highlightAnnouncementTimer)window.clearTimeout(highlightAnnouncementTimer);
    highlightStatus.textContent='';
    highlightAnnouncementTimer=window.setTimeout(function(){
      highlightStatus.textContent=message;
      highlightAnnouncementTimer=null;
    },30);
  }

  function showHighlight(visual,geometry,label,pageNumber,button){
    if(activeHighlight){
      activeHighlight.visual.classList.remove('has-highlight');
      if(activeHighlight.button)activeHighlight.button.setAttribute('aria-pressed','false');
    }
    var layer=visual.querySelector('.page-selection-highlight');
    if(!layer)return;
    layer.style.left=geometry.left+'%';
    layer.style.top=geometry.top+'%';
    layer.style.width=geometry.width+'%';
    layer.style.height=geometry.height+'%';
    visual.classList.remove('has-highlight');
    void visual.offsetWidth;
    visual.classList.add('has-highlight');
    if(button)button.setAttribute('aria-pressed','true');
    activeHighlight={visual:visual,button:button||null};
    announceHighlight('تم تظليل '+label+' في صفحة '+digits(pageNumber)+'.');
    playSelectionSound();
  }

  function selectAtPoint(visual,image,clientX,clientY,pageNumber){
    var rect=image.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    var width=44;
    var height=4.8;
    var centerX=Math.max(0,Math.min(100,((clientX-rect.left)/rect.width)*100));
    var centerY=Math.max(0,Math.min(100,((clientY-rect.top)/rect.height)*100));
    var left=Math.max(0,Math.min(100-width,centerX-width/2));
    var top=Math.max(0,Math.min(100-height,centerY-height/2));
    showHighlight(visual,{left:left,top:top,width:width,height:height},'المعلومة في الموضع المحدد',pageNumber,null);
  }

  function pageReadingData(image){
    return readingMap[image.getAttribute('src')||'']||null;
  }

  function nearestReadingSegment(image,clientX,clientY){
    var data=pageReadingData(image);
    var rect=image.getBoundingClientRect();
    if(!data||!data.segments||!data.segments.length||!rect.width||!rect.height)return null;
    var scaleX=data.width/rect.width;
    var scaleY=data.height/rect.height;
    var pointX=(clientX-rect.left)*scaleX;
    var pointY=(clientY-rect.top)*scaleY;
    var paddingX=Math.max(18,18*scaleX);
    var paddingY=Math.max(22,18*scaleY);
    var best=null;
    var bestDistance=Infinity;
    data.segments.forEach(function(segment){
      var x=segment[0],y=segment[1],right=x+segment[2],bottom=y+segment[3];
      var dx=pointX<x?x-pointX:(pointX>right?pointX-right:0);
      var dy=pointY<y?y-pointY:(pointY>bottom?pointY-bottom:0);
      var distance=Math.sqrt(Math.pow(dx/paddingX,2)+Math.pow(dy/paddingY,2));
      if(distance<bestDistance){bestDistance=distance;best=segment;}
    });
    if(!best||bestDistance>1.35)return null;
    return {data:data,segment:best};
  }

  function readingHighlightGeometry(data,segment){
    var naturalHeight=data.height||1686;
    var naturalWidth=data.width||1192;
    var width=Math.max(2.8,(segment[2]/naturalWidth)*100);
    var height=Math.max(1.6,(segment[3]/naturalHeight)*100);
    var left=(segment[0]/naturalWidth)*100;
    var top=(segment[1]/naturalHeight)*100;
    left=Math.max(0,Math.min(100-width,left-.25));
    top=Math.max(0,Math.min(100-height,top-(height-segment[3]/naturalHeight*100)/2));
    return {left:left,top:top,width:Math.min(100-left,width+.5),height:height};
  }

  function selectReadingAtPoint(visual,image,clientX,clientY,pageNumber){
    var hit=nearestReadingSegment(image,clientX,clientY);
    if(!hit){selectAtPoint(visual,image,clientX,clientY,pageNumber);return;}
    showHighlight(visual,readingHighlightGeometry(hit.data,hit.segment),'السطر المحدد',pageNumber,null);
    speakText(hit.segment[4]);
  }

  function speechLanguage(text){
    var arabic=(String(text).match(/[\u0600-\u06ff]/g)||[]).length;
    var latin=(String(text).match(/[A-Za-z]/g)||[]).length;
    return arabic&&arabic>=latin*.55?'ar-EG':'en-US';
  }

  function splitSpeechText(value){
    var remaining=String(value||'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim();
    var chunks=[];
    var maxLength=220;
    while(remaining.length>maxLength){
      var cut=remaining.lastIndexOf(' ',maxLength);
      var punctuation=remaining.slice(90,maxLength).search(/[.!?؟؛،;:](?:\s|$)/);
      if(punctuation>=0)cut=90+punctuation+1;
      if(cut<80)cut=maxLength;
      chunks.push(remaining.slice(0,cut).trim());
      remaining=remaining.slice(cut).trim();
    }
    if(remaining)chunks.push(remaining);
    return chunks;
  }

  function updatePageReadButton(){
    if(!pageReadButton)return;
    var supported=!!(speechSynthesis&&SpeechUtterance&&typeof speechSynthesis.speak==='function');
    pageReadButton.disabled=!supported;
    pageReadButton.setAttribute('aria-pressed',String(speechActive&&supported));
    pageReadButton.setAttribute('aria-label',supported
      ?(speechActive?'إيقاف القراءة الصوتية':'استمع إلى نص الصفحة الحالية')
      :'القراءة الصوتية غير متاحة في هذا المتصفح');
    pageReadButton.title=supported
      ?(speechActive?'إيقاف القراءة الصوتية':'استمع إلى نص الصفحة الحالية')
      :'القراءة الصوتية غير متاحة في هذا المتصفح';
    if(pageReadLabel)pageReadLabel.textContent=supported
      ?(speechActive?'إيقاف القراءة':'استمع إلى الصفحة')
      :'القراءة غير متاحة';
  }

  function stopSpeech(){
    speechSession++;
    if(speechSynthesis&&typeof speechSynthesis.cancel==='function'){
      try{speechSynthesis.cancel();}catch(error){}
    }
    speechActive=false;
    updatePageReadButton();
  }

  function speakText(value){
    if(!speechSynthesis||!SpeechUtterance||typeof speechSynthesis.speak!=='function')return false;
    var chunks=splitSpeechText(value);
    if(!chunks.length)return false;
    stopSpeech();
    var session=speechSession;
    speechActive=true;
    updatePageReadButton();

    function speakNext(){
      if(session!==speechSession)return;
      if(!chunks.length){speechActive=false;updatePageReadButton();return;}
      var utterance;
      try{utterance=new SpeechUtterance(chunks.shift());}
      catch(error){speechActive=false;updatePageReadButton();return;}
      var language=speechLanguage(utterance.text);
      utterance.lang=language;
      utterance.rate=.94;
      utterance.pitch=1;
      utterance.volume=1;
      if(typeof speechSynthesis.getVoices==='function'){
        var voices=speechSynthesis.getVoices()||[];
        var locale=language.toLowerCase();
        var prefix=language.slice(0,2).toLowerCase();
        var voice=voices.filter(function(item){return item.lang&&item.lang.toLowerCase()===locale;})[0]
          ||voices.filter(function(item){return item.lang&&item.lang.toLowerCase().indexOf(prefix)===0;})[0];
        if(voice)utterance.voice=voice;
      }
      utterance.onend=speakNext;
      utterance.onerror=function(event){
        if(session!==speechSession)return;
        speechActive=false;
        updatePageReadButton();
        if(event&&event.error&&event.error!=='canceled'&&event.error!=='interrupted'){
          announceHighlight('تعذرت القراءة الصوتية. جرّب تشغيلها مرة أخرى.');
        }
      };
      try{speechSynthesis.speak(utterance);}
      catch(error){speechActive=false;updatePageReadButton();}
    }

    speakNext();
    return true;
  }

  function makeTableHotspot(visual,pageIndex,table,entry,isHeader){
    var top=isHeader?table.header.top:entry.top;
    var bottom=isHeader?table.header.bottom:entry.bottom;
    var label=isHeader?table.header.label:entry.label;
    var button=document.createElement('button');
    button.type='button';
    button.className='table-row-hotspot';
    button.style.left=table.left+'%';
    button.style.top=top+'%';
    button.style.width=table.width+'%';
    button.style.height=(bottom-top)+'%';
    button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-label','تظليل وقراءة '+(isHeader?'رؤوس الأعمدة':'صف '+label)+' من '+table.title+'، صفحة '+digits(pageIndex+1));
    button.title=isHeader?'تظليل عناوين الجدول وقراءتها':'تظليل وقراءة صف '+label;
    button.addEventListener('click',function(event){
      event.stopPropagation();
      showHighlight(visual,{left:table.left,top:top,width:table.width,height:bottom-top},
        isHeader?'عناوين الجدول':label,pageIndex+1,button);
      var speechText=isHeader?table.header.speech:entry.speech;
      if(speechText)speakText(speechText);
    });
    visual.appendChild(button);
  }

  function buildPageInteractions(){
    pages.forEach(function(page,index){
      var image=page.querySelector('.page-image');
      if(!image||!image.parentNode)return;
      var visual=document.createElement('div');
      var figure=image.parentNode;
      var title=page.getAttribute('data-page-title')||('صفحة '+digits(index+1));
      visual.className='page-visual';
      visual.tabIndex=0;
      visual.setAttribute('role','group');
      visual.setAttribute('aria-label','محتوى '+title+'؛ اضغط على سطر لقراءته وتظليله، أو اختر صفًا من الجدول لقراءته كاملًا.');
      figure.insertBefore(visual,image);
      visual.appendChild(image);
      var layer=document.createElement('span');
      layer.className='page-selection-highlight';
      layer.setAttribute('aria-hidden','true');
      visual.appendChild(layer);
      var table=tableHighlightMap[image.getAttribute('src')];
      if(table){
        makeTableHotspot(visual,index,table,table.header,true);
        table.rows.forEach(function(row){makeTableHotspot(visual,index,table,row,false);});
      }
      visual.addEventListener('click',function(event){
        if(turning||Date.now()<ignoreImageClickUntil||event.target.closest('.table-row-hotspot')||!event.target.closest('.page-image'))return;
        selectReadingAtPoint(visual,image,event.clientX,event.clientY,index+1);
      });
      visual.addEventListener('keydown',function(event){
        if(event.target!==visual)return;
        if(event.key==='Enter'||event.key===' '){
          event.preventDefault();
          var rect=image.getBoundingClientRect();
          selectReadingAtPoint(visual,image,rect.left+rect.width/2,rect.top+rect.height/2,index+1);
        }
      });
    });
  }

  function buildPageIndex(){
    if(!pageThumbnails)return;
    pageThumbnails.textContent='';
    pages.forEach(function(page,index){
      var title=page.getAttribute('data-page-title')||'صفحة '+digits(index+1);
      var pageImage=page.querySelector('.page-image');
      var item=document.createElement('li');
      var button=document.createElement('button');
      var imageFrame=document.createElement('span');
      var image=document.createElement('img');
      var caption=document.createElement('span');
      var number=document.createElement('strong');
      var label=document.createElement('span');

      button.type='button';
      button.className='page-thumb';
      button.setAttribute('data-page-index',String(index));
      button.setAttribute('aria-label','اذهب إلى الصفحة '+digits(index+1)+': '+title);
      if(index===current)button.setAttribute('aria-current','page');
      imageFrame.className='page-thumb-image';
      image.alt='';
      image.setAttribute('aria-hidden','true');
      image.loading='eager';
      image.decoding='async';
      if(pageImage)image.src=pageImage.getAttribute('src');
      caption.className='page-thumb-caption';
      number.textContent=digits(index+1);
      label.textContent=title;
      caption.appendChild(number);
      caption.appendChild(label);
      imageFrame.appendChild(image);
      button.appendChild(imageFrame);
      button.appendChild(caption);
      item.appendChild(button);
      pageThumbnails.appendChild(item);
      button.addEventListener('click',function(){goToPage(index);});
    });
    if(pageIndexCount)pageIndexCount.textContent=pageCountPhrase(pages.length);
  }

  function updateSoundControl(){
    if(!soundButton)return;
    soundButton.setAttribute('aria-pressed',String(soundEnabled));
    soundButton.setAttribute('aria-label',soundEnabled?'كتم صوت التقليب وتظليل المعلومات':'تشغيل صوت التقليب وتظليل المعلومات');
    soundButton.title=soundEnabled?'كتم صوت التقليب وتظليل المعلومات':'تشغيل صوت التقليب وتظليل المعلومات';
    if(soundLabel)soundLabel.textContent=soundEnabled?'الصوت: يعمل':'الصوت: مكتوم';
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
    stage.setAttribute('aria-busy',String(turning));
    if(pageThumbnails){
      Array.prototype.forEach.call(pageThumbnails.querySelectorAll('[data-page-index]'),function(button){
        var isCurrent=Number(button.getAttribute('data-page-index'))===current;
        button.disabled=turning;
        if(isCurrent)button.setAttribute('aria-current','page');
        else button.removeAttribute('aria-current');
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-jump-page]'),function(button){button.disabled=turning;});
    if(searchResults)Array.prototype.forEach.call(searchResults.querySelectorAll('[data-page-index]'),function(button){button.disabled=turning;});
  }

  function appendHighlightedSnippet(target,entry,matchStart,matchEnd){
    var snippetStart=Math.max(0,matchStart-62);
    var snippetEnd=Math.min(entry.text.length,matchEnd+96);
    var before=entry.text.slice(snippetStart,matchStart).replace(/\s+/g,' ');
    var matched=entry.text.slice(matchStart,matchEnd).replace(/\s+/g,' ');
    var after=entry.text.slice(matchEnd,snippetEnd).replace(/\s+/g,' ');
    if(snippetStart>0)target.appendChild(document.createTextNode('…'));
    target.appendChild(document.createTextNode(before));
    if(matched){
      var mark=document.createElement('mark');
      mark.textContent=matched;
      target.appendChild(mark);
    }
    target.appendChild(document.createTextNode(after));
    if(snippetEnd<entry.text.length)target.appendChild(document.createTextNode('…'));
  }

  function renderSearchResults(){
    if(!searchInput||!searchResults||!searchResultsShell)return;
    var rawQuery=searchInput.value.trim();
    var query=normalizeWithMap(rawQuery).value.trim();
    searchResults.textContent='';
    searchResultsShell.hidden=true;
    if(searchClear)searchClear.hidden=!rawQuery;
    if(!rawQuery){
      if(searchFeedback)searchFeedback.textContent='ابحث في نصوص الصفحات الكاملة، بالعربية أو الإنجليزية.';
      return;
    }
    if(query.length<2){
      if(searchFeedback)searchFeedback.textContent='اكتب حرفين على الأقل لبدء البحث.';
      return;
    }

    var matches=[];
    searchIndex.forEach(function(entry){
      var matchAt=entry.normalized.value.indexOf(query);
      if(matchAt<0)return;
      var matchStart=entry.normalized.map[matchAt];
      var lastIndex=entry.normalized.map[Math.min(entry.normalized.map.length-1,matchAt+query.length-1)];
      if(matchStart===undefined||lastIndex===undefined)return;
      matches.push({entry:entry,start:matchStart,end:lastIndex+1});
    });

    if(searchFeedback){
      searchFeedback.textContent=matches.length
        ?'عُثر على نتائج مطابقة في '+pageCountPhrase(matches.length)+'. اختر نتيجة للانتقال إليها.'
        :'لم نعثر على صفحات تطابق «'+rawQuery+'». جرّب مصطلحًا آخر.';
    }
    if(!matches.length)return;

    matches.forEach(function(match){
      var item=document.createElement('li');
      var button=document.createElement('button');
      var meta=document.createElement('span');
      var pageNumber=document.createElement('strong');
      var title=document.createElement('span');
      var snippet=document.createElement('span');
      button.type='button';
      button.className='search-result';
      button.disabled=turning;
      button.setAttribute('data-page-index',String(match.entry.index));
      meta.className='search-result-meta';
      pageNumber.textContent='صفحة '+digits(match.entry.index+1);
      title.className='search-result-title';
      title.textContent=match.entry.title;
      snippet.className='search-result-snippet';
      snippet.dir='auto';
      appendHighlightedSnippet(snippet,match.entry,match.start,match.end);
      meta.appendChild(pageNumber);
      button.appendChild(meta);
      button.appendChild(title);
      button.appendChild(snippet);
      button.addEventListener('click',function(){
        goToPage(match.entry.index);
        if(searchFeedback)searchFeedback.textContent='انتقلت إلى صفحة '+digits(match.entry.index+1)+': '+match.entry.title;
      });
      item.appendChild(button);
      searchResults.appendChild(item);
    });
    searchResultsShell.hidden=false;
  }

  function goToPage(index){
    if(turning||index<0||index>=pages.length)return;
    var wasCurrent=index===current;
    turnTo(index);
    if(pageIndex)pageIndex.open=false;
    if(searchResultsShell)searchResultsShell.hidden=true;
    if(wasCurrent&&stage.scrollIntoView){
      stage.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'start'});
    }
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

  function audioReady(){
    if(!PageAudio)return Promise.resolve(null);
    try{if(!audioContext)audioContext=new PageAudio();}
    catch(error){return Promise.resolve(null);}
    if(audioContext.state==='suspended')return audioContext.resume().then(function(){return audioContext;}).catch(function(){return null;});
    return Promise.resolve(audioContext);
  }

  function makePageNoise(context){
    if(noiseBuffer)return noiseBuffer;
    var duration=.42;
    var length=Math.floor(context.sampleRate*duration);
    var buffer=context.createBuffer(1,length,context.sampleRate);
    var samples=buffer.getChannelData(0);
    for(var i=0;i<length;i++){
      var time=i/context.sampleRate;
      var attack=Math.min(1,time/.012);
      var first=Math.exp(-Math.pow((time-.055)/.043,2));
      var second=.72*Math.exp(-Math.pow((time-.18)/.067,2));
      var tail=.4*Math.exp(-Math.pow((time-.32)/.05,2));
      samples[i]=(Math.random()*2-1)*attack*(first+second+tail)*.7;
    }
    noiseBuffer=buffer;
    return buffer;
  }

  function playPageTurnSound(){
    if(!soundEnabled||!PageAudio)return;
    audioReady().then(function(context){
      if(!context||!soundEnabled)return;
      try{
        var source=context.createBufferSource();
        var high=context.createBiquadFilter();
        var low=context.createBiquadFilter();
        var gain=context.createGain();
        source.buffer=makePageNoise(context);
        high.type='highpass';high.frequency.value=340;
        low.type='lowpass';low.frequency.value=6200;
        gain.gain.value=.48;
        source.connect(high);high.connect(low);low.connect(gain);gain.connect(context.destination);
        source.start();
      }catch(error){/* Audio is optional; page navigation always remains available. */}
    }).catch(function(){});
  }

  function playSelectionSound(){
    if(!soundEnabled||!PageAudio)return;
    audioReady().then(function(context){
      if(!context||!soundEnabled)return;
      try{
        var now=context.currentTime;
        var oscillator=context.createOscillator();
        var envelope=context.createGain();
        oscillator.type='sine';
        oscillator.frequency.setValueAtTime(680,now);
        oscillator.frequency.exponentialRampToValueAtTime(920,now+.075);
        envelope.gain.setValueAtTime(.0001,now);
        envelope.gain.exponentialRampToValueAtTime(.075,now+.012);
        envelope.gain.exponentialRampToValueAtTime(.0001,now+.15);
        oscillator.connect(envelope);
        envelope.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now+.16);
      }catch(error){/* Audio is optional; highlighting always remains available. */}
    }).catch(function(){});
  }

  function turnTo(index){
    if(turning||index<0||index>=pages.length||index===current)return;
    stopSpeech();
    clearHighlight();
    playPageTurnSound();
    if(turnDuration===0){
      reflectPage(index);
      if(stage.scrollIntoView)stage.scrollIntoView({behavior:'auto',block:'start'});
      return;
    }

    var oldPage=pages[current];
    var newPage=pages[index];
    var direction=index>current?'forward':'backward';
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
  if(searchForm)searchForm.addEventListener('submit',function(event){
    event.preventDefault();
    renderSearchResults();
    var firstResult=searchResults&&searchResults.querySelector('[data-page-index]');
    if(firstResult)firstResult.click();
  });
  if(searchInput){
    searchInput.addEventListener('input',renderSearchResults);
    searchInput.addEventListener('search',renderSearchResults);
  }
  if(searchClear)searchClear.addEventListener('click',function(){
    if(searchInput)searchInput.value='';
    renderSearchResults();
    if(searchInput)searchInput.focus();
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-jump-page]'),function(button){
    button.addEventListener('click',function(){
      goToPage(Number(button.getAttribute('data-jump-page'))-1);
    });
  });
  if(soundButton){
    if(!PageAudio){
      soundEnabled=false;
      soundButton.disabled=true;
      soundButton.title='الصوت غير مدعوم في هذا المتصفح';
      soundButton.setAttribute('aria-label','الصوت غير مدعوم في هذا المتصفح');
      if(soundLabel)soundLabel.textContent='الصوت غير متاح';
    }else{
      soundButton.addEventListener('click',function(){
        soundEnabled=!soundEnabled;
        updateSoundControl();
        if(soundEnabled)audioReady();
      });
      updateSoundControl();
    }
  }
  if(pageReadButton){
    pageReadButton.addEventListener('click',function(){
      if(speechActive){stopSpeech();return;}
      var transcript=pages[current].querySelector('.page-transcript pre');
      speakText(transcript?transcript.textContent:(pages[current].getAttribute('data-page-title')||''));
    });
    updatePageReadButton();
  }

  stage.addEventListener('click',function(event){
    var image=event.target.closest('.page-image');
    var visual=image&&image.closest('.page-visual');
    if(visual)visual.focus({preventScroll:true});
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
    ignoreImageClickUntil=Date.now()+450;
    if(dx<0)turnTo(current+1);else turnTo(current-1);
  });
  stage.addEventListener('pointercancel',function(){swipeStart=null;});

  var hash=window.location.hash.match(/^#page-(\d+)$/);
  var first=hash?Math.min(pages.length-1,Math.max(0,Number(hash[1])-1)):0;
  pages.forEach(function(page,index){page.hidden=index!==first;});
  current=first;
  buildPageInteractions();
  buildPageIndex();
  buildSearchIndex();
  updateControls();
})();
