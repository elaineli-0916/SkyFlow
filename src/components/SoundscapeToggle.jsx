import { Volume1, Volume2, VolumeX } from "lucide-react";

function SoundscapeToggle({ enabled, level, onToggle }) {
  const VolumeIcon = !enabled ? VolumeX : level > 0.18 ? Volume2 : Volume1;

  return (
    <button
      className="control-button soundscape-toggle"
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? "Turn Soundscape off" : "Turn Soundscape on"}
      title={enabled ? "Turn Soundscape off" : "Turn Soundscape on"}
      onClick={onToggle}
    >
      <VolumeIcon size={16} />
      <span>soundscape {enabled ? "on" : "off"}</span>
      <span className="sound-meter" aria-hidden="true">
        <span style={{ transform: `scaleX(${enabled ? Math.max(level, 0.08) : 0})` }} />
      </span>
    </button>
  );
}

export default SoundscapeToggle;
