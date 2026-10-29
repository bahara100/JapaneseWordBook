import { illustration as existingIllustration } from './legacy-art.js';

const pictureAssets = {
  cat: { file: 'card-cat-v2.png', description: '편안하게 앉아 있는 동물' },
  school: { file: 'card-school-v2.png', description: '시계와 여러 창문이 있는 건물' },
  apple: { file: 'card-apple-v2.png', description: '잎과 줄기가 있는 붉은 과일' }
};

export function illustration(subject, small=false) {
  const asset=pictureAssets[subject];
  if(!asset) return existingIllustration(subject,small);
  return `<img class="illustration ${small?'small':''}" src="../assets/${asset.file}" width="1448" height="1086" alt="${asset.description}">`;
}
