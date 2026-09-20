# Single-hand observer controls

Refines the existing astronaut opening only. Journey, city/photo data, Hong Kong,
mouse head movement, automatic orbit and Earth spin remain unchanged.

- Detect up to two hands, but follow one active palm by spatial continuity. One
  hand is sufficient; array ordering or left/right label changes do not reset it.
- Detection, presence and tracking confidence: 0.5 each. Recognition capped at
  20 Hz; actual throughput depends on the device. CPU inference remains in the
  existing local worker and camera access remains opt-in.
- Horizontal movement does not require a particular hand pose. Smooth the palm
  centre over 45 ms, measure displacement over approximately 120 ms, and map
  mirrored horizontal velocity continuously to the opposite orbit direction.
  Dead zone: 0.03 preview widths/s (plus 0.004 width displacement noise gate).
  Orbit speed: `8 * clamp((abs(v)-0.03)/0.55, 0, 1)` degrees/s.
- Open palm approaches, fist retreats; pose hold shortened to 100 ms. A slightly
  bent finger is accepted, with zoom strength derived from finger extension or
  curl. Lateral movement takes precedence over zoom.
- Gaps shorter than 180 ms decay input rather than discarding the active track.
  Longer gaps stop input and rebaseline before resuming. Camera intent expires
  after 200 ms if no inference result arrives.

## Camera gain

For Earth radius `R`, observer radius `r`, and fixed field of view, projected
sphere size is proportional to `R / sqrt(r²-R²)` when looking at its centre.
Choose logarithmic size gain `k = 0.15/s` at full palm/fist strength, rather than
a fixed travel speed in metres. Integrate each frame as:

`rNext = sqrt(R² + (r²-R²) * exp(-2*k*dt))`

This gives approximately 1.5× projected size in three seconds including pose
confirmation and acceleration. Instantaneous target inward speed is
`k*(r²-R²)/r`: approximately 3,246 km/s at the initial 17,000 km altitude, reducing
as the observer approaches. These are virtual scene distances.

Gesture acceleration uses `1-exp(-9*dt)`, reaching 90% of a fixed target in
approximately 256 ms. Angular speed is capped at 8°/s; existing minimum and
maximum radius constraints remain enforced. Keyboard speed remains unchanged.

## Validation

Math and synthetic-landmark tests cover visual size gain, frame-rate variation,
continuous direction/strength, arbitrary-pose lateral movement, single-hand
selection, label swaps, loss recovery, speed/radius limits and camera cleanup.
Run the existing Journey/city/Hong Kong regressions and the production build.
No screenshots or real-camera visual inspection; the user checks interaction feel.
