import { useEffect, useRef, useState } from "react";
import { GameControls } from "./components/GameControls";
import { GameStage } from "./components/GameStage";
import { SkinControls } from "./components/SkinControls";
import { randomSeed } from "./game/rng";
import { defaultSkins, type GameSkins, type SkinImageMap, type SkinTarget } from "./game/skins";
import { loadSettings, loadSkins, readSkinImage, saveSettings, saveSkins, writeSkinImage } from "./game/storage";
import type { GameConfig } from "./game/types";

const initialConfig: GameConfig = {
  aspectRatio: "16:9",
  speed: 420,
  ballDiameter: 36,
  goalWidth: 150,
  goalMode: "random",
  goalSide: "bottom",
  pinCount: 5,
  pinDiameter: 32,
  autoRecord: false,
  recordHoldSeconds: 2,
};

function pickMime() {
  const candidates = [
    "video/mp4;codecs=avc1.640029",
    "video/mp4;codecs=avc1.42E01E",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionFor(mimeType: string) {
  return mimeType.includes("mp4") ? ".mp4" : ".webm";
}

type ActiveRecording = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  fileName: string;
  mimeType: string;
  extension: string;
};

function useCanvasRecorder() {
  const [recording, setRecording] = useState(false);
  const activeRef = useRef<ActiveRecording | null>(null);

  const stop = () => {
    const active = activeRef.current;
    if (!active) return;
    activeRef.current = null;
    setRecording(false);
    active.recorder.stop();
  };

  const start = (fileName: string) => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas.game-canvas");
    if (!canvas) return;
    if (activeRef.current) stop();

    const mimeType = pickMime();
    const extension = extensionFor(mimeType);
    const chunks: Blob[] = [];
    const stream = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 8_000_000,
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}${extension}`;
      link.click();
      URL.revokeObjectURL(url);
      stream.getTracks().forEach((track) => track.stop());
    };

    recorder.start(200);
    activeRef.current = { recorder, stream, chunks, fileName, mimeType: mimeType || "video/webm", extension };
    setRecording(true);
  };

  return { recording, start, stop };
}

function usePersistedSnapshot() {
  const initialSettings = loadSettings(initialConfig);
  const [settings, setSettings] = useState<GameConfig>(initialSettings);
  const [roundConfig, setRoundConfig] = useState<GameConfig>(() => ({ ...initialSettings }));
  const [skins, setSkins] = useState<GameSkins>(() => loadSkins(defaultSkins));
  const [skinImages, setSkinImages] = useState<SkinImageMap>({});
  const [roundDone, setRoundDone] = useState(false);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    void Promise.all(
      (["ball", "goal", "field"] as SkinTarget[]).map(async (target) => {
        const blob = await readSkinImage(target);
        if (!blob || cancelled) return null;
        const url = URL.createObjectURL(blob);
        createdUrls.push(url);
        return [target, url] as const;
      }),
    ).then((values) => {
      if (cancelled) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setSkinImages(
        Object.fromEntries(values.filter((item): item is [SkinTarget, string] => item !== null)),
      );
    });

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveSkins(skins);
  }, [skins]);

  return { settings, roundConfig, setRoundConfig, setSettings, skins, setSkins, skinImages, setSkinImages, roundDone, setRoundDone, stopTimerRef };
}

export default function App() {
  const {
    settings,
    roundConfig,
    setRoundConfig,
    setSettings,
    skins,
    setSkins,
    skinImages,
    setSkinImages,
    roundDone,
    setRoundDone,
    stopTimerRef,
  } = usePersistedSnapshot();

  const [seed, setSeed] = useState(() => randomSeed());
  const [running, setRunning] = useState(!roundDone);
  const recorder = useCanvasRecorder();

  const clearAutoStopTimer = () => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  };

  const startNewRound = () => {
    clearAutoStopTimer();
    const nextSeed = randomSeed();
    if (recorder.recording) recorder.stop();

    setSeed(nextSeed);
    setRoundConfig({ ...settings });
    setRunning(true);
    setRoundDone(false);

    if (settings.autoRecord) {
      setTimeout(() => recorder.start(nextSeed), 120);
    }
  };

  const setLiveSpeed = (value: number) => {
    setSettings((current) => ({ ...current, speed: value }));
    setRoundConfig((current) => ({ ...current, speed: value }));
  };

  const handleDone = () => {
    if (!recorder.recording) {
      setRoundDone(true);
      setRunning(false);
      return;
    }

    if (settings.autoRecord && stopTimerRef.current === null) {
      stopTimerRef.current = window.setTimeout(() => {
        recorder.stop();
        stopTimerRef.current = null;
      }, roundConfig.recordHoldSeconds * 1000);
    } else if (!settings.autoRecord) {
      recorder.stop();
    }

    setRoundDone(true);
    setRunning(false);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="brand">
          <h1>弹球工坊</h1>
          <p>为口播和背景视频准备的一局一局弹球演示</p>
        </div>
        <div className="actions">
          <button type="button" onClick={startNewRound}>
            {settings.autoRecord ? "新一局（录制）" : "新一局"}
          </button>
          {recorder.recording && (
            <button type="button" onClick={() => { clearAutoStopTimer(); recorder.stop(); }}>
              停止录制
            </button>
          )}
          <button type="button" onClick={() => setRunning((value) => !value)}>
            {running ? "暂停" : "继续"}
          </button>
        </div>
      </header>

      <main className="layout">
        <GameStage settings={roundConfig} seed={seed} running={running} skins={skins} images={skinImages} onDone={handleDone} />
        <div className="side">
          <GameControls settings={settings} onChange={setSettings} onSpeedChange={setLiveSpeed} />
          <SkinControls
            skins={skins}
            images={skinImages}
            onSkinsChange={setSkins}
            onImageChange={(target, blob) => {
              void (async () => {
                setSkinImages((current) => {
                  const previous = current[target];
                  if (previous) URL.revokeObjectURL(previous);
                  if (!blob) {
                    const next = { ...current };
                    delete next[target];
                    return next;
                  }
                  return { ...current, [target]: URL.createObjectURL(blob) };
                });
                await writeSkinImage(target, blob ?? undefined);
              })();
            }}
          />
        </div>
      </main>

      <footer className="meta-bar">
        <span>局号 {seed}</span>
        <span>
          {recorder.recording
            ? settings.autoRecord ? "自动录制中" : "录制中"
            : running ? "运行中" : "已暂停"}
        </span>
      </footer>
    </div>
  );
}
