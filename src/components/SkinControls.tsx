import { useRef } from "react";
import {
  ballSkinOptions,
  fieldSkinOptions,
  goalSkinOptions,
  type BallSkinId,
  type FieldSkinId,
  type GameSkins,
  type GoalSkinId,
  type SkinTarget,
} from "../game/skins";

const defaultBallSkin: BallSkinId = "orange";
const defaultGoalSkin: GoalSkinId = "classic";
const defaultFieldSkin: FieldSkinId = "studio";

type Props = {
  skins: GameSkins;
  images: Partial<Record<SkinTarget, string>>;
  onSkinsChange: (value: GameSkins) => void;
  onImageChange: (target: SkinTarget, blob: File | Blob | null) => void;
};

export function SkinControls({ skins, images, onSkinsChange, onImageChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const targetRef = useRef<SkinTarget | null>(null);

  const pickImage = (target: SkinTarget) => {
    if (!fileInputRef.current) return;
    targetRef.current = target;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const clearImage = (target: SkinTarget) => {
    onImageChange(target, null);
    if (target === "ball") onSkinsChange({ ...skins, ball: defaultBallSkin });
    if (target === "goal") onSkinsChange({ ...skins, goal: defaultGoalSkin });
    if (target === "field") onSkinsChange({ ...skins, field: defaultFieldSkin });
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = targetRef.current;
    const file = event.target.files?.[0];
    if (!target || !file) return;

    if (target === "ball") onSkinsChange({ ...skins, ball: "custom" });
    if (target === "goal") onSkinsChange({ ...skins, goal: "custom" });
    if (target === "field") onSkinsChange({ ...skins, field: "custom" });
    onImageChange(target, file);
  };

  return (
    <aside className="panel">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden-file-input"
        onChange={handleFile}
      />

      <section className="panel-block">
        <h2>球皮肤</h2>
        <div className="option-grid">
          {ballSkinOptions.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`option${skins.ball === item.id ? " selected" : ""}`}
              onClick={() => onSkinsChange({ ...skins, ball: item.id as BallSkinId })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="ghost" onClick={() => pickImage("ball")}>
          {images.ball ? "更换球图片" : "上传球图片"}
        </button>
        {images.ball && (
          <button type="button" className="ghost danger" onClick={() => clearImage("ball")}>
            移除球图片
          </button>
        )}
        <p className="hint">上传后会按圆形显示。</p>
      </section>

      <section className="panel-block">
        <h2>门皮肤</h2>
        <div className="option-grid">
          {goalSkinOptions.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`option${skins.goal === item.id ? " selected" : ""}`}
              onClick={() => onSkinsChange({ ...skins, goal: item.id as GoalSkinId })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="ghost" onClick={() => pickImage("goal")}>
          {images.goal ? "更换门图片" : "上传门图片"}
        </button>
        {images.goal && (
          <button type="button" className="ghost danger" onClick={() => clearImage("goal")}>
            移除门图片
          </button>
        )}
        <p className="hint">上传后会贴在门口。</p>
      </section>

      <section className="panel-block">
        <h2>球场皮肤</h2>
        <div className="option-grid">
          {fieldSkinOptions.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`option${skins.field === item.id ? " selected" : ""}`}
              onClick={() => onSkinsChange({ ...skins, field: item.id as FieldSkinId })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="ghost" onClick={() => pickImage("field")}>
          {images.field ? "更换球场图片" : "上传球场图片"}
        </button>
        {images.field && (
          <button type="button" className="ghost danger" onClick={() => clearImage("field")}>
            移除球场图片
          </button>
        )}
        {skins.field === "custom" && (
          <label className="field">
            <span className="field-label">图片压暗</span>
            <span className="field-row">
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={skins.fieldImageOpacity}
                onChange={(event) =>
                  onSkinsChange({
                    ...skins,
                    fieldImageOpacity: Number(event.target.value),
                  })
                }
              />
              <span className="field-value">{skins.fieldImageOpacity}%</span>
            </span>
          </label>
        )}
      </section>
    </aside>
  );
}
