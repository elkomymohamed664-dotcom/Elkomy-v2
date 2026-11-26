(function(){
  'use strict';
  var search=document.getElementById('book-search');
  var cards=Array.prototype.slice.call(document.querySelectorAll('.book-card[data-edition]'));
  var filters=Array.prototype.slice.call(document.querySelectorAll('[data-filter]'));
  var status=document.getElementById('search-status');
  var empty=document.getElementById('empty-state');
  var reset=document.getElementById('reset-search');
  if(!search||!cards.length)return;

  var activeFilter='all';
  function normalize(value){
    return String(value||'').toLocaleLowerCase('ar').normalize('NFD')
      .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/\s+/g,' ').trim();
  }
  function update(){
    var query=normalize(search.value);
    var visible=0;
    cards.forEach(function(card){
      var text=normalize((card.getAttribute('data-search')||'')+' '+card.textContent);
      var matchesEdition=activeFilter==='all'||card.getAttribute('data-edition')===activeFilter;
      var matchesQuery=!query||text.indexOf(query)!==-1;
      var show=matchesEdition&&matchesQuery;
      card.hidden=!show;
      if(show)visible++;
    });
    empty.hidden=visible!==0;
    status.textContent=(query||activeFilter!=='all')?'عدد الإصدارات المطابقة: '+new Intl.NumberFormat('ar-EG').format(visible):'';
  }
  filters.forEach(function(button){
    button.addEventListener('click',function(){
      activeFilter=button.getAttribute('data-filter')||'all';
      filters.forEach(function(item){
        var active=item===button;
        item.classList.toggle('is-active',active);
        item.setAttribute('aria-pressed',String(active));
      });
      update();
    });
  });
  search.addEventListener('input',update);
  if(reset)reset.addEventListener('click',function(){
    search.value='';activeFilter='all';
    filters.forEach(function(item){var active=item.getAttribute('data-filter')==='all';item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active));});
    update();search.focus();
  });
  document.addEventListener('keydown',function(event){
    if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){
      event.preventDefault();search.focus();
    }
    if(event.key==='Escape'&&document.activeElement===search){search.value='';update();search.blur();}
  });
})();
