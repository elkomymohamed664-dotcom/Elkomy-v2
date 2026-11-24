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
  var patientFullAudio=document.getElementById('patient-full-audio');
  var patientAudioButton=document.getElementById('patient-audio-play');
  var patientAudioButtonLabel=document.getElementById('patient-audio-play-label');
  var patientAudioStatus=document.getElementById('patient-audio-status');
  var patientAudioIsExcerpt=false;
  var patientAudioExcerptStart=null;
  var patientAudioExcerptEnd=null;
  var patientAudioExcerptPage=0;
  var patientAudioExcerptLabel='';
  var patientAudioExcerptFinished=false;
  var patientAudioPendingCueHandler=null;
  var patientAudioPendingSeekHandler=null;
  var patientAudioSeekTimer=null;
  var patientAudioSections=[
    {index:0,title:'البداية والزنجبيل',start:0,end:116.88},
    {index:1,title:'تحذيرات الزنجبيل',start:116.88,end:208.56},
    {index:2,title:'النعناع الفلفلي واستخدامه',start:208.56,end:281.16},
    {index:3,title:'محاذير النعناع',start:281.16,end:377.84},
    {index:4,title:'السيكران الأسود وآلية عمله',start:377.84,end:461.16},
    {index:5,title:'موانع السيكران وآثاره',start:461.16,end:540.16},
    {index:6,title:'مقارنة المستحضرات والرحلات',start:540.16,end:628.84},
    {index:7,title:'دليل الاستخدام العملي',start:628.84,end:716.84},
    {index:8,title:'قائمة فحص الأمان',start:716.84,end:793.68},
    {index:9,title:'الأسئلة الشائعة والقاعدة الذهبية',start:793.68,end:921.96}
  ];
  var patientAudioScriptSegments=[];
  var patientAudioTimedSegments=[];
  var patientAudioScriptReady=Promise.resolve(false);
  if(patientFullAudio&&window.fetch){
    patientAudioScriptReady=window.fetch('assets/audio/patient-guide-ar-eg.json',{cache:'force-cache'})
      .then(function(response){if(!response.ok)throw new Error('Audio transcript unavailable');return response.json();})
      .then(function(data){
        patientAudioScriptSegments=data&&Array.isArray(data.segments)?data.segments:[];
        patientAudioTimedSegments=patientAudioScriptSegments.map(function(segment,index){
          return {index:index,segment:segment,tokens:timedAudioTokens(segment)};
        }).filter(function(entry){return entry.tokens.length>0;});
        return patientAudioTimedSegments.length>0;
      })
      .catch(function(){patientAudioScriptSegments=[];patientAudioTimedSegments=[];return false;});
  }
  var arabicVoiceSelect=document.getElementById('speech-voice-ar');
  var englishVoiceSelect=document.getElementById('speech-voice-en');
  var speechRateInput=document.getElementById('speech-rate');
  var speechRateValue=document.getElementById('speech-rate-value');
  var speechSettingsNote=document.getElementById('speech-settings-note');
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
  var speechRequest=0;
  var warningSoundTimer=null;
  var warningSoundToken=0;
  var warningOscillators=[];
  var warningSoundResolve=null;
  var availableSpeechVoices=[];
  var speechVoicePreferences={ar:'auto',en:'auto'};
  var speechRate=.9;
  try{
    speechVoicePreferences.ar=window.localStorage.getItem('phyto-booklet-voice-ar')||'auto';
    speechVoicePreferences.en=window.localStorage.getItem('phyto-booklet-voice-en')||'auto';
    var storedRate=Number(window.localStorage.getItem('phyto-booklet-speech-rate'));
    if(storedRate>=.75&&storedRate<=1.1)speechRate=Math.round(storedRate*20)/20;
  }catch(error){}
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

  function showHighlight(visual,geometry,label,pageNumber,button,safety){
    if(activeHighlight){
      activeHighlight.visual.classList.remove('has-highlight');
      if(activeHighlight.button)activeHighlight.button.setAttribute('aria-pressed','false');
    }
    var layer=visual.querySelector('.page-selection-highlight');
    if(!layer)return;
    var safetyLevel=safety||'info';
    layer.setAttribute('data-safety',safetyLevel);
    layer.style.left=geometry.left+'%';
    layer.style.top=geometry.top+'%';
    layer.style.width=geometry.width+'%';
    layer.style.height=geometry.height+'%';
    visual.classList.remove('has-highlight');
    void visual.offsetWidth;
    visual.classList.add('has-highlight');
    if(button)button.setAttribute('aria-pressed','true');
    activeHighlight={visual:visual,button:button||null};
    var safetyNotice=safetyLevel==='caution'?'تحذير يحتاج إلى الحذر':(safetyLevel==='safe'?'معلومة عامة غير تحذيرية':'معلومة عامة');
    announceHighlight('تم تظليل '+label+'، '+safetyNotice+'، في صفحة '+digits(pageNumber)+'.');
    if(safetyLevel!=='caution')playSelectionSound();
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
    showHighlight(visual,{left:left,top:top,width:width,height:height},'المعلومة في الموضع المحدد',pageNumber,null,'info');
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

  function wordAtReadingPoint(hit,image,clientX,clientY){
    if(!patientFullAudio||!hit||!hit.segment)return null;
    var segment=hit.segment;
    var text=String(segment[4]||'');
    var lines=text.split(/\r?\n/);
    var lineOffsets=[];
    var runningOffset=0;
    lines.forEach(function(line){lineOffsets.push(runningOffset);runningOffset+=line.length+1;});
    var rect=image.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    var naturalX=(clientX-rect.left)*(hit.data.width/rect.width);
    var naturalY=(clientY-rect.top)*(hit.data.height/rect.height);
    var left=Number(segment[0])||0;
    var top=Number(segment[1])||0;
    var width=Math.max(1,Number(segment[2])||1);
    var height=Math.max(1,Number(segment[3])||1);
    var yFraction=Math.max(0,Math.min(.999,(naturalY-top)/height));
    var lineIndex=lines.length>1?Math.min(lines.length-1,Math.floor(yFraction*lines.length)):0;
    var line=lines[lineIndex]||text;
    var words=tokenizeAudioText(line);
    if(!words.length)return null;
    var arabic=(line.match(/[\u0600-\u06ff]/g)||[]).length;
    var latin=(line.match(/[A-Za-z]/g)||[]).length;
    var rtl=arabic>=latin*.55;
    var context=null;
    try{context=document.createElement('canvas').getContext('2d');}catch(error){}
    var measured=[];
    var totalWidth=0;
    var gapWidth=0;
    if(context){
      var fontSize=Math.max(10,Math.min(72,height/Math.max(1,lines.length)*.74));
      context.font=fontSize+'px Arial, sans-serif';
      context.direction=rtl?'rtl':'ltr';
      context.textAlign=rtl?'right':'left';
      gapWidth=context.measureText(' ').width;
      words.forEach(function(word,index){
        var wordWidth=Math.max(1,context.measureText(word.raw).width);
        measured.push({word:word,width:wordWidth});
        totalWidth+=wordWidth+(index?gapWidth:0);
      });
    }
    var xFraction=Math.max(0,Math.min(1,(naturalX-left)/width));
    var progress=rtl?1-xFraction:xFraction;
    var target;
    if(totalWidth>0){
      target=progress*totalWidth;
      var cursor=0;
      var closest=measured[0].word;
      var closestDistance=Infinity;
      measured.forEach(function(item,index){
        var center=cursor+item.width/2;
        var distance=Math.abs(center-target);
        if(distance<closestDistance){closestDistance=distance;closest=item.word;}
        cursor+=item.width+gapWidth;
      });
      return {raw:closest.raw,start:(lineOffsets[lineIndex]||0)+closest.start,
        end:(lineOffsets[lineIndex]||0)+closest.end,lineIndex:lineIndex};
    }
    target=progress*line.length;
    var best=words[0];
    var bestDistance=Infinity;
    words.forEach(function(word){
      var center=(word.start+word.end)/2;
      var distance=Math.abs(center-target);
      if(distance<bestDistance){bestDistance=distance;best=word;}
    });
    return {raw:best.raw,start:(lineOffsets[lineIndex]||0)+best.start,
      end:(lineOffsets[lineIndex]||0)+best.end,lineIndex:lineIndex};
  }

  function selectReadingAtPoint(visual,image,clientX,clientY,pageNumber){
    var hit=nearestReadingSegment(image,clientX,clientY);
    if(!hit){selectAtPoint(visual,image,clientX,clientY,pageNumber);return;}
    var text=hit.segment[4];
    var safety=safetyForText(text);
    var selectedWord=wordAtReadingPoint(hit,image,clientX,clientY);
    showHighlight(visual,readingHighlightGeometry(hit.data,hit.segment),
      selectedWord?'الكلمة المحددة: '+selectedWord.raw:'السطر المحدد',pageNumber,null,safety);
    readText(text,safety,pageNumber,false,selectedWord);
  }

  function speechLanguage(text){
    var arabic=(String(text).match(/[\u0600-\u06ff]/g)||[]).length;
    var latin=(String(text).match(/[A-Za-z]/g)||[]).length;
    return arabic&&arabic>=latin*.55?'ar-EG':'en-US';
  }

  var cautionTextPattern=/(?:تحذير|احذر|حذر|محاذير|موانع|ممنوع|ممنوعة|تمنع[^.!?؟]{0,45}(?:الفئات|الرضيع|الأطفال|الحمل|الرضاعة|الاستخدام|الاستعمال|الوجه|الأنف|التناول)|لا\s+يمنع|يمنع\s+(?:قطف|غلي|تناول|استخدام|استعمال|قرب|الخلط|الجمع|البلع)|منع\s+(?:الاستعمال|التناول|الخلط)|تجنب|خطر|خطير|ضرر|مخاطر|خطورة|سمية|سام|تسمم|(?:الأعراض|أعراض)\s+(?:ال)?جانبية|(?:الآثار|آثار)\s+(?:ال)?جانبية|(?:الأثر|أثر)\s+(?:ال)?جانبي|تفاعلات|تداخلات|يتعارض|نزيف|سيولة|حصوات|حساسي|حمل|حامل|رضاع|رضيع|رضع|الأطفال|أطفال|طفل|الجرعة\s+السامة|جرعة\s+زائدة|قبل\s+العمليات|الجراحة|ارتجاع|توقف\s+عن|لا\s+تجمع|لا\s+تخلط|لا\s+(?:تستخدم|تستعمل|يستخدم|يستعمل|تتناول|يتناول|تأخذ|يأخذ)|لا\s+ينصح|غير\s+موصى|استشر\s+(?:طبيب|صيدلي)|اسأل\s+(?:الطبيب|الصيدلي)|مياه\s+زرقاء|ضغط\s+العين|ضغط\s+عين|الجلوكوما|أمراض|مرض|مزمن|سكري|قلب|كبد|كلى|كلية|بروستاتا|صرع|قرحة|ضغط\s+الدم|prostat|diabetes|cardiac|renal|hepatic|liver|kidney|ulcer|chronic|disease|cardiovascular|asthma|anticoagulant|warfarin|aspirin|clopidogrel|dabigatran|nsaids|post[-\s]?op|do\s+not\s+(?:use|take|apply|ingest|combine|mix)|contraindicat|warning|caution|avoid|unsafe|risk|toxic|bleed|hemorrhag|interaction|adverse|side\s+effect|allerg|pregnan|lactat|infant|child|danger|poison|overdose|fatal|surger|glaucoma|reflux|seizure|critical|high[-\s]risk|narrow\s+therapeutic\s+index)/i;

  function safetyForText(value){
    return cautionTextPattern.test(String(value||''))?'caution':'safe';
  }

  function prepareSpeechText(value){
    return String(value||'')
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\uFE0E\uFE0F\u200D]/g,' ')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,' ')
      .replace(/[•▪◦✦✧]/g,' ')
      .replace(/[→⇒]/g,', ')
      .replace(/×/g,' cross ')
      .replace(/[\u00a0\t\r\n]+/g,' ')
      .replace(/\s+/g,' ')
      .replace(/([!?؟؛،])\1+/g,'$1')
      .trim();
  }

  function splitSpeechText(value){
    var remaining=prepareSpeechText(value);
    var chunks=[];
    var maxLength=185;
    while(remaining.length>maxLength){
      var cut=remaining.lastIndexOf(' ',maxLength);
      var punctuation=remaining.slice(65,maxLength).search(/[.!?؟؛،;:](?:\s|$)/);
      if(punctuation>=0)cut=65+punctuation+1;
      if(cut<55)cut=maxLength;
      chunks.push(remaining.slice(0,cut).trim());
      remaining=remaining.slice(cut).trim();
    }
    if(remaining)chunks.push(remaining);
    return chunks;
  }

  function normalizeVoiceLanguage(voice){
    return String(voice&&voice.lang||'').toLowerCase().replace(/_/g,'-');
  }

  function speechVoiceKey(voice){
    return [String(voice&&voice.voiceURI||''),normalizeVoiceLanguage(voice),String(voice&&voice.name||'')].join('|');
  }

  function readBrowserVoices(){
    if(!speechSynthesis||typeof speechSynthesis.getVoices!=='function')return [];
    try{return(speechSynthesis.getVoices()||[]).filter(function(voice){return /^(ar|en)(?:-|$)/i.test(normalizeVoiceLanguage(voice));});}
    catch(error){return[];}
  }

  function voiceQualityScore(voice,locale){
    var lang=normalizeVoiceLanguage(voice);
    var prefix=locale.slice(0,2).toLowerCase();
    var name=(String(voice.name||'')+' '+String(voice.voiceURI||'')).toLowerCase();
    var score=lang===locale.toLowerCase()?1000:(lang.indexOf(prefix)===0?500:0);
    if(/natural|neural|online|premium|enhanced|wavenet|studio|expressive|high[-\s]quality/.test(name))score+=30;
    if(/compact|legacy|espeak|robotic/.test(name))score-=20;
    if(voice.localService===false)score+=5;
    if(voice.default)score+=1;
    return score;
  }

  function orderedVoicesFor(locale){
    var prefix=locale.slice(0,2).toLowerCase();
    return readBrowserVoices().filter(function(voice){return normalizeVoiceLanguage(voice).indexOf(prefix)===0;})
      .sort(function(a,b){return voiceQualityScore(b,locale)-voiceQualityScore(a,locale);});
  }

  function populateVoiceSelect(select,language,locale,autoLabel){
    if(!select)return;
    var selected=speechVoicePreferences[language]||'auto';
    var voices=orderedVoicesFor(locale);
    select.textContent='';
    var automatic=document.createElement('option');
    automatic.value='auto';
    automatic.textContent=autoLabel;
    select.appendChild(automatic);
    voices.forEach(function(voice){
      var option=document.createElement('option');
      option.value=speechVoiceKey(voice);
      option.textContent=(voice.name||voice.lang||'صوت')+' — '+(voice.lang||'');
      select.appendChild(option);
    });
    var hasSavedVoice=selected==='auto'||voices.some(function(voice){return speechVoiceKey(voice)===selected;});
    if(!hasSavedVoice&&voices.length){
      selected='auto';
      speechVoicePreferences[language]='auto';
      storeSpeechPreference('phyto-booklet-voice-'+language,'auto');
    }
    select.value=hasSavedVoice?selected:'auto';
    select.disabled=!voices.length;
  }

  function refreshSpeechVoiceControls(){
    availableSpeechVoices=readBrowserVoices();
    populateVoiceSelect(arabicVoiceSelect,'ar','ar-EG','أفضل صوت عربي تلقائيًا');
    populateVoiceSelect(englishVoiceSelect,'en','en-US','أفضل صوت إنجليزي تلقائيًا');
    if(speechSettingsNote){
      var note=availableSpeechVoices.length
        ?'يختار الوضع التلقائي الصوت الأقرب للغة ويفضّل Natural أو Neural إن وُجد. جودة الصوت تعتمد على الجهاز والمتصفح.'
        :'لا يوفّر المتصفح قائمة أصوات إضافية؛ ستُستخدم قراءته الافتراضية.';
      if(availableSpeechVoices.length&&!orderedVoicesFor('ar-EG').length)note+=' لا يظهر صوت عربي في القائمة؛ سيحاول المتصفح استخدام صوته الافتراضي.';
      if(availableSpeechVoices.length&&!orderedVoicesFor('en-US').length)note+=' لا يظهر صوت إنجليزي في القائمة؛ سيحاول المتصفح استخدام صوته الافتراضي.';
      speechSettingsNote.textContent=note;
    }
  }

  function preferredSpeechVoice(locale){
    availableSpeechVoices=readBrowserVoices();
    var language=locale.slice(0,2).toLowerCase();
    var key=speechVoicePreferences[language]||'auto';
    if(key!=='auto'){
      var selected=availableSpeechVoices.filter(function(voice){return speechVoiceKey(voice)===key;})[0];
      if(selected)return selected;
    }
    return orderedVoicesFor(locale)[0]||null;
  }

  function storeSpeechPreference(key,value){
    try{window.localStorage.setItem(key,value);}catch(error){}
  }

  function initializeSpeechSettings(){
    if(speechRateInput){
      speechRateInput.value=String(Math.round(speechRate*100));
      if(speechRateValue)speechRateValue.textContent=speechRate.toFixed(2)+'×';
      speechRateInput.addEventListener('input',function(){
        var value=Number(speechRateInput.value)/100;
        if(value<.75||value>1.1)return;
        speechRate=value;
        if(speechRateValue)speechRateValue.textContent=speechRate.toFixed(2)+'×';
        storeSpeechPreference('phyto-booklet-speech-rate',String(speechRate));
      });
    }
    if(arabicVoiceSelect)arabicVoiceSelect.addEventListener('change',function(){
      speechVoicePreferences.ar=arabicVoiceSelect.value||'auto';
      storeSpeechPreference('phyto-booklet-voice-ar',speechVoicePreferences.ar);
    });
    if(englishVoiceSelect)englishVoiceSelect.addEventListener('change',function(){
      speechVoicePreferences.en=englishVoiceSelect.value||'auto';
      storeSpeechPreference('phyto-booklet-voice-en',speechVoicePreferences.en);
    });
    refreshSpeechVoiceControls();
    if(speechSynthesis&&typeof speechSynthesis.addEventListener==='function'){
      speechSynthesis.addEventListener('voiceschanged',refreshSpeechVoiceControls);
    }else if(speechSynthesis){
      var previousVoicesChanged=speechSynthesis.onvoiceschanged;
      speechSynthesis.onvoiceschanged=function(event){
        if(typeof previousVoicesChanged==='function')previousVoicesChanged.call(speechSynthesis,event);
        refreshSpeechVoiceControls();
      };
    }
    window.setTimeout(refreshSpeechVoiceControls,250);
  }

  function updatePageReadButton(){
    if(!pageReadButton)return;
    var patientAudioSupported=!!patientFullAudio;
    var speechSupported=!!(speechSynthesis&&SpeechUtterance&&typeof speechSynthesis.speak==='function');
    var supported=patientAudioSupported||speechSupported;
    pageReadButton.disabled=!supported;
    pageReadButton.setAttribute('aria-pressed',String(speechActive&&supported));
    var idleLabel=patientAudioSupported?'استمع إلى التسجيل المرتبط بالصفحة الحالية':'استمع إلى نص الصفحة الحالية';
    var activeLabel=patientAudioSupported?'إيقاف المقطع الصوتي':'إيقاف القراءة الصوتية';
    pageReadButton.setAttribute('aria-label',supported
      ?(speechActive?activeLabel:idleLabel)
      :'القراءة الصوتية غير متاحة في هذا المتصفح');
    pageReadButton.title=supported
      ?(speechActive?activeLabel:idleLabel)
      :'القراءة الصوتية غير متاحة في هذا المتصفح';
    if(pageReadLabel)pageReadLabel.textContent=supported
      ?(speechActive?(patientAudioSupported?'إيقاف الاستماع':'إيقاف القراءة'):(patientAudioSupported?'استمع إلى تسجيل الصفحة':'استمع إلى الصفحة'))
      :'القراءة غير متاحة';
  }

  function stopSpeech(){
    speechRequest++;
    speechSession++;
    cancelWarningSound();
    if(patientAudioPendingCueHandler&&patientFullAudio){
      patientFullAudio.removeEventListener('loadedmetadata',patientAudioPendingCueHandler);
      patientAudioPendingCueHandler=null;
    }
    if(patientAudioPendingSeekHandler&&patientFullAudio){
      patientFullAudio.removeEventListener('seeked',patientAudioPendingSeekHandler);
      patientAudioPendingSeekHandler=null;
    }
    if(patientAudioSeekTimer){window.clearTimeout(patientAudioSeekTimer);patientAudioSeekTimer=null;}
    if(patientAudioIsExcerpt&&patientFullAudio){
      patientAudioIsExcerpt=false;
      patientAudioExcerptStart=null;
      patientAudioExcerptEnd=null;
      patientAudioExcerptPage=0;
      patientAudioExcerptLabel='';
      patientAudioExcerptFinished=false;
      try{patientFullAudio.pause();}catch(error){}
    }
    if(speechSynthesis&&typeof speechSynthesis.cancel==='function'){
      try{speechSynthesis.cancel();}catch(error){}
    }
    speechActive=false;
    updatePageReadButton();
  }

  function pausePatientAudioForSpeech(){
    if(!patientFullAudio||patientFullAudio.paused)return;
    patientFullAudio.pause();
    if(patientAudioStatus)patientAudioStatus.textContent='توقف التسجيل الكامل مؤقتًا لقراءة المقطع المحدد.';
  }

  function patientAudioCueForPage(pageNumber,safety,text,wholePage){
    var page=Number(pageNumber)||1;
    var section=patientAudioSections;
    var cue;
    if(wholePage){
      var ranges={
        1:{start:0,end:section[0].end,title:'البداية والزنجبيل'},
        2:{start:0,end:section[0].end,title:'مقدمة الكتيّب وفهم دوار الحركة'},
        3:{start:65,end:section[1].end,title:'الزنجبيل وتحذيراته'},
        4:{start:section[2].start,end:section[3].end,title:'النعناع الفلفلي ومحاذيره'},
        5:{start:section[4].start,end:section[5].end,title:'السيكران الأسود وموانع استخدامه'},
        6:{start:section[6].start,end:section[7].end,title:'مقارنة المستحضرات ودليل الاستخدام'},
        7:{start:section[8].start,end:845.8,title:'قائمة فحص الأمان والأسئلة الشائعة'},
        8:{start:845.8,end:section[9].end,title:'القاعدة الذهبية وخاتمة الكتيّب'}
      };
      return ranges[page]||ranges[1];
    }
    var value=String(text||'');
    var practical=/(?:دليل الاستخدام|خطوة|توقيت|نصف ساعة|نص ساعة|الرحلة|مستنشق|إرشاد|طريقة الاستخدام|مقعد|تهوية|هاتف)/i.test(value);
    var question=/(?:سؤال|أسئلة|شائع|ليه|لماذا|إمتى|متى|القاعدة الذهبية|استفسار)/i.test(value);
    if(page<=2)return section[0];
    if(page===3){
      cue=safety==='caution'?section[1]:{sectionIndex:0,start:65,end:section[0].end,title:'الزنجبيل واستخدامه'};
      return cue;
    }
    if(page===4)return safety==='caution'?section[3]:section[2];
    if(page===5)return safety==='caution'?section[5]:section[4];
    if(page===6)return practical?section[7]:section[6];
    if(page===7)return question?section[9]:section[8];
    if(page>=8)return {sectionIndex:9,start:845.8,end:section[9].end,title:'القاعدة الذهبية وخاتمة الكتيّب'};
    return section[0];
  }

  function normalizeAudioToken(value){
    var token=String(value||'').toLowerCase();
    try{if(token.normalize)token=token.normalize('NFKC');}catch(error){}
    return token.replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g,'').replace(/\u0640/g,'')
      .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/ؤ/g,'و').replace(/ئ/g,'ي');
  }

  function tokenizeAudioText(value){
    var source=String(value||'');
    var pattern=/[\u0621-\u063a\u0640\u0641-\u064a\u066e-\u06d3\u06fa-\u06fc\u0750-\u077f\u08a0-\u08ffA-Za-z0-9]+/g;
    var tokens=[];
    var match;
    while((match=pattern.exec(source))){
      var normalized=normalizeAudioToken(match[0]);
      if(normalized)tokens.push({raw:match[0],text:normalized,start:match.index,end:pattern.lastIndex});
    }
    return tokens;
  }

  var audioStopWords={
    'من':1,'في':1,'على':1,'الى':1,'عن':1,'مع':1,'ما':1,'مش':1,'هو':1,'هي':1,'هم':1,'هن':1,
    'هذا':1,'هذه':1,'ذلك':1,'الذي':1,'التي':1,'ولا':1,'لكن':1,'وقد':1,'كان':1,'او':1,'ان':1,
    'لو':1,'كل':1,'اي':1,'ثم':1,'بعد':1,'قبل':1,'بين':1,'كما':1,'لما':1,'ده':1,'دي':1,'دا':1
  };

  function audioTokenForms(value){
    var initial=normalizeAudioToken(value);
    var forms=[];
    var pending=[initial];
    var seen=Object.create(null);
    var prefixes=['وال','بال','كال','فال','لل'];
    while(pending.length&&forms.length<12){
      var token=pending.shift();
      if(!token||seen[token])continue;
      seen[token]=true;
      forms.push(token);
      if(!/[\u0600-\u06ff]/.test(token))continue;
      prefixes.forEach(function(prefix){
        if(token.indexOf(prefix)===0&&token.length-prefix.length>=3)pending.push(token.slice(prefix.length));
      });
      if(token.indexOf('ال')===0&&token.length>5)pending.push(token.slice(2));
      if(/^[وفبكل]/.test(token)&&token.length>4)pending.push(token.slice(1));
    }
    return forms;
  }

  function audioWordsMatch(first,second){
    if(!first||!second)return false;
    var firstForms=audioTokenForms(first);
    var secondForms=audioTokenForms(second);
    for(var a=0;a<firstForms.length;a++){
      for(var b=0;b<secondForms.length;b++){
        var left=firstForms[a],right=secondForms[b];
        if(left===right)return true;
        var shorter=left.length<=right.length?left:right;
        var longer=left.length>right.length?left:right;
        if(shorter.length>=4&&longer.indexOf(shorter)===0)return true;
      }
    }
    return false;
  }

  function isUsefulAudioToken(token){
    return !!token&&token.length>=3&&!Object.prototype.hasOwnProperty.call(audioStopWords,token);
  }

  function punctuationPauseUnits(value){
    var text=String(value||'');
    return (text.match(/[.!?؟؛]/g)||[]).length*2.1
      +(text.match(/[,،:;]/g)||[]).length*1.05
      +(text.match(/\n/g)||[]).length*2.4;
  }

  // Section boundaries are timed; per-word positions below are proportional estimates, not recorded word timestamps.
  function timedAudioTokens(segment){
    var text=String(segment&&segment.text||'');
    var tokens=tokenizeAudioText(text);
    var totalUnits=0;
    var cursor=0;
    tokens.forEach(function(token){
      totalUnits+=punctuationPauseUnits(text.slice(cursor,token.start));
      token.unitStart=totalUnits;
      totalUnits+=Math.max(2.1,token.raw.length*.86+.4);
      token.unitEnd=totalUnits;
      cursor=token.end;
    });
    totalUnits+=punctuationPauseUnits(text.slice(cursor));
    if(!totalUnits)totalUnits=1;
    var start=Number(segment.startSeconds)||0;
    var end=Number(segment.endSeconds)||start;
    var duration=Math.max(0,end-start);
    tokens.forEach(function(token){
      token.audioStart=start+duration*(token.unitStart/totalUnits);
      token.audioEnd=start+duration*(token.unitEnd/totalUnits);
    });
    return tokens;
  }

  function patientAudioTokensForCue(entry,cue){
    var source=entry&&entry.tokens?entry.tokens:timedAudioTokens(entry&&entry.segment?entry.segment:entry);
    var cueStart=Number(cue&&cue.start)||0;
    var cueEnd=Number(cue&&cue.end)||Infinity;
    return source.filter(function(token){
      return token.audioEnd>=cueStart-.25&&token.audioStart<=cueEnd+.25;
    });
  }

  function patientAudioTimedSegmentForCue(cue){
    if(!cue||!patientAudioTimedSegments.length)return null;
    var requestedIndex=typeof cue.sectionIndex==='number'?cue.sectionIndex:
      (typeof cue.index==='number'?cue.index:null);
    if(requestedIndex!==null){
      for(var i=0;i<patientAudioTimedSegments.length;i++){
        if(patientAudioTimedSegments[i].index===requestedIndex)return patientAudioTimedSegments[i];
      }
    }
    var cueStart=Number(cue.start)||0;
    var cueEnd=Number(cue.end)||Infinity;
    var middle=cueStart+(cueEnd-cueStart)/2;
    var best=null;
    var distance=Infinity;
    patientAudioTimedSegments.forEach(function(entry){
      var start=Number(entry.segment.startSeconds)||0;
      var end=Number(entry.segment.endSeconds)||start;
      if(end<cueStart||start>cueEnd)return;
      var candidateDistance=Math.abs((start+end)/2-middle);
      if(candidateDistance<distance){distance=candidateDistance;best=entry;}
    });
    return best;
  }

  function contextWordsForAudio(value,ignoreWord){
    var ignored=normalizeAudioToken(ignoreWord);
    var seen=Object.create(null);
    return tokenizeAudioText(value).map(function(token){return token.text;}).filter(function(token){
      if(!isUsefulAudioToken(token)||audioWordsMatch(token,ignored)||seen[token])return false;
      seen[token]=true;
      return true;
    });
  }

  function scoreAudioOccurrence(tokens,index,contextWords,target,expectedIndex,phraseMatch){
    var token=tokens[index];
    var requested=normalizeAudioToken(target);
    var score=token&&audioWordsMatch(token.text,requested)?
      (token.text===requested?3.2:2.4):0;
    if(phraseMatch&&index>=phraseMatch.first-2&&index<=phraseMatch.last+2)score+=2.2;
    if(typeof expectedIndex==='number'&&isFinite(expectedIndex))score-=Math.abs(index-expectedIndex)*.32;
    contextWords.forEach(function(query){
      if(token&&audioWordsMatch(query,token.text))return;
      var nearest=Infinity;
      for(var offset=-12;offset<=12;offset++){
        if(!offset)continue;
        var candidate=tokens[index+offset];
        if(candidate&&audioWordsMatch(query,candidate.text))nearest=Math.min(nearest,Math.abs(offset));
      }
      if(nearest<Infinity)score+=(1+Math.min(1.5,query.length*.12))/(1+nearest*.22);
    });
    return score;
  }

  function patientAudioWordCue(entry,cue,requestedWord,contextText,phraseMatch,selectedWord){
    if(!entry)return null;
    var tokens=patientAudioTokensForCue(entry,cue);
    var requested=normalizeAudioToken(requestedWord);
    if(!requested||!tokens.length)return null;
    var queryTokens=tokenizeAudioText(contextText);
    var selectedStart=selectedWord&&typeof selectedWord.start==='number'?selectedWord.start:-1;
    var targetQueryIndex=-1;
    if(selectedStart>=0){
      var queryDistance=Infinity;
      queryTokens.forEach(function(token,index){
        var distance=Math.abs(token.start-selectedStart);
        if(distance<queryDistance){queryDistance=distance;targetQueryIndex=index;}
      });
    }
    var expectedIndex=null;
    if(phraseMatch&&phraseMatch.last>=phraseMatch.first){
      var fraction=selectedStart>=0?selectedStart/Math.max(1,String(contextText||'').length):.5;
      expectedIndex=phraseMatch.first+Math.max(0,Math.min(1,fraction))*(phraseMatch.last-phraseMatch.first);
    }
    var matches=[];
    tokens.forEach(function(token,index){
      if(audioWordsMatch(token.text,requested))matches.push({token:token,index:index});
    });
    if(phraseMatch&&matches.length){
      var nearPhrase=matches.filter(function(item){return item.index>=phraseMatch.first-3&&item.index<=phraseMatch.last+3;});
      if(nearPhrase.length)matches=nearPhrase;
      else matches=[];
    }
    var contextWords=contextWordsForAudio(contextText,requestedWord);
    if(matches.length){
      var best=matches[0];
      var bestScore=-Infinity;
      matches.forEach(function(item){
        var score=scoreAudioOccurrence(tokens,item.index,contextWords,requested,expectedIndex,phraseMatch);
        if(score>bestScore){bestScore=score;best=item;}
      });
      return {token:best.token,index:best.index,exact:normalizeAudioToken(best.token.raw)===requested,inferred:false};
    }
    if(phraseMatch&&phraseMatch.matches&&phraseMatch.matches.length){
      var nearestRecord=phraseMatch.matches[0];
      var nearestDistance=Infinity;
      phraseMatch.matches.forEach(function(record){
        var distance=targetQueryIndex>=0?Math.abs(record.queryIndex-targetQueryIndex):
          Math.abs(record.audioIndex-expectedIndex);
        if(distance<nearestDistance){nearestDistance=distance;nearestRecord=record;}
      });
      var inferredToken=tokens[nearestRecord.audioIndex];
      if(inferredToken)return {token:inferredToken,index:nearestRecord.audioIndex,exact:false,inferred:true};
    }
    return null;
  }

  function patientAudioPhraseCue(entry,cue,text,selectedWord){
    if(!entry)return null;
    var tokens=patientAudioTokensForCue(entry,cue);
    var query=tokenizeAudioText(text).filter(function(token){return isUsefulAudioToken(token.text);});
    if(!tokens.length)return null;
    var best=null;
    if(query.length){
      var windowSize=Math.max(4,Math.min(48,query.length+8));
      var uniqueQuery=query.filter(function(token,index){
        for(var earlier=0;earlier<index;earlier++){
          if(audioWordsMatch(query[earlier].text,token.text))return false;
        }
        return true;
      });
      var totalWeight=uniqueQuery.reduce(function(total,token){return total+1+Math.min(1.5,token.text.length*.12);},0)||1;
      for(var startIndex=0;startIndex<tokens.length;startIndex++){
        var stop=Math.min(tokens.length,startIndex+windowSize);
        var used={};
        var records=[];
        var matchedWeight=0;
        uniqueQuery.forEach(function(queryToken,queryIndex){
          var fraction=uniqueQuery.length>1?queryIndex/(uniqueQuery.length-1):.5;
          var expected=startIndex+fraction*Math.max(0,stop-startIndex-1);
          var candidate=-1;
          var candidateDistance=Infinity;
          for(var audioIndex=startIndex;audioIndex<stop;audioIndex++){
            if(used[audioIndex]||!audioWordsMatch(queryToken.text,tokens[audioIndex].text))continue;
            var distance=Math.abs(audioIndex-expected);
            if(distance<candidateDistance){candidateDistance=distance;candidate=audioIndex;}
          }
          if(candidate>=0){
            used[candidate]=true;
            records.push({queryIndex:queryToken.start,audioIndex:candidate,query:queryToken.text});
            matchedWeight+=1+Math.min(1.5,queryToken.text.length*.12);
          }
        });
        var minimumMatches=uniqueQuery.length===1?1:Math.max(2,Math.ceil(uniqueQuery.length*.23));
        if(records.length<minimumMatches)continue;
        var positions=records.map(function(record){return record.audioIndex;});
        var first=Math.min.apply(Math,positions);
        var last=Math.max.apply(Math,positions);
        var inOrder=0;
        var orderedRecords=records.slice().sort(function(a,b){return a.queryIndex-b.queryIndex;});
        for(var orderIndex=1;orderIndex<orderedRecords.length;orderIndex++){
          if(orderedRecords[orderIndex].audioIndex>=orderedRecords[orderIndex-1].audioIndex)inOrder++;
        }
        var orderRatio=orderedRecords.length>1?inOrder/(orderedRecords.length-1):1;
        var coverage=matchedWeight/totalWeight;
        var gapRatio=Math.max(0,(last-first+1-records.length)/Math.max(1,last-first+1));
        var score=coverage+(records.length/uniqueQuery.length)*.18+orderRatio*.12-gapRatio*.08;
        if(!best||score>best.score||
          (score===best.score&&last-first<best.last-best.first)){
          best={score:score,first:first,last:last,matches:records,coverage:coverage,
            matchedCount:records.length,queryCount:uniqueQuery.length};
        }
      }
      if(best&&uniqueQuery.length>1&&best.coverage<.2)best=null;
    }
    var wordCue=selectedWord?patientAudioWordCue(entry,cue,selectedWord.raw,text,best,selectedWord):null;
    if(!best&&!wordCue)return null;
    var startToken=wordCue?wordCue.token:(tokens[best.first]);
    var endToken=best?tokens[best.last]:startToken;
    if(!startToken||!endToken)return null;
    var cueStart=Number(cue.start)||0;
    var cueEnd=Number(cue.end)||Number(entry.segment.endSeconds)||startToken.audioEnd;
    var start=Math.max(cueStart,startToken.audioStart-.16);
    var end=Math.min(cueEnd,endToken.audioEnd+.22);
    if(wordCue){
      var minimumContextAfterWord=best&&best.matchedCount>2?.45:(best?1.2:2.6);
      end=Math.min(cueEnd,Math.max(end,startToken.audioEnd+minimumContextAfterWord));
    }
    if(end-start<.8)end=Math.min(cueEnd,start+.8);
    if(end<=start)return null;
    return {start:start,end:end,matched:true,word:wordCue?wordCue.token.raw:null,
      wordExact:wordCue?wordCue.exact:false,wordInferred:wordCue?wordCue.inferred:false,
      phrase:!!best,matchedWords:best?best.matchedCount:1};
  }

  function playPatientAudioExcerpt(pageNumber,safety,text,wholePage,request,cue,excerptLabel){
    if(!patientFullAudio)return false;
    cue=cue||patientAudioCueForPage(pageNumber,safety,text,wholePage);
    if(!cue)return false;
    var start=Math.max(0,Number(cue.start)||0);
    var cueEnd=Math.min(Number(patientFullAudio.duration)||Number(cue.end)||921.96,Number(cue.end)||921.96);
    if(cueEnd<=start)return false;
    var end=cueEnd;
    patientAudioIsExcerpt=true;
    patientAudioExcerptFinished=false;
    patientAudioExcerptStart=start;
    patientAudioExcerptEnd=end;
    patientAudioExcerptPage=Number(pageNumber)||1;
    patientAudioExcerptLabel=excerptLabel||'مقطع مرتبط بصفحة '+digits(patientAudioExcerptPage)+' بتوقيت تقريبي.';
    if(patientAudioStatus)patientAudioStatus.textContent='جارٍ الانتقال إلى '+patientAudioExcerptLabel+' في التسجيل المتصل بصوت رجالي باللهجة المصرية.';
    updatePageReadButton();

    function finishSeek(success){
      if(patientAudioSeekTimer){window.clearTimeout(patientAudioSeekTimer);patientAudioSeekTimer=null;}
      if(patientAudioPendingSeekHandler&&patientFullAudio){
        patientFullAudio.removeEventListener('seeked',patientAudioPendingSeekHandler);
        patientAudioPendingSeekHandler=null;
      }
      if(request!==speechRequest||!patientAudioIsExcerpt)return;
      if(success){playPatientAudio();return;}
      patientAudioIsExcerpt=false;
      patientAudioExcerptStart=null;
      patientAudioExcerptEnd=null;
      patientAudioExcerptPage=0;
      patientAudioExcerptLabel='';
      speechActive=false;
      updatePageReadButton();
      if(patientAudioStatus)patientAudioStatus.textContent='تعذّر الوصول إلى موضع المقطع. لم أبدأ التسجيل من أوله؛ يمكنك تشغيله يدويًا من مشغّل الصوت أدناه.';
      updatePatientAudioButton();
    }
    function seekAndPlay(){
      patientAudioPendingCueHandler=null;
      if(request!==speechRequest||!patientAudioIsExcerpt)return;
      if(start<.05||Math.abs(patientFullAudio.currentTime-start)<.75){finishSeek(true);return;}
      patientAudioPendingSeekHandler=function(){
        if(Math.abs(patientFullAudio.currentTime-start)<1)finishSeek(true);
      };
      patientFullAudio.addEventListener('seeked',patientAudioPendingSeekHandler);
      patientAudioSeekTimer=window.setTimeout(function(){finishSeek(false);},4000);
      try{patientFullAudio.currentTime=Math.min(start,Math.max(0,(Number(patientFullAudio.duration)||start)-.05));}
      catch(error){finishSeek(false);return;}
      if(Math.abs(patientFullAudio.currentTime-start)<.75)finishSeek(true);
    }
    if(patientFullAudio.readyState>=1){
      seekAndPlay();
    }else{
      patientAudioPendingCueHandler=seekAndPlay;
      patientFullAudio.addEventListener('loadedmetadata',patientAudioPendingCueHandler,{once:true});
      try{patientFullAudio.load();}catch(error){seekAndPlay();}
    }
    return true;
  }

  function readPatientAudio(value,safety,pageNumber,wholePage,selectedWord){
    if(!patientFullAudio)return false;
    if(!patientFullAudio.paused&&!patientAudioIsExcerpt)patientFullAudio.pause();
    stopSpeech();
    speechActive=true;
    updatePageReadButton();
    var request=speechRequest;

    function fail(message){
      if(request!==speechRequest)return;
      speechActive=false;
      updatePageReadButton();
      if(patientAudioStatus)patientAudioStatus.textContent=message;
    }
    function startExcerpt(cue,label){
      if(request!==speechRequest)return;
      if(!playPatientAudioExcerpt(pageNumber,safety,value,wholePage,request,cue,label)){
        fail('تعذّر تحديد موضع الاستماع. استخدم مشغّل التسجيل الكامل أدناه.');
      }
    }
    function prepareAndPlay(){
      if(request!==speechRequest)return;
      var cue=patientAudioCueForPage(pageNumber,safety,value,wholePage);
      if(!cue){fail('تعذّر تحديد موضع الاستماع. استخدم مشغّل التسجيل الكامل أدناه.');return;}
      var label='مقطع الصفحة ضمن نطاق الفصل؛ لا تتوفر مزامنة دقيقة كلمة بكلمة.';
      if(!wholePage){
        if(!patientAudioTimedSegments.length){
          fail('تعذّر تحميل نص التسجيل لمزامنة هذا السطر. لم أبدأ التسجيل من أوله؛ استخدم مشغّل التسجيل الكامل أدناه.');
          return;
        }
        var entry=patientAudioTimedSegmentForCue(cue);
        var refined=entry?patientAudioPhraseCue(entry,cue,value,selectedWord):null;
        if(!refined){
          fail('لم أجد تطابقًا موثوقًا لهذا النص في التسجيل، لذلك لم أشغّل موضعًا قد يكون خاطئًا. استخدم زر الصفحة أو مشغّل التسجيل الكامل.');
          return;
        }
        cue=refined;
        label=selectedWord&&refined.word&&!refined.wordInferred
          ?'موضع تقريبي قرب «'+selectedWord.raw+'»؛ التسجيل لا يتضمن توقيتات كلمة بكلمة.'
          :'مقطع قريب من السطر المحدد؛ التوقيت تقديري لعدم توفر مزامنة كلمة بكلمة.';
      }
      function play(){startExcerpt(cue,label);}
      if(safety==='caution'&&soundEnabled&&PageAudio){
        playWarningSound(request).then(function(){if(request===speechRequest)play();});
      }else play();
    }

    if(wholePage)prepareAndPlay();
    else patientAudioScriptReady.then(prepareAndPlay);
    return true;
  }

  function playPatientAudio(){
    if(!patientFullAudio)return;
    var playback;
    try{playback=patientFullAudio.play();}
    catch(error){
      if(patientAudioIsExcerpt){patientAudioIsExcerpt=false;patientAudioExcerptEnd=null;patientAudioExcerptStart=null;speechActive=false;updatePageReadButton();}
      if(patientAudioStatus)patientAudioStatus.textContent='تعذّر تشغيل التسجيل. جرّب مشغّل الصوت مرة أخرى.';
      return;
    }
    if(playback&&typeof playback.catch==='function')playback.catch(function(){
      if(patientAudioIsExcerpt){patientAudioIsExcerpt=false;patientAudioExcerptEnd=null;patientAudioExcerptStart=null;speechActive=false;updatePageReadButton();}
      if(patientAudioStatus)patientAudioStatus.textContent='تعذّر تشغيل التسجيل. جرّب زر التشغيل في مشغّل الصوت.';
      updatePatientAudioButton();
    });
  }

  function updatePatientAudioButton(){
    if(!patientFullAudio||!patientAudioButton)return;
    var playing=!patientFullAudio.paused&&!patientFullAudio.ended;
    patientAudioButton.setAttribute('aria-pressed',String(playing));
    if(patientAudioButtonLabel)patientAudioButtonLabel.textContent=playing
      ?'إيقاف الاستماع مؤقتًا'
      :(patientFullAudio.ended?'أعد الاستماع إلى الكتيّب كاملًا':'ابدأ الاستماع إلى الكتيّب كاملًا');
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
      var requestedLanguage=speechLanguage(utterance.text);
      var voice=preferredSpeechVoice(requestedLanguage);
      utterance.lang=voice&&voice.lang?voice.lang:requestedLanguage;
      utterance.rate=speechRate;
      utterance.pitch=1;
      utterance.volume=1;
      if(voice)utterance.voice=voice;
      utterance.onend=speakNext;
      utterance.onerror=function(event){
        if(session!==speechSession)return;
        speechActive=false;
        updatePageReadButton();
        if(event&&event.error&&event.error!=='canceled'&&event.error!=='interrupted'){
          announceHighlight('تعذرت القراءة الصوتية. جرّب صوتًا آخر من إعدادات القراءة.');
        }
      };
      try{speechSynthesis.speak(utterance);}
      catch(error){speechActive=false;updatePageReadButton();}
    }

    speakNext();
    return true;
  }

  function speakWarningBeforeText(value,request){
    var locale=speechLanguage(value);
    var warning;
    try{
      warning=new SpeechUtterance(locale==='ar-EG'
        ?'تنبيه. النص التالي يحتوي على محاذير تتعلق بالسلامة.'
        :'Warning. The next passage contains safety cautions.');
    }catch(error){
      if(request===speechRequest)speakText(value);
      return Promise.resolve(false);
    }
    var voice=preferredSpeechVoice(locale);
    warning.lang=voice&&voice.lang?voice.lang:locale;
    warning.rate=Math.min(speechRate,.9);
    warning.pitch=1;
    warning.volume=1;
    if(voice)warning.voice=voice;
    return new Promise(function(resolve){
      var finished=false;
      var timer=window.setTimeout(finish,5000);
      function finish(){
        if(finished)return;
        finished=true;
        window.clearTimeout(timer);
        if(request!==speechRequest){resolve(false);return;}
        speakText(value);
        resolve(true);
      }
      warning.onend=finish;
      warning.onerror=finish;
      try{speechSynthesis.speak(warning);}
      catch(error){finish();}
    });
  }

  function readText(value,safety,pageNumber,wholePage,selectedWord){
    if(patientFullAudio)return readPatientAudio(value,safety,pageNumber,wholePage,selectedWord);
    pausePatientAudioForSpeech();
    if(!speechSynthesis||!SpeechUtterance||typeof speechSynthesis.speak!=='function'||!splitSpeechText(value).length)return false;
    if(safety!=='caution')return speakText(value);
    if(!soundEnabled&&PageAudio)return speakText(value);
    stopSpeech();
    speechActive=true;
    updatePageReadButton();
    var request=speechRequest;
    if(!PageAudio){
      speakWarningBeforeText(value,request);
      return true;
    }
    playWarningSound(request).then(function(played){
      if(request!==speechRequest)return;
      if(!played&&soundEnabled){speakWarningBeforeText(value,request);return;}
      speakText(value);
    });
    return true;
  }

  function makeTableHotspot(visual,pageIndex,table,entry,isHeader){
    var top=isHeader?table.header.top:entry.top;
    var bottom=isHeader?table.header.bottom:entry.bottom;
    var label=isHeader?table.header.label:entry.label;
    var speechText=isHeader?table.header.speech:entry.speech;
    var safety=safetyForText(speechText);
    var button=document.createElement('button');
    button.type='button';
    button.className='table-row-hotspot';
    button.style.left=table.left+'%';
    button.style.top=top+'%';
    button.style.width=table.width+'%';
    button.style.height=(bottom-top)+'%';
    button.setAttribute('data-safety',safety);
    button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-label',(patientFullAudio?'تظليل وتشغيل المقطع المرتبط بـ':'تظليل وقراءة ')+(isHeader?'رؤوس الأعمدة':'صف '+label)+' من '+table.title+'، صفحة '+digits(pageIndex+1));
    button.title=patientFullAudio
      ?(isHeader?'تظليل وتشغيل التسجيل المرتبط بعناوين الجدول':'تظليل وتشغيل التسجيل المرتبط بصف '+label)
      :(isHeader?'تظليل عناوين الجدول وقراءتها':'تظليل وقراءة صف '+label);
    button.addEventListener('click',function(event){
      event.stopPropagation();
      showHighlight(visual,{left:table.left,top:top,width:table.width,height:bottom-top},
        isHeader?'عناوين الجدول':label,pageIndex+1,button,safety);
      if(speechText)readText(speechText,safety,pageIndex+1,false);
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
      visual.setAttribute('aria-label',patientFullAudio
        ?'محتوى '+title+'؛ اضغط على كلمة أو سطر لتظليله وتشغيل مقطع قريب من موضعه في التسجيل، مع توقيت تقريبي، أو اختر صفًا من الجدول للاستماع إلى المقطع المطابق للنص.'
        :'محتوى '+title+'؛ اضغط على سطر لقراءته وتظليله، أو اختر صفًا من الجدول لقراءته كاملًا.');
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
    soundButton.setAttribute('aria-label',soundEnabled?'كتم أصوات التقليب والتظليل والتنبيه':'تشغيل أصوات التقليب والتظليل والتنبيه');
    soundButton.title=soundEnabled?'كتم أصوات التقليب والتظليل والتنبيه':'تشغيل أصوات التقليب والتظليل والتنبيه';
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

  function cancelWarningSound(){
    warningSoundToken++;
    if(warningSoundTimer){window.clearTimeout(warningSoundTimer);warningSoundTimer=null;}
    warningOscillators.forEach(function(oscillator){
      try{oscillator.stop();}catch(error){}
    });
    warningOscillators=[];
    if(warningSoundResolve){
      var resolve=warningSoundResolve;
      warningSoundResolve=null;
      resolve(false);
    }
  }

  function playWarningSound(request){
    if(!soundEnabled||!PageAudio)return Promise.resolve(false);
    return audioReady().then(function(context){
      if(!context||!soundEnabled||request!==speechRequest)return false;
      cancelWarningSound();
      var token=warningSoundToken;
      var now=context.currentTime;
      var notes=[{frequency:760,offset:0},{frequency:570,offset:.19},{frequency:760,offset:.4}];
      try{
        notes.forEach(function(note){
          var start=now+note.offset;
          var oscillator=context.createOscillator();
          var envelope=context.createGain();
          oscillator.type='triangle';
          oscillator.frequency.setValueAtTime(note.frequency,start);
          envelope.gain.setValueAtTime(.0001,start);
          envelope.gain.exponentialRampToValueAtTime(.11,start+.012);
          envelope.gain.exponentialRampToValueAtTime(.0001,start+.12);
          oscillator.connect(envelope);
          envelope.connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start+.13);
          warningOscillators.push(oscillator);
        });
      }catch(error){
        cancelWarningSound();
        return false;
      }
      return new Promise(function(resolve){
        warningSoundResolve=resolve;
        warningSoundTimer=window.setTimeout(function(){
          if(token!==warningSoundToken)return;
          warningSoundTimer=null;
          warningOscillators=[];
          warningSoundResolve=null;
          resolve(true);
        },650);
      });
    }).catch(function(){return false;});
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
      soundButton.title='أصوات التظليل والتنبيه غير مدعومة في هذا المتصفح';
      soundButton.setAttribute('aria-label','أصوات التظليل والتنبيه غير مدعومة في هذا المتصفح');
      if(soundLabel)soundLabel.textContent='الصوت غير متاح';
    }else{
      soundButton.addEventListener('click',function(){
        soundEnabled=!soundEnabled;
        updateSoundControl();
        if(soundEnabled)audioReady();
        else cancelWarningSound();
      });
      updateSoundControl();
    }
  }
  initializeSpeechSettings();
  if(pageReadButton){
    pageReadButton.addEventListener('click',function(){
      if(speechActive){stopSpeech();return;}
      var transcript=pages[current].querySelector('.page-transcript pre');
      var text=transcript?transcript.textContent:(pages[current].getAttribute('data-page-title')||'');
      readText(text,safetyForText(text),current+1,true);
    });
    updatePageReadButton();
  }
  if(patientFullAudio){
    if(patientAudioButton)patientAudioButton.addEventListener('click',function(){
      if(patientFullAudio.paused){
        if(patientFullAudio.ended){try{patientFullAudio.currentTime=0;}catch(error){}}
        playPatientAudio();
      }else patientFullAudio.pause();
    });
    patientFullAudio.addEventListener('play',function(){
      if(!patientAudioIsExcerpt)stopSpeech();
      updatePatientAudioButton();
      if(patientAudioStatus)patientAudioStatus.textContent=patientAudioIsExcerpt
        ?'يُشغّل الآن '+(patientAudioExcerptLabel||('مقطع مرتبط بصفحة '+digits(patientAudioExcerptPage)+' بتوقيت تقريبي'))+' من التسجيل المتصل بصوت رجالي باللهجة المصرية.'
        :'يُشغّل الآن التسجيل الكامل المتصل بصوت رجالي باللهجة المصرية.';
    });
    patientFullAudio.addEventListener('pause',function(){
      updatePatientAudioButton();
      if(patientAudioExcerptFinished){patientAudioExcerptFinished=false;return;}
      if(patientAudioIsExcerpt){speechActive=false;updatePageReadButton();}
      if(!patientFullAudio.ended&&patientAudioStatus)patientAudioStatus.textContent='توقف الاستماع مؤقتًا. يمكنك استكماله من مشغّل الصوت.';
    });
    patientFullAudio.addEventListener('timeupdate',function(){
      if(!patientAudioIsExcerpt||patientAudioExcerptEnd===null||patientFullAudio.currentTime<patientAudioExcerptEnd)return;
      patientAudioExcerptFinished=true;
      patientAudioIsExcerpt=false;
      patientAudioExcerptStart=null;
      patientAudioExcerptEnd=null;
      patientAudioExcerptPage=0;
      patientAudioExcerptLabel='';
      speechActive=false;
      patientFullAudio.pause();
      updatePageReadButton();
      if(patientAudioStatus)patientAudioStatus.textContent='انتهى المقطع المحدد. يمكنك متابعة التسجيل الكامل من مشغّل الصوت.';
    });
    patientFullAudio.addEventListener('seeking',function(){
      if(!patientAudioIsExcerpt||patientAudioExcerptStart===null||patientAudioExcerptEnd===null)return;
      var position=patientFullAudio.currentTime;
      if(position<patientAudioExcerptStart-.5)return;
      if(position<=patientAudioExcerptEnd+.5)return;
      patientAudioIsExcerpt=false;
      patientAudioExcerptStart=null;
      patientAudioExcerptEnd=null;
      patientAudioExcerptPage=0;
      patientAudioExcerptLabel='';
      speechActive=false;
      updatePageReadButton();
    });
    patientFullAudio.addEventListener('ended',function(){
      patientAudioIsExcerpt=false;
      patientAudioExcerptStart=null;
      patientAudioExcerptEnd=null;
      patientAudioExcerptPage=0;
      patientAudioExcerptLabel='';
      speechActive=false;
      updatePageReadButton();
      updatePatientAudioButton();
      if(patientAudioStatus)patientAudioStatus.textContent='انتهى التسجيل الكامل المتصل للكتيّب.';
    });
    patientFullAudio.addEventListener('error',function(){
      patientAudioIsExcerpt=false;
      patientAudioExcerptStart=null;
      patientAudioExcerptEnd=null;
      patientAudioExcerptPage=0;
      patientAudioExcerptLabel='';
      speechActive=false;
      updatePageReadButton();
      updatePatientAudioButton();
      if(patientAudioStatus)patientAudioStatus.textContent='تعذّر تحميل التسجيل الصوتي. حدّث الصفحة أو استخدم النص الكامل للصفحات.';
    });
    updatePatientAudioButton();
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
