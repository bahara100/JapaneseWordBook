import { words, grammar, levels } from './content.js';
import { illustration } from './art.js';
import { convertRomaji } from './kana-input.js';
import { icon } from './visuals.js';

const main = document.querySelector('#main');
const state = {
  level: 'N5', target: 15, romaji: false, rate: '0.85', timeZone: 'auto',
  favorites: new Set(), route: 'home', query: '', filter: 'all', selected: null,
  daily: null, session: null, typing: false, composing: false, noticeTimer: null
};
const navItems = [['home','home','홈'],['study','cards','오늘의 학습'],['words','book','단어장'],['grammar','grammar','문법'],['favorites','star','즐겨찾기']];
const esc = value => String(value).replace(/[&<>"']/g, character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s/g,'').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
const pill = level => `<span class="pill">${esc(level)}</span>`;
const star = word => `<button class="star" data-action="favorite" data-id="${word.id}" aria-pressed="${state.favorites.has(word.id)}" aria-label="${esc(word.written)} 즐겨찾기 ${state.favorites.has(word.id)?'해제':'추가'}">${icon('star')}</button>`;
const goalControls = () => `<div class="segmented" role="group" aria-label="하루 카드 수">${[10,15,20].map(n=>`<button class="segment ${state.target===n?'active':''}" aria-pressed="${state.target===n}" data-action="target" data-value="${n}">${n}장</button>`).join('')}</div>`;
function notify(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.hidden=false;clearTimeout(state.noticeTimer);state.noticeTimer=setTimeout(()=>{toast.hidden=true;},4500);}
function routeTo(route){if(location.hash===`#/${route}`)render(true);else location.hash=`/${route}`;}
function title(eyebrow,heading,description,extra=''){return `<div class="eyebrow">${eyebrow}</div><div class="page-title"><h1 tabindex="-1">${heading}</h1>${extra}</div><p class="lead">${description}</p>`;}
function renderNav(){
  const active=state.route;
  document.querySelector('#desktop-nav').innerHTML=navItems.map(([id,symbol,label])=>`<a class="nav-item ${active===id?'active':''}" ${active===id?'aria-current="page"':''} href="#/${id}"><span class="nav-icon">${icon(symbol)}</span>${label}</a>`).join('');
  document.querySelector('#mobile-nav').innerHTML=navItems.map(([id,symbol,label],i)=>`<a class="nav-item ${active===id?'active':''}" ${active===id?'aria-current="page"':''} href="#/${id}"><span class="nav-icon">${icon(symbol)}</span>${['홈','학습','단어장','문법','즐겨찾기'][i]}</a>`).join('');
  document.querySelector('#topbar-context').textContent={home:'나의 학습 공간',study:'오늘의 학습',words:'단어 라이브러리',grammar:'문법 노트',favorites:'나의 보관함',settings:'학습 설정'}[active];
  document.querySelector('#topbar-settings').innerHTML=`${icon('settings')}<span>설정</span>`;
}
function renderHome(){
  const daily=state.daily;
  const label=!daily?'학습 시작하기':daily.index>=daily.cards.length?'학습 결과 보기':'이어서 학습';
  main.innerHTML=title('','오늘의 학습','오늘 준비된 단어를 그림으로 익혀보세요.')+
  `<section class="hero" aria-label="오늘의 학습"><div class="hero-copy"><div class="hero-meta"><span class="pill">${daily?daily.level:state.level} · ${daily?'진행 중':levels.find(l=>l.id===state.level).label}</span><span class="hero-meta-divider"></span><span>하루 ${state.target}장</span></div><h2>그림으로 떠올리고,<br>일본어로 읽어봐요.</h2><p>${daily?`샘플 ${daily.cards.length}장 중 ${Math.min(daily.index,daily.cards.length)}장을 확인했어요.`:'한 장씩, 나의 속도로 시작해 보세요.'}</p><button class="btn primary hero-start" data-action="start-daily">${label}${icon('arrow')}</button><span class="hero-sample-note">디자인 시안에서는 샘플 3장으로 진행해요.</span></div><div class="clean-home-image">${illustration('cat')}</div></section>`;
}
function createSession(cards,type,level){return {cards:[...cards],type,level,index:0,answers:[],revealed:false,result:null,input:'',roman:''};}
function typingForm(){
  return `<form class="practice-input" id="typing-form"><span class="input-label">나의 답안</span><div class="kana-answer" lang="ja" id="kana-answer" aria-live="polite"></div><div class="answer-tools"><button class="text-button" type="button" data-action="erase-kana">한 글자 지우기</button><button class="text-button" type="button" data-action="clear-kana">모두 지우기</button></div><span class="input-label" id="candidate-label">변환 후보</span><div id="kana-candidates" class="kana-candidates" role="group" aria-labelledby="candidate-label"></div><label for="answer-input">영문 자판으로 입력</label><input id="answer-input" lang="en" inputmode="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="roman-help" placeholder="예: neko, gakkou" value="${esc(state.session.roman)}"><p id="roman-help" class="subtle">위의 후보를 눌러 답안에 추가하세요.<br>Enter는 히라가나 추가 · nn → ん · 자음 반복 → っ</p><button class="btn primary wide" type="button" data-action="preview-answer">입력 완료 · 정답 확인</button><p class="subtle input-disclaimer">지금은 입력·변환을 체험하는 시안으로, 답안은 채점하지 않아요.</p></form>`;
}
function renderKanaInput(){
  const area=document.querySelector('#kana-candidates'),answer=document.querySelector('#kana-answer');
  if(!area||!answer||!state.session)return;
  const result=convertRomaji(state.session.roman);
  answer.textContent=state.session.input||'선택한 문자가 여기에 표시돼요';
  answer.classList.toggle('empty-answer',!state.session.input);
  if(!state.session.roman.trim()){area.innerHTML='<span class="candidate-help">영문을 입력하면 히라가나·가타카나 후보가 보여요.</span>';return;}
  if(!result.complete){area.innerHTML=`<span class="candidate-help" role="status">${result.invalid?'영문 로마자로 입력해 주세요.':'이어서 입력해 주세요.'}${result.hiragana?` <span lang="ja">${esc(result.hiragana)}</span>`:''} <span class="pending-roman">${esc(result.pending)}</span></span>`;return;}
  area.innerHTML=`<button class="kana-candidate" type="button" data-action="choose-kana" data-script="hiragana"><span lang="ja">${esc(result.hiragana)}</span><small>히라가나</small></button><button class="kana-candidate" type="button" data-action="choose-kana" data-script="katakana"><span lang="ja">${esc(result.katakana)}</span><small>가타카나</small></button>`;
}
function commitKana(script='hiragana'){
  if(state.composing)return false;
  const result=convertRomaji(state.session.roman);
  if(!result.complete){notify('로마자 입력을 마친 뒤 후보를 선택해 주세요.');return false;}
  state.session.input+=result[script];state.session.roman='';
  const input=document.querySelector('#answer-input');if(input){input.value='';input.focus({preventScroll:true});}
  renderKanaInput();return true;
}
function previewTypedAnswer(){
  if(state.composing)return;
  if(state.session.roman.trim()&&!commitKana())return;
  if(!state.session.input){notify('영문으로 입력한 뒤 변환 후보를 선택해 주세요.');document.querySelector('#answer-input')?.focus();return;}
  state.session.revealed=true;state.session.result='revealed';state.typing=false;renderStudy();notify('입력한 답안을 표시했어요. 시안에서는 채점하지 않아요.');
}
function startDaily(){if(!state.daily)state.daily=createSession(words.filter(w=>w.level===state.level),'daily',state.level);state.session=state.daily;state.typing=false;routeTo('study');}
function startPractice(cards,type='favorites'){if(!cards.length)return;state.session=createSession(cards,type,type==='favorites'?'모은 단어':'복습');state.typing=false;routeTo('study');}
function renderStudy(){
  if(!state.session){if(state.daily)state.session=state.daily;else{main.innerHTML=title('','그림카드 학습','선택한 수준의 그림카드를 한 장씩 살펴보세요.')+`<div class="summary">${pill(state.level)}<h2 style="margin-top:22px">그림을 보고, 일본어로 떠올려요.</h2><p class="subtle">하루 목표 ${state.target}장 · 지금은 샘플 3장<br>실제 음성·저장 기능은 아직 연결하지 않았어요.</p><button class="btn primary" data-action="start-daily">샘플 학습 시작 →</button></div>`;return;}}
  const session=state.session;
  if(session.index>=session.cards.length){renderSummary(session);return;}
  const word=session.cards[session.index];
  const feedback=session.result==='correct'?'<div class="feedback" role="status">정답 단어로 인식한 경우의 화면이에요.</div>':session.result==='incorrect'?'<div class="feedback retry" role="status">읽기를 다시 확인해 볼까요? · 재학습 결과 예시</div>':'<div class="feedback" role="status">정답을 확인했어요. · 답 확인 예시</div>';
  main.innerHTML=title(session.type==='daily'?'DAILY PRACTICE':'MY WORDS, ONE MORE TIME',session.type==='daily'?'그림카드 학습':'모아 보는 그림카드','그림을 보고 답한 뒤 정답을 확인하세요.',pill(session.level))+
  `<div class="study-layout"><section aria-label="그림카드"><div class="study-topline"><span>${session.type==='daily'?'오늘의':'별도 연습'} 샘플 카드</span><span>${session.index+1} / ${session.cards.length}장</span></div><div class="progress" role="progressbar" aria-label="카드 진행률" aria-valuemin="0" aria-valuemax="${session.cards.length}" aria-valuenow="${session.index}"><span style="width:${session.index/session.cards.length*100}%"></span></div><article class="study-card ${state.typing&&!session.revealed?'is-typing':''}" aria-label="${session.revealed?'정답':'문제'} 카드">${!session.revealed?`
  <div class="card-front"><span class="caption">LOOK · THINK · SAY</span>${illustration(word.art)}<h2 class="card-question">일본어로 무엇일까요?</h2><p>그림을 보고 일본어 읽기를 떠올려 보세요.</p><div class="button-row"><button class="btn primary" data-action="microphone">${icon('mic')}말하기</button><button class="btn" data-action="typing" aria-expanded="${state.typing}">${icon('keyboard')}직접 입력</button></div>${state.typing?typingForm():''}<details class="demo-actions"><summary>채점 화면 미리보기</summary><div class="button-row"><button class="btn soft" data-action="reveal" data-result="correct">정답 예시</button><button class="btn" data-action="reveal" data-result="incorrect">다시 연습 예시</button></div></details></div><div class="card-actions"><button class="btn wide" data-action="reveal" data-result="revealed">${icon('flip')}카드 뒤집어 정답 보기</button></div>`:`
  <div class="card-back">${feedback}${session.input?`<p class="submitted-answer">내가 입력한 답 <span lang="ja">${esc(session.input)}</span></p>`:''}<div style="display:flex;justify-content:space-between;align-items:center">${pill(word.level)}${star(word)}</div><h2 lang="ja">${word.written}</h2><div class="kana" lang="ja">${word.kana}</div>${state.romaji?`<div class="romaji">${word.romaji}</div>`:''}<div class="meaning">${word.meaning}</div><button class="btn soft" data-action="audio">${icon('sound')}발음 듣기</button><div class="example"><span class="example-label">예문</span><p lang="ja">${word.example}</p><small class="example-reading" lang="ja">${word.reading}</small><small>${word.translation}</small></div></div><div class="card-actions"><button class="btn primary wide" data-action="next">${session.index===session.cards.length-1?'샘플 학습 결과 보기':'다음 카드'} →</button></div>`}</article></section><details class="study-side"><summary>학습 도움말</summary><section class="study-note"><span class="eyebrow">ONE CARD, THREE STEPS</span><h3>천천히, 나의 속도로.</h3><ol class="learning-steps"><li><span>01</span><div>그림으로 떠올려요<small>어떤 단어인지 생각해 보세요.</small></div></li><li><span>02</span><div>나의 말로 답해요<small>말하거나 영문으로 입력해요.</small></div></li><li><span>03</span><div>뒤집어서 확인해요<small>읽기와 뜻, 예문을 익혀요.</small></div></li></ol></section><section class="study-note"><span class="note-icon">${icon('mic')}</span><h3>입으로 읽으면, 더 오래.</h3><p>단어를 소리 내어 읽는 연습을 해보세요. 마이크와 발음 듣기는 다음 단계에서 연결할 예정이에요.</p></section><details class="study-note preview-help"><summary>미리보기 안내</summary><p>입력과 카드 선택을 체험할 수 있어요. 음성·채점·영구 저장은 연결 전이며, 말한 단어 확인과 정밀 발음 평가는 별도로 설계했어요.</p></details><a class="text-button study-home" href="#/home">홈으로 돌아가기 ↗</a></details></div>`;
  if(state.typing&&!session.revealed)renderKanaInput();
}
function renderSummary(session){
 const correct=session.answers.filter(a=>a==='correct').length,retry=session.answers.filter(a=>a==='incorrect').length,revealed=session.answers.filter(a=>a==='revealed').length;
 main.innerHTML=title('A SMALL STEP, COMPLETED','한 장씩, 잘 살펴봤어요.','지금 본 학습 흐름을 실제 기능으로 연결할 예정이에요.')+`<section class="summary"><span class="pill">샘플 학습 결과</span><div class="summary-number">${session.cards.length}<small> / ${session.cards.length}</small></div><p class="subtle">그림카드를 모두 확인했어요.</p><div class="summary-stats"><span><strong>${correct}</strong>정답 예시</span><span><strong>${retry}</strong>다시 연습 예시</span><span><strong>${revealed}</strong>답 확인</span></div><div class="button-row"><button class="btn primary" data-route="words">단어 더 살펴보기 →</button><button class="btn" data-action="restart">샘플 다시 보기</button></div><p class="prototype-callout" style="text-align:left">예시 버튼으로 만든 결과이며 실제 정답률이나 학습 기록이 아니에요. 실제 구현에서는 첫 평가·힌트·인식 실패를 구분해 저장해요.</p></section>`;
}
function renderLibrary(){
 const isGrammar=state.route==='grammar',favorites=state.route==='favorites';
 main.innerHTML=title(isGrammar?'':favorites?'':'',isGrammar?'문법':favorites?'즐겨찾기':'단어장',isGrammar?'접속 방법부터 예문까지, 표현이 쓰이는 맥락을 살펴보세요.':favorites?'다시 보고 싶은 단어를 모아보세요.':'일본어와 한국어 뜻으로 단어를 찾아보세요.',favorites?`<span class="pill" id="favorite-count">${state.favorites.size}개 보관</span>`:'')+
 `<div class="searchbar"><div class="field search-field"><label for="search">${isGrammar?'문법 검색':'단어 검색'}</label><input id="search" type="search" value="${esc(state.query)}" placeholder="${isGrammar?'표현 또는 한국어 의미':'한자 · 히라가나 · 한국어 뜻'}" autocomplete="off"></div><div class="field"><label for="level-filter">학습 수준</label><select id="level-filter"><option value="all">전체 수준</option>${levels.map(l=>`<option value="${l.id}" ${state.filter===l.id?'selected':''}>${l.id} · ${l.label}</option>`).join('')}</select></div></div><div id="library-content"></div><p class="bottom-note">${isGrammar?'시안에는 수준별 1개씩, 샘플 문법 5개가 있어요.':'시안에는 수준별 3개씩, 샘플 단어 15개가 있어요.'} 수준 분류와 내용은 공개 전 검수가 필요해요.</p>`;
 renderLibraryContents();
}
function getFiltered(){
 const isGrammar=state.route==='grammar', favorites=state.route==='favorites';
 const query=normalize(state.query);
 return (isGrammar?grammar:words).filter(item=>(state.filter==='all'||item.level===state.filter)&&(!favorites||state.favorites.has(item.id))&&(!query||normalize(isGrammar?`${item.expression} ${item.meaning} ${item.explanation}`:`${item.written} ${item.kana} ${item.meaning}`).includes(query)));
}
function renderLibraryContents(){
 const items=getFiltered(),isGrammar=state.route==='grammar',favorites=state.route==='favorites';
 const area=document.querySelector('#library-content');
 if(!items.some(item=>item.id===state.selected))state.selected=items[0]?.id||null;
 if(!items.length){area.innerHTML=`<div class="empty"><div class="empty-mark" aria-hidden="true">${icon(favorites&&!state.favorites.size?'star':'search')}</div><h2>${favorites&&!state.favorites.size?'나의 단어장을 채워 보세요.':'일치하는 항목이 없어요.'}</h2><p>${favorites&&!state.favorites.size?'단어 옆의 별을 누르면 이곳에서 다시 볼 수 있어요.':'검색어를 바꾸거나 다른 수준을 살펴보세요.'}</p><button class="btn primary" ${favorites&&!state.favorites.size?'data-route="words"':'data-action="clear-search"'}>${favorites&&!state.favorites.size?'단어장 둘러보기 →':'검색 조건 지우기'}</button></div>`;return;}
 area.innerHTML=`<div class="study-topline"><p class="result-count" aria-live="polite">${items.length}개의 ${isGrammar?'문법':'단어'}</p>${favorites?'<button class="text-button" data-action="practice-favorites">모은 단어 학습하기 →</button>':''}</div><div class="library-layout"><div class="word-list" aria-label="${isGrammar?'문법':'단어'} 목록">${items.map(item=>isGrammar?`<button class="grammar-row ${state.selected===item.id?'selected':''}" aria-pressed="${state.selected===item.id}" data-action="select" data-id="${item.id}">${pill(item.level)}<strong lang="ja">${item.expression}</strong><span>${item.meaning}</span></button>`:`<div class="word-row ${state.selected===item.id?'selected':''}"><button class="word-select" aria-pressed="${state.selected===item.id}" data-action="select" data-id="${item.id}"><span class="word-written" lang="ja">${item.written}</span><span class="word-kana" lang="ja">${item.kana}</span><span class="word-meta"><span>${item.meaning}</span>${pill(item.level)}</span></button>${star(item)}</div>`).join('')}</div><section id="detail" class="detail-panel ${isGrammar?'grammar-detail':''}" aria-label="선택한 ${isGrammar?'문법':'단어'} 상세">${isGrammar?grammarDetail(items.find(i=>i.id===state.selected)):wordDetail(items.find(i=>i.id===state.selected))}</section></div>`;
}
function wordDetail(word){return `<div class="detail-title">${pill(word.level)}${star(word)}</div>${illustration(word.art,true)}<h2 lang="ja">${word.written}</h2><div class="kana" lang="ja">${word.kana}</div>${state.romaji?`<div class="romaji">${word.romaji}</div>`:''}<p class="meaning">${word.meaning} <small class="subtle">${word.pos}</small></p><button class="btn soft" data-action="audio">${icon('sound')}발음 듣기</button><div class="example"><span class="example-label">예문</span><p lang="ja">${word.example}</p><p class="example-reading" lang="ja">${word.reading}</p><small>${word.translation}</small></div>`;}
function grammarDetail(item){return `${pill(item.level)}<h2 lang="ja">${item.expression}</h2><p class="meaning">${item.meaning}</p><h3>접속 형태</h3><div class="connection">${item.connection}</div><h3>이럴 때 사용해요</h3><p>${item.explanation}</p><h3>예문으로 익히기</h3><div class="example" style="margin-top:0;padding-top:12px"><p lang="ja">${item.example}</p><p class="example-reading" lang="ja">${item.reading}</p><small>${item.translation}</small></div><button class="btn soft" data-action="audio">${icon('sound')}예문 듣기</button><h3>알아두면 좋아요</h3><p>${item.caution}</p>`;}
function renderSettings(){
 main.innerHTML=title('','설정','학습 수준과 표시 방법을 정할 수 있어요.')+
 `<div class="settings-grid"><section class="settings-panel"><div class="panel-heading"><h2>나의 학습</h2></div><div class="field"><label for="settings-level">학습 수준</label><select id="settings-level">${levels.map(l=>`<option value="${l.id}" ${state.level===l.id?'selected':''}>${l.id} · ${l.label}</option>`).join('')}</select></div><div class="field"><span class="field-label">하루 카드 수</span>${goalControls()}</div><p>수준과 카드 수를 바꾸면 다음 학습일부터 적용해요.</p><div class="field"><label for="settings-timezone">학습일 기준 시간대</label><select id="settings-timezone">${[['auto','기기 시간대 따르기'],['Asia/Seoul','Asia/Seoul'],['Asia/Tokyo','Asia/Tokyo'],['UTC','UTC']].map(([value,label])=>`<option value="${value}" ${state.timeZone===value?'selected':''}>${label}</option>`).join('')}</select><small class="subtle">선택한 시간대의 자정에 새 학습일이 시작돼요.</small></div></section><section class="settings-panel"><div class="panel-heading"><h2>읽기와 소리</h2></div><label class="setting-switch" for="romaji-toggle"><span>로마자 함께 보기<small class="subtle" style="display:block">히라가나 아래에 보조 표기</small></span><input id="romaji-toggle" type="checkbox" ${state.romaji?'checked':''}></label><div class="field"><label for="speech-rate">발음 재생 속도</label><select id="speech-rate"><option value="0.7" ${state.rate==='0.7'?'selected':''}>천천히</option><option value="0.85" ${state.rate==='0.85'?'selected':''}>조금 천천히</option><option value="1" ${state.rate==='1'?'selected':''}>기본 속도</option></select></div><p>발음 듣기와 마이크는 아직 연결 전이에요.</p></section><section class="settings-panel"><div class="panel-heading"><h2>시안 데이터</h2></div><p>설정·즐겨찾기·학습 진행은 이 화면에서만 체험할 수 있어요. 새로고침하면 초기화돼요.</p></section></div>`;
}
function render(focus=false){
 const candidate=location.hash.replace(/^#\//,'').split('/')[0]||'home';
 state.route=['home','study','words','grammar','favorites','settings'].includes(candidate)?candidate:'home';
 if(['words','grammar','favorites'].includes(state.route)&&state.previousRoute!==state.route){state.query='';state.filter='all';state.selected=null;}
 state.previousRoute=state.route;
 renderNav();
 if(state.route==='home')renderHome();else if(state.route==='study')renderStudy();else if(state.route==='settings')renderSettings();else renderLibrary();
 if(focus){window.scrollTo(0,0);main.querySelector('h1')?.focus({preventScroll:true});}
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action],[data-route]');if(!button)return;
 if(button.dataset.route){routeTo(button.dataset.route);return;}
 const {action,id,value,result}=button.dataset;
 if(action==='start-daily'){startDaily();return;}
 if(action==='target'){state.target=Number(value);render();main.querySelector(`[data-action="target"][data-value="${value}"]`)?.focus({preventScroll:true});notify(`하루 목표 ${state.target}장 · 시안에서는 샘플 3장을 보여드려요.`);return;}
 if(action==='favorite'){
  state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);
  const word=words.find(w=>w.id===id);
  notify(`${word.written} ${state.favorites.has(id)?'단어를 보관함에 담았어요.':'단어를 보관함에서 꺼냈어요.'} · 시안 내 임시 저장`);
  if(['words','favorites'].includes(state.route)){renderLibraryContents();const counter=document.querySelector('#favorite-count');if(counter)counter.textContent=`${state.favorites.size}개 보관`;main.querySelector(`[data-action="favorite"][data-id="${id}"]`)?.focus({preventScroll:true});}else render();return;
 }
 if(action==='microphone'){notify('마이크는 아직 연결하지 않았어요. 예시 버튼으로 채점 뒤의 화면을 살펴보세요.');return;}
 if(action==='audio'){notify('발음 듣기는 다음 구현 단계에서 연결해요. 지금은 재생 버튼의 위치와 구성을 확인할 수 있어요.');return;}
 if(action==='typing'){state.typing=!state.typing;renderStudy();document.querySelector('#answer-input')?.focus();return;}
 if(action==='choose-kana'){commitKana(button.dataset.script);return;}
 if(action==='erase-kana'){state.session.input=Array.from(state.session.input).slice(0,-1).join('');renderKanaInput();return;}
 if(action==='clear-kana'){state.session.input='';state.session.roman='';const input=document.querySelector('#answer-input');if(input){input.value='';input.focus({preventScroll:true});}renderKanaInput();return;}
 if(action==='preview-answer'){previewTypedAnswer();return;}
 if(action==='reveal'){state.session.revealed=true;state.session.result=result;state.typing=false;renderStudy();main.querySelector('.card-back h2')?.setAttribute('tabindex','-1');main.querySelector('.card-back h2')?.focus({preventScroll:true});return;}
 if(action==='next'){
  if(!state.session.revealed)return;
  state.session.answers.push(state.session.result||'revealed');state.session.index++;state.session.revealed=false;state.session.result=null;state.session.input='';state.session.roman='';render(true);return;
 }
 if(action==='restart'){startPractice(state.session.cards,'practice');return;}
 if(action==='select'){state.selected=id;renderLibraryContents();const detail=document.querySelector('#detail');if(window.matchMedia('(max-width:719px)').matches)detail.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});detail.querySelector('h2')?.setAttribute('tabindex','-1');detail.querySelector('h2')?.focus({preventScroll:true});return;}
 if(action==='clear-search'){state.query='';state.filter='all';state.selected=null;renderLibrary();document.querySelector('#search')?.focus();return;}
 if(action==='practice-favorites'){startPractice(getFiltered());return;}
});
document.addEventListener('input',event=>{if(event.target.id==='search'){state.query=event.target.value;renderLibraryContents();}if(event.target.id==='answer-input'&&state.session){state.session.roman=event.target.value;if(!event.isComposing)renderKanaInput();}});
document.addEventListener('compositionstart',event=>{if(event.target.id==='answer-input')state.composing=true;});
document.addEventListener('compositionend',event=>{if(event.target.id==='answer-input'){state.composing=false;state.session.roman=event.target.value;renderKanaInput();}});
document.addEventListener('change',event=>{
 const input=event.target;
 if(input.id==='level-filter'){state.filter=input.value;renderLibraryContents();}
 if(input.id==='settings-timezone'){state.timeZone=input.value;notify('시간대 선택 화면 예시예요. 실제 날짜별 배정에는 연결하지 않았어요.');}
 if(input.id==='settings-level'){state.level=input.value;notify('시안의 학습 수준을 변경했어요. 진행 중인 샘플 구성은 유지해요.');}
 if(input.id==='romaji-toggle'){state.romaji=input.checked;notify(`로마자 보조 표기를 ${state.romaji?'켰어요.':'껐어요.'}`);}
 if(input.id==='speech-rate'){state.rate=input.value;notify('속도 선택 화면 예시예요. 실제 음성은 연결 전이에요.');}
});
document.addEventListener('submit',event=>{if(event.target.id!=='typing-form')return;event.preventDefault();if(state.session.roman.trim())commitKana();});
window.addEventListener('hashchange',()=>render(true));
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView({block:'start'});});
render();
