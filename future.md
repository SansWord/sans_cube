# Future Work

## On-going

### Stats Trends (spec ready, not yet implemented)
- To implement: `Write an implementation plan based on the spec in docs/superpowers/specs/2026-04-09-stats-trends-design.md`
- To discuss design first: `I want to discuss the design in docs/superpowers/specs/2026-04-09-stats-trends-design.md before implementing it`

## Solving Methods
- ZZ method support

## Hardware
- Support for non-GAN cubes (MoYu, QiYi, etc.)
- Empirical testing for S/E moves
- Use cubeTimestamp instead of wall-clock for phase timing (recognitionMs, executionMs) — wall clock can jitter on BLE events; hardware clock may be more accurate. Needs empirical testing to verify drift characteristics.

## Replay
- M/S/E moves would make replay jummping and not smooth, also happened in some other cases, not sure what's the root cause.

## Mobile
- should I support touch/mouse for middle slice move?

## Statistic
- ~~separate by method~~ — done in v1.4 (method filter in sidebar, stats derive from filtered pool)
- statistic history trends by phases

## Miscs
- localization
- case detection - OLL, PLL, EO, LR+LU, EP
- clean code

## firebase
- **App Check**: Skip for now. Security rules already lock data to authenticated users — App Check adds a second layer but the main risk is ad blockers silently breaking cloud sync. Worth revisiting if there's real abuse risk or many users. Requires debug token setup for local dev.
- disply id or just a list of number? and when loaing from url, should I still display id?