export type Pt = { x: number; y: number; z: number };

export function dist2d(a: Pt, b: Pt): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * 握拳检测：握拳时手指折回，指尖到手腕的距离 ≤ MCP到手腕的距离。
 * 相比"指尖到MCP"的方法，这个方案在2D投影下仍然可靠——
 * 因为握拳是向深度方向弯折，指尖会"绕回"到更靠近手腕的位置。
 * 至少 3 根手指满足条件即判定为握拳。
 */
export function isFist(hand: Pt[]): boolean {
  if (hand.length < 21) return false;

  const wrist = hand[0];

  // [指尖, MCP]
  const fingerPairs: [number, number][] = [
    [8,  5],  // 食指
    [12, 9],  // 中指
    [16, 13], // 无名指
    [20, 17], // 小指
  ];

  const bentCount = fingerPairs.filter(([tip, mcp]) => {
    const tipDist  = dist2d(hand[tip], wrist);
    const mcpDist  = dist2d(hand[mcp], wrist);
    // 握拳时指尖折回，到手腕比 MCP 还近（允许 20% 容差）
    return tipDist < mcpDist * 1.2;
  }).length;

  return bentCount >= 3;
}

/** 调试用：返回每根手指的 tipDist/mcpDist 比值，值越小越弯曲 */
export function fistDebugRatios(hand: Pt[]): number[] {
  if (hand.length < 21) return [];
  const wrist = hand[0];
  return ([
    [8,  5],
    [12, 9],
    [16, 13],
    [20, 17],
  ] as [number, number][]).map(([tip, mcp]) =>
    dist2d(hand[tip], wrist) / dist2d(hand[mcp], wrist)
  );
}

/** 捏合距离：只取拇指尖(4)→食指尖(8)，对应 🤏 手势 */
export function getPinchDistance(hand: Pt[]): number {
  if (hand.length < 21) return 1;
  return dist2d(hand[4], hand[8]);
}

/**
 * 张开手掌检测（用于 DRAW 选牌瞄准）：
 * 食指/中指/无名指/小指至少 3 根明显伸展，且不是握拳。
 * 捏合时（拇指+食指并拢）其余三指仍伸展，isPalmOpen 依然返回 true，
 * 确保选牌光标在捏合确认时不会消失。
 */
export function isPalmOpen(hand: Pt[]): boolean {
  if (hand.length < 21) return false;
  if (isFist(hand)) return false;

  const palmCenter: Pt = {
    x: (hand[0].x + hand[9].x) / 2,
    y: (hand[0].y + hand[9].y) / 2,
    z: 0,
  };

  const indexExtended  = dist2d(hand[8],  palmCenter) > 0.18;
  const middleExtended = dist2d(hand[12], palmCenter) > 0.18;
  const ringExtended   = dist2d(hand[16], palmCenter) > 0.15;
  const pinkyExtended  = dist2d(hand[20], palmCenter) > 0.12;

  // 至少 3 根伸展（容忍小指或食指因捏合稍微弯曲）
  const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended]
    .filter(Boolean).length;
  return extendedCount >= 3;
}

/** 保留兼容：食指单指伸出（tutorial 里不再使用，供外部调用） */
export function isPointing(hand: Pt[]): boolean {
  if (hand.length < 21) return false;
  if (isFist(hand)) return false;
  const palmCenter: Pt = {
    x: (hand[0].x + hand[9].x) / 2,
    y: (hand[0].y + hand[9].y) / 2,
    z: 0,
  };
  const indexExtended = dist2d(hand[8], palmCenter) > 0.22;
  const middleFolded  = dist2d(hand[12], palmCenter) < 0.14;
  const ringFolded    = dist2d(hand[16], palmCenter) < 0.14;
  const pinkyFolded   = dist2d(hand[20], palmCenter) < 0.14;
  return indexExtended && middleFolded && ringFolded && pinkyFolded;
}
