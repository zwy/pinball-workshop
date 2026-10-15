import { useEffect, useRef, useState } from "react";
import { GameEngine } from "../game/engine";
import { sizes } from "../game/sizes";
import type { EngineSkinImageMap, GameSkins, SkinImageMap, SkinTarget } from "../game/skins";
import type { GameConfig } from "../game/types";

type Props = {
  settings: GameConfig;
  seed: string;
  running: boolean;
  skins: GameSkins;
  images: SkinImageMap;
  onDone?: () => void;
};

const imageTargets: SkinTarget[] = ["ball", "goal", "field"];

export function GameStage({ settings, seed, running, skins, images, onDone }: Props) {
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [loadedImages, setLoadedImages] = useState<EngineSkinImageMap>({});
  const initialProps = useRef({ settings, seed, skins });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { settings, seed, skins } = initialProps.current;
    const engine = new GameEngine(canvas, settings, seed, skins);
    engine.onDone = () => doneRef.current?.();
    engineRef.current = engine;

    let frameId = requestAnimationFrame(function loop(time: number) {
      engineRef.current?.tick(time);
      frameId = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(frameId);
      engineRef.current = null;
    };
    // oxlint-disable-next-line react-hooks(exhaustive-deps)
  }, []);

  useEffect(() => {
    engineRef.current?.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    engineRef.current?.setSeed(seed);
  }, [seed]);

  useEffect(() => {
    let cancelled = false;
    const next: EngineSkinImageMap = {};

    void Promise.all(
      imageTargets.map(async (target) => {
        const url = images[target];
        if (!url) return;
        const image = new Image();
        image.decoding = "async";
        image.src = url;
        await image.decode().catch(() => undefined);
        if (!cancelled) next[target] = image;
      }),
    ).then(() => {
      if (!cancelled) setLoadedImages(next);
    });

    return () => {
      cancelled = true;
    };
  }, [images]);

  useEffect(() => {
    engineRef.current?.setSkins(skins, loadedImages);
  }, [skins, loadedImages]);

  useEffect(() => {
    if (running) engineRef.current?.play();
    else engineRef.current?.pause();
  }, [running]);

  const size = sizes[settings.aspectRatio];
  return (
    <section className="game-area">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={size.width}
        height={size.height}
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
      />
    </section>
  );
}
