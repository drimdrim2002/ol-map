// 50개의 구분이 잘 되는 진한 라우트 색상
export const ROUTE_COLORS = [
  "#E41A1C", // 진한 빨강
  "#0033CC", // 진한 파랑
  "#008000", // 진한 초록
  "#800080", // 진한 보라
  "#FF4500", // 진한 주황
  "#4B0082", // 진한 남색
  "#8B4513", // 진한 갈색
  "#FF1493", // 진한 분홍
  "#006400", // 진한 초록2
  "#DC143C", // 크림슨
  "#00008B", // 진한 파랑2
  "#B8860B", // 진한 황금
  "#006400", // 진한 초록3
  "#C71585", // 진한 자주
  "#191970", // 미드나잇블루
  "#8B0000", // 진한 빨강2
  "#004225", // 진한 초록4
  "#800000", // 마룬
  "#4B0150", // 진한 보라2
  "#FF0000", // 순수 빨강
  "#000080", // 네이비
  "#800020", // 버건디
  "#2F4F4F", // 다크슬레이트그레이
  "#871F78", // 진한 보라3
  "#8B008B", // 진한 자주2
  "#654321", // 진한 갈색2
  "#006B3C", // 진한 초록5
  "#CC0000", // 진한 빨강3
  "#003366", // 진한 파랑3
  "#990000", // 진한 빨강4
  "#483D8B", // 진한 슬레이트블루
  "#800000", // 마룬2
  "#4A0404", // 매우 진한 빨강
  "#36013F", // 매우 진한 보라
  "#234F1E", // 매우 진한 초록
  "#003153", // 프러시안 블루
  "#7B1113", // 와인레드
  "#665D1E", // 진한 올리브
  "#1B1B1B", // 매우 진한 회색
  "#4C2F27", // 진한 시에나
  "#2F4F2F", // 진한 시그린
  "#4B0C0C", // 매우 진한 적갈색
  "#36454F", // 차콜
  "#1A2421", // 매우 진한 청록
  "#013220", // 진한 헌터그린
  "#000F89", // 매우 진한 파랑
  "#26428B", // 진한 코발트블루
  "#008B8B", // 진한 청록2
  "#800020", // 버건디2
  "#560319", // 매우 진한 와인
];

// 색상 순환 함수
export function getRouteColor(index) {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

// 색상 밝기 조절 함수 (하이라이트 효과용)
export function adjustBrightness(color, factor) {
  // hex to rgb
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // 밝기 조절
  const brightenR = Math.min(255, r * factor);
  const brightenG = Math.min(255, g * factor);
  const brightenB = Math.min(255, b * factor);

  // rgb to hex
  return (
    "#" +
    [brightenR, brightenG, brightenB]
      .map((x) => Math.round(x).toString(16).padStart(2, "0"))
      .join("")
  );
}
