# Future Work

## On-going, Next
- Hardware Clock

## Solving Methods
- ZZ method support

## Hardware Clocking
- when connect hardware, getting its time and identifiy the difference with wall-clock time. after that, use timestamp from hardware with adjusted difference as clock time. trust time on event instead of Date.now() to calculate overall solving time.
- Use cubeTimestamp instead of wall-clock for phase timing (recognitionMs, executionMs) — wall clock can jitter on BLE events; hardware clock may be more accurate. Needs empirical testing to verify drift characteristics.

## Hardware
- Support for non-GAN cubes (MoYu, QiYi, etc.)
- Empirical testing for S/E moves

## Replay
- M/S/E moves would make replay jummping and not smooth, also happened in some other cases, not sure what's the root cause.

## Mobile
- should I support touch/mouse for middle slice move?

## Statistic
- ~~separate by method~~ — done in v1.4 (method filter in sidebar, stats derive from filtered pool)
- ~~statistic history trends by phases~~ — done in v1.5 (TrendsModal with Total + Phases tabs)
- ~~for time type toggle - add a toggle to show exec + recog~~ — done in v1.5 (Total/Exec/Recog independently toggleable)
- ~~for phases - allow to hide/show each phases~~ — done in v1.5 (click legend label to hide/show)
- ~~range selection: choose a range and show only that range, with a reset-button~~ — done in v1.5 (drag-to-zoom with multi-level stack, ← Back, Reset zoom)


## Miscs
- localization
- case detection - OLL, PLL, EO, LR+LU, EP
- clean code
- scramble optimization: for example, if we have UD pattern, it should be able to turn D and then U.

## firebase
- **App Check**: Skip for now. Security rules already lock data to authenticated users — App Check adds a second layer but the main risk is ad blockers silently breaking cloud sync. Worth revisiting if there's real abuse risk or many users. Requires debug token setup for local dev.
- disply id or just a list of number? and when loaing from url, should I still display id?