import { illustration as existingIllustration } from './legacy-art.js';

const pictureAssets = {
  "cat": {
    "file": "card-cat-v2.png",
    "description": "편안하게 앉아 있는 동물"
  },
  "school": {
    "file": "card-school-v2.png",
    "description": "시계와 여러 창문이 있는 건물"
  },
  "apple": {
    "file": "card-apple-v2.png",
    "description": "잎과 줄기가 있는 붉은 과일"
  },
  "promise": {
    "file": "card-promise-v1.png",
    "description": "두 손의 새끼손가락을 서로 걸고 있는 모습"
  },
  "prepare": {
    "file": "card-prepare-v1.png",
    "description": "열린 여행 가방에 옷을 차곡차곡 넣는 사람"
  },
  "drive": {
    "file": "card-drive-v1.png",
    "description": "자동차 안에서 두 손으로 핸들을 잡은 사람"
  },
  "environment": {
    "file": "card-environment-v1.png",
    "description": "새싹이 돋은 작은 지구를 두 손으로 감싼 모습"
  },
  "effort": {
    "file": "card-effort-v1.png",
    "description": "책을 안고 계단을 한 걸음씩 오르는 사람"
  },
  "confirm": {
    "file": "card-confirm-v1.png",
    "description": "체크 항목이 있는 종이를 돋보기로 살펴보는 손"
  },
  "contribute": {
    "file": "card-contribute-v1.png",
    "description": "두 사람이 함께 나무 벤치에 판자를 올리는 모습"
  },
  "trend": {
    "file": "card-trend-v1.png",
    "description": "점점 높아지는 막대와 위로 이어지는 화살표"
  },
  "improve": {
    "file": "card-improve-v1.png",
    "description": "기울어진 의자에서 반듯한 의자로 이어지는 화살표"
  },
  "conflict": {
    "file": "card-conflict-v1.png",
    "description": "서로 다른 방향의 화살표 사이에서 고민하는 사람"
  },
  "consideration": {
    "file": "card-consideration-v1.png",
    "description": "지팡이를 짚은 사람에게 빈자리를 권하는 사람"
  },
  "breakthrough": {
    "file": "card-breakthrough-v1.png",
    "description": "막힌 벽의 열린 틈을 지나 앞으로 나아가는 사람"
  }
};

export function illustration(subject, small=false) {
  const asset=pictureAssets[subject];
  if(!asset) return existingIllustration(subject,small);
  return `<img class="illustration ${small?'small':''}" src="../assets/${asset.file}" width="1448" height="1086" alt="${asset.description}">`;
}
