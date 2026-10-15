export type AspectRatio = "16:9" | "9:16" | "4:3" | "3:4" | "1:1";

export type GoalSide = "top" | "right" | "bottom" | "left";
export type GoalMode = "random" | "manual";

export type GameConfig = {
  aspectRatio: AspectRatio;
  speed: number;
  ballDiameter: number;
  goalWidth: number;
  goalMode: GoalMode;
  goalSide: GoalSide;
  pinCount: number;
  pinDiameter: number;
  autoRecord: boolean;
  recordHoldSeconds: number;
};

export type Ball = { x: number; y: number; vx: number; vy: number; r: number };
export type Pin = { x: number; y: number; r: number };
export type Goal = { side: GoalSide; width: number; center: number };

export type GameWorld = {
  width: number;
  height: number;
  countdown: number;
  ball: Ball;
  goal: Goal;
  pins: Pin[];
  elapsed: number;
  wallBounces: number;
  pinHits: number;
  done: boolean;
};
