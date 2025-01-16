// 30개의 구분이 잘 되는 라우트 색상
export const ROUTE_COLORS = [
  "#E41A1C", // 빨강
  "#377EB8", // 파랑
  "#4DAF4A", // 초록
  "#984EA3", // 보라
  "#FF7F00", // 주황
  "#FFFF33", // 노랑
  "#A65628", // 갈색
  "#F781BF", // 분홍
  "#1B9E77", // 청록
  "#D95F02", // 주황빨강
  "#7570B3", // 남색
  "#E6AB02", // 황금
  "#66A61E", // 라임
  "#E7298A", // 자홍
  "#1F78B4", // 하늘
  "#B2DF8A", // 연두
  "#33A02C", // 녹색
  "#FB9A99", // 연분홍
  "#E31A1C", // 진빨강
  "#FDBF6F", // 살구
  "#FF7F00", // 주황
  "#CAB2D6", // 연보라
  "#6A3D9A", // 진보라
  "#B15928", // 갈색
  "#FBB4AE", // 연살구
  "#B3CDE3", // 연파랑
  "#CCEBC5", // 연초록
  "#DECBE4", // 연자주
  "#FED9A6", // 연주황
  "#FFFFCC", // 연노랑
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
