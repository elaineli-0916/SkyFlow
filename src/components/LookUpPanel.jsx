import { Cloud, Moon, Sparkles, SunMedium } from "lucide-react";
import { formatDegrees } from "../utils/format.js";

function LookUpPanel({ active, sky, focus }) {
  if (!active) return null;

  return (
    <section className="look-up-panel" aria-live="polite">
      <div className="look-up-kicker">
        <Sparkles size={13} />
        <span>Look Up Mode</span>
        <strong>{sky.localTime}</strong>
      </div>

      <p className="look-up-narration">{sky.narration}</p>

      <div className="look-up-list">
        <SkyLine
          active={focus === "moon"}
          icon={<Moon size={15} />}
          label="moon"
          value={`${sky.moonDirection} / ${sky.moonAltitudeText}`}
          detail={formatDegrees(sky.moonAltitude)}
        />
        <SkyLine
          active={focus === "sun"}
          icon={<SunMedium size={15} />}
          label="sun"
          value={sky.sunAltitudeText}
          detail={formatDegrees(sky.sunAltitude)}
        />
        <SkyLine
          active={focus === "sky"}
          icon={<Cloud size={15} />}
          label="cloud field"
          value={sky.cloudCover == null ? "estimating" : `${Math.round(sky.cloudCover)}% cover`}
          detail={sky.moonPhase}
        />
      </div>
    </section>
  );
}

function SkyLine({ active, icon, label, value, detail }) {
  return (
    <div className={`sky-line${active ? " active" : ""}`}>
      <div className="sky-line-label">
        {icon}
        <span>{label}</span>
      </div>
      <p>{value}</p>
      <small>{detail}</small>
    </div>
  );
}

export default LookUpPanel;
