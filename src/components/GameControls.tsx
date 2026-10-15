import { sizeList } from "../game/sizes";
import type { AspectRatio, GameConfig, GoalSide } from "../game/types";

type Props = {
  settings: GameConfig;
  onChange: (value: GameConfig) => void;
  onSpeedChange: (speed: number) => void;
};

export function GameControls({ settings, onChange, onSpeedChange }: Props) {
  return (
    <aside className="panel">
      <section className="panel-block">
        <h2>下一局设置</h2>
        <p className="hint">这些设置在下一局生效，当前局保持不变。</p>
        <div className="ratio-grid">
          {sizeList.map((ratio: AspectRatio) => (
            <button
              type="button"
              key={ratio}
              onClick={() => onChange({ ...settings, aspectRatio: ratio })}
              className={`option${settings.aspectRatio === ratio ? " selected" : ""}`}
            >
              {ratio}
            </button>
          ))}
        </div>
        <Field label="球径" unit="px" value={settings.ballDiameter} min={18} max={80} onChange={(ballDiameter) => onChange({ ...settings, ballDiameter })} />
        <Field
          label="门宽"
          unit="px"
          value={settings.goalWidth}
          min={settings.ballDiameter}
          max={480}
          onChange={(goalWidth) => onChange({ ...settings, goalWidth: Math.max(goalWidth, settings.ballDiameter) })}
        />
        <Field label="钉子数量" unit="个" value={settings.pinCount} min={0} max={12} onChange={(pinCount) => onChange({ ...settings, pinCount })} />
        <Field label="钉子直径" unit="px" value={settings.pinDiameter} min={18} max={60} onChange={(pinDiameter) => onChange({ ...settings, pinDiameter })} />
        <div className="pill-row">
          <button
            type="button"
            className={`option${settings.goalMode === "random" ? " selected" : ""}`}
            onClick={() => onChange({ ...settings, goalMode: "random" })}
          >
            门随机
          </button>
          <button
            type="button"
            className={`option${settings.goalMode === "manual" ? " selected" : ""}`}
            onClick={() => onChange({ ...settings, goalMode: "manual" })}
          >
            门指定
          </button>
        </div>
        {settings.goalMode === "manual" && (
          <div className="ratio-grid">
            {(["top", "bottom", "left", "right"] as GoalSide[]).map((goalSide) => (
              <button
                type="button"
                key={goalSide}
                onClick={() => onChange({ ...settings, goalSide })}
                className={`option${settings.goalSide === goalSide ? " selected" : ""}`}
              >
                {goalSide === "top" ? "上" : goalSide === "bottom" ? "下" : goalSide === "left" ? "左" : "右"}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel-block">
        <h2>自动录制</h2>
        <p className="hint">开启后，新一局自动开录；进球后停留一段时间再自动结束录制。</p>
        <div className="pill-row">
          <button
            type="button"
            className={`option${!settings.autoRecord ? " selected" : ""}`}
            onClick={() => onChange({ ...settings, autoRecord: false })}
          >
            不自动录制
          </button>
          <button
            type="button"
            className={`option${settings.autoRecord ? " selected" : ""}`}
            onClick={() => onChange({ ...settings, autoRecord: true })}
          >
            自动录制
          </button>
        </div>
        <Field
          label="结算停留"
          unit="秒"
          value={settings.recordHoldSeconds}
          min={1}
          max={10}
          disabled={!settings.autoRecord}
          onChange={(recordHoldSeconds) => onChange({ ...settings, recordHoldSeconds })}
        />
      </section>

      <section className="panel-block">
        <h2>当前局调整</h2>
        <Field label="球速" unit="px/s" value={settings.speed} min={180} max={900} onChange={onSpeedChange} />
        <p className="hint">球速立即应用，方向不变。</p>
      </section>
    </aside>
  );
}

function Field({
  label,
  unit,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-row">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="field-value">
          {value}
          {unit}
        </span>
      </span>
    </label>
  );
}
