# Time Model

This app tracks several distinct time measurements per solve. Understanding them is important when working on stats, replay, or phase detection.

## Time types

| Field | Location | What it measures |
|---|---|---|
| `timeMs` | `SolveRecord` | Total solve duration — wall clock from first move to solve completion |
| `phase.executionMs` | `PhaseRecord` | Time spent turning — from the first move of a phase to phase completion |
| `phase.recognitionMs` | `PhaseRecord` | Time spent looking / thinking — from the end of the previous phase to the first move of this phase |
| `cubeTimestamp` | `Move` | Hardware clock from the GAN cube, used for replay. More accurate for inter-move intervals than wall clock but drifts over long periods. |

## Relationship between times

```
timeMs ≈ sum of (recognitionMs + executionMs) across all phases
```

For a CFOP solve:

```
Cross recog + Cross exec
+ F2L-1 recog + F2L-1 exec
+ F2L-2 recog + F2L-2 exec
+ F2L-3 recog + F2L-3 exec
+ F2L-4 recog + F2L-4 exec
+ OLL recog   + OLL exec
+ PLL recog   + PLL exec
= timeMs (approximately)
```

The approximation holds because `timeMs` is wall-clock start-to-finish. Minor differences can arise from timer start/stop rounding.

## Why this matters for analysis

- **`timeMs`** — the number that counts for speedcubing rankings and PBs
- **`executionMs`** — how fast your fingers move; affected by TPS and move efficiency
- **`recognitionMs`** — how fast your brain works; affected by look-ahead, pattern recognition, and familiarity with cases

A decreasing `sum(recognitionMs)` trend means look-ahead is improving even if `timeMs` hasn't dropped yet — a useful leading indicator.

## cubeTimestamp vs wall clock

The GAN cube reports a `cubeTimestamp` with each move event. This is used for replay (animating moves at the right pace) rather than timing phases, because:

- Wall clock can jitter slightly between BLE events
- `cubeTimestamp` reflects the actual physical intervals between moves as the cube recorded them

Phase timing (`recognitionMs`, `executionMs`) uses wall clock, not `cubeTimestamp`, because phases are bounded by solve state transitions (facelets), not individual moves.
