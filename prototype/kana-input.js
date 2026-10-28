// Keyboard transliteration only: this does not infer vocabulary or correct answers.
const kanaRows = {
  a:'あ',i:'い',u:'う',e:'え',o:'お',
  ka:'か',ki:'き',ku:'く',ke:'け',ko:'こ',ga:'が',gi:'ぎ',gu:'ぐ',ge:'げ',go:'ご',
  sa:'さ',shi:'し',si:'し',su:'す',se:'せ',so:'そ',za:'ざ',ji:'じ',zi:'じ',zu:'ず',ze:'ぜ',zo:'ぞ',
  ta:'た',chi:'ち',ti:'ち',tsu:'つ',tu:'つ',te:'て',to:'と',da:'だ',di:'ぢ',du:'づ',de:'で',do:'ど',
  na:'な',ni:'に',nu:'ぬ',ne:'ね',no:'の',ha:'は',hi:'ひ',fu:'ふ',hu:'ふ',he:'へ',ho:'ほ',
  ba:'ば',bi:'び',bu:'ぶ',be:'べ',bo:'ぼ',pa:'ぱ',pi:'ぴ',pu:'ぷ',pe:'ぺ',po:'ぽ',
  ma:'ま',mi:'み',mu:'む',me:'め',mo:'も',ya:'や',yu:'ゆ',yo:'よ',
  ra:'ら',ri:'り',ru:'る',re:'れ',ro:'ろ',wa:'わ',wi:'うぃ',we:'うぇ',wo:'を',
  kya:'きゃ',kyu:'きゅ',kyo:'きょ',gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',
  sha:'しゃ',shu:'しゅ',sho:'しょ',sya:'しゃ',syu:'しゅ',syo:'しょ',
  ja:'じゃ',ju:'じゅ',jo:'じょ',jya:'じゃ',jyu:'じゅ',jyo:'じょ',zya:'じゃ',zyu:'じゅ',zyo:'じょ',
  cha:'ちゃ',chu:'ちゅ',cho:'ちょ',cya:'ちゃ',cyu:'ちゅ',cyo:'ちょ',tya:'ちゃ',tyu:'ちゅ',tyo:'ちょ',
  dya:'ぢゃ',dyu:'ぢゅ',dyo:'ぢょ',nya:'にゃ',nyu:'にゅ',nyo:'にょ',
  hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',bya:'びゃ',byu:'びゅ',byo:'びょ',pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',
  mya:'みゃ',myu:'みゅ',myo:'みょ',rya:'りゃ',ryu:'りゅ',ryo:'りょ',
  fa:'ふぁ',fi:'ふぃ',fe:'ふぇ',fo:'ふぉ',va:'ゔぁ',vi:'ゔぃ',vu:'ゔ',ve:'ゔぇ',vo:'ゔぉ',
  she:'しぇ',je:'じぇ',che:'ちぇ',tsa:'つぁ',tsi:'つぃ',tse:'つぇ',tso:'つぉ',
  thi:'てぃ',dhi:'でぃ',thu:'てゅ',dhu:'でゅ',twu:'とぅ',dwu:'どぅ',
  xa:'ぁ',xi:'ぃ',xu:'ぅ',xe:'ぇ',xo:'ぉ',la:'ぁ',li:'ぃ',lu:'ぅ',le:'ぇ',lo:'ぉ',
  xya:'ゃ',xyu:'ゅ',xyo:'ょ',lya:'ゃ',lyu:'ゅ',lyo:'ょ',xtsu:'っ',xtu:'っ',ltsu:'っ',ltu:'っ',xwa:'ゎ',lwa:'ゎ'
};
const kanaKeys = Object.keys(kanaRows).sort((a,b)=>b.length-a.length);
export function toKatakana(kana){return kana.replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60));}
export function convertRomaji(raw){
  const source=raw.normalize('NFKC').toLowerCase().replace(/’/g,"'");
  let hiragana='',pending='',invalid=false;
  for(let index=0;index<source.length;){
    const rest=source.slice(index),char=source[index],next=source[index+1];
    if(/[ぁ-ゖー]/.test(char)){hiragana+=char;index++;continue;}
    if(/[ァ-ヶ]/.test(char)){hiragana+=String.fromCharCode(char.charCodeAt(0)-0x60);index++;continue;}
    if(/\s/.test(char)){index++;continue;}
    if(char==='-'){hiragana+='ー';index++;continue;}
    if(char==='n'){
      if(next==="'"){hiragana+='ん';index+=2;continue;}
      if(next==='n'){
        hiragana+='ん';index+=/[aiueoy]/.test(source[index+2]||' ')?1:2;continue;
      }
      if(!next||(/[a-z]/.test(next)&&!/[aiueoy]/.test(next))||/[\s-]/.test(next)){hiragana+='ん';index++;continue;}
    }
    if((char===next&&/[bcdfghjkmprstz]/.test(char))||rest.startsWith('tch')){hiragana+='っ';index++;continue;}
    const key=kanaKeys.find(candidate=>rest.startsWith(candidate));
    if(key){hiragana+=kanaRows[key];index+=key.length;continue;}
    pending=rest;
    invalid=!kanaKeys.some(candidate=>candidate.startsWith(rest));
    break;
  }
  return {hiragana,katakana:toKatakana(hiragana),pending,invalid,complete:hiragana.length>0&&!pending};
}
