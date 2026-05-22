import { useMemo, useState } from "react";
import { buildLookUpState } from "../services/lookUpService.js";

export function useLookUpMode(snapshot, now) {
  const [enabled, setEnabled] = useState(false);
  const [focus, setFocus] = useState(null);
  const [sequence, setSequence] = useState(0);

  const sky = useMemo(() => buildLookUpState(snapshot, now), [snapshot, now]);

  function open(nextFocus = null) {
    setEnabled(true);
    setFocus(nextFocus);
    setSequence((value) => value + 1);
  }

  function toggle() {
    if (enabled) {
      setEnabled(false);
      setFocus(null);
    } else {
      open();
    }
  }

  return {
    enabled,
    focus,
    sequence,
    sky,
    open,
    toggle,
    setFocus
  };
}
