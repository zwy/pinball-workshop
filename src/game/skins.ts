export type BallSkinId = "orange" | "cyan" | "violet" | "red" | "stripes" | "checker" | "custom";
export type GoalSkinId = "classic" | "football" | "portal" | "target" | "custom";
export type FieldSkinId = "studio" | "solid" | "grid" | "dots" | "stripes" | "custom";
export type SkinTarget = "ball" | "goal" | "field";

export type GameSkins = {
  ball: BallSkinId;
  goal: GoalSkinId;
  field: FieldSkinId;
  fieldImageOpacity: number;
};

export type SkinImageMap = Partial<Record<SkinTarget, string>>;
export type EngineSkinImageMap = Partial<Record<SkinTarget, HTMLImageElement>>;

export const ballSkinOptions: { id: BallSkinId; label: string }[] = [
  { id: "orange", label: "经典" },
  { id: "cyan", label: "纯色" },
  { id: "violet", label: "紫色" },
  { id: "red", label: "亮红" },
  { id: "stripes", label: "条纹" },
  { id: "checker", label: "棋盘" },
  { id: "custom", label: "图片" },
];

export const goalSkinOptions: { id: GoalSkinId; label: string }[] = [
  { id: "classic", label: "荧光" },
  { id: "football", label: "足球门" },
  { id: "portal", label: "传送门" },
  { id: "target", label: "靶门" },
  { id: "custom", label: "图片" },
];

export const fieldSkinOptions: { id: FieldSkinId; label: string }[] = [
  { id: "studio", label: "影棚" },
  { id: "solid", label: "纯色" },
  { id: "grid", label: "网格" },
  { id: "dots", label: "波点" },
  { id: "stripes", label: "条纹" },
  { id: "custom", label: "图片" },
];

export const defaultSkins: GameSkins = {
  ball: "orange",
  goal: "classic",
  field: "studio",
  fieldImageOpacity: 45,
};
