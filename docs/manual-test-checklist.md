# Manual Test Checklist

## Scramble Tracker — Wrong Mode (same face net turns)

- [ ] Turn a wrong face (e.g. U when expecting R) → hint shows U'
- [ ] Turn U again → hint changes to U2
- [ ] Turn U again → hint changes to U
- [ ] Turn U again → exits wrong mode, back to scrambling

## Scramble Tracker — Wrong Mode (direction mixing)

- [ ] Turn U (wrong) → hint U'. Turn U' → exits wrong mode (net=0)
- [ ] Turn U → U2 → back to U' → exits: U, U, U', U' sequence → exits wrong mode

## Scramble Tracker — Wrong Mode (multiple faces)

- [ ] Turn U then R → hint shows R' U' (reverse order)
- [ ] From above, turn R' → hint shows only U'. Turn U' → exits wrong mode
- [ ] Turn U, R, F → hint shows F' R' U'. Cancel one by one back to scrambling

## Scramble Tracker — Wrong Mode to Warning

- [ ] Expecting R: turn R' (enters warning). Turn U → wrong mode. Turn U' → back to **warning** (not scrambling)
- [ ] From above, accumulate U×4 in wrong mode → exits wrong mode back to **warning**

## Scramble Tracker — Normal Flow

- [ ] Complete a CW step correctly → step turns green, advances to next
- [ ] Complete a CCW step correctly (e.g. U')
- [ ] Complete a double step (U2): first turn → warning color; second same-direction turn → done
- [ ] Complete all steps in sequence → armed state (timer starts on next move)

## Scramble Tracker — Warning Mode (wrong direction on correct face)

- [ ] Expecting R: turn R' → warning. Turn R → cancels back to scrambling (net=0)
- [ ] Expecting R: turn R' three times → fulfills step (3× CCW ≡ +1 mod 4)
- [ ] Expecting U2: turn U → warning. Turn U again → done (net=2)
- [ ] Expecting U2: turn U → warning. Turn U' → back to scrambling (net=0)
