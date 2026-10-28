import assert from 'node:assert/strict';
import { convertRomaji } from '../prototype/kana-input.js';
const examples={neko:'ねこ',gakkou:'がっこう',ringo:'りんご',yakusoku:'やくそく',junbi:'じゅんび',unten:'うんてん',kankyou:'かんきょう',doryoku:'どりょく',kakunin:'かくにん',kouken:'こうけん',keikou:'けいこう',kaizen:'かいぜん',kattou:'かっとう',hairyo:'はいりょ',dakai:'だかい',konnichiha:'こんにちは',"shin'you":'しんよう',matcha:'まっちゃ',kitte:'きって',nn:'ん',nna:'んな',nyan:'にゃん','ＮＥＫＯ':'ねこ','ko-hi-':'こーひー',xtsu:'っ','ネコ':'ねこ'};
for(const [raw,expected] of Object.entries(examples)){const result=convertRomaji(raw);assert.equal(result.hiragana,expected,raw);assert.equal(result.complete,true,raw);}
assert.equal(convertRomaji('neko').katakana,'ネコ');
assert.equal(convertRomaji('k').complete,false);
assert.equal(convertRomaji('sh').invalid,false);
assert.equal(convertRomaji('neko?').complete,false);
assert.equal(convertRomaji('고양이').invalid,true);
assert.equal(convertRomaji('').complete,false);
assert.equal(convertRomaji('q').invalid,true);
console.log(`Kana conversion: ${Object.keys(examples).length} examples and incomplete/invalid input checks passed.`);
