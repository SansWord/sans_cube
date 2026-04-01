// Debug script: shows what each move does starting from a solved cube
// Colors: W=white(U), R=red(R), G=green(F), Y=yellow(D), O=orange(L), B=blue(B)
// Face layout in 54-char string: U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)
// Each face:  0 1 2
//             3 4 5
//             6 7 8

const SOLVED = 'WWWWWWWWWRRRRRRRRRGGGGGGGGGYYYYYYYYYOOOOOOOOOBBBBBBBBB'

function rotateFaceCW(f, s) {
  const [a,b,c,d,e,f2,g,h,i] = [0,1,2,3,4,5,6,7,8].map(j => f[s+j])
  f[s+0]=g; f[s+1]=d; f[s+2]=a
  f[s+3]=h; f[s+4]=e; f[s+5]=b
  f[s+6]=i; f[s+7]=f2; f[s+8]=c
}

function rotateFaceCCW(f, s) {
  const [a,b,c,d,e,f2,g,h,i] = [0,1,2,3,4,5,6,7,8].map(j => f[s+j])
  f[s+0]=c; f[s+1]=f2; f[s+2]=i
  f[s+3]=b; f[s+4]=e; f[s+5]=h
  f[s+6]=a; f[s+7]=d; f[s+8]=g
}

function cycle3CW(f, a0,a1,a2, b0,b1,b2, c0,c1,c2, d0,d1,d2) {
  const [ta,tb,tc] = [f[a0],f[a1],f[a2]]
  f[a0]=f[d0]; f[a1]=f[d1]; f[a2]=f[d2]
  f[d0]=f[c0]; f[d1]=f[c1]; f[d2]=f[c2]
  f[c0]=f[b0]; f[c1]=f[b1]; f[c2]=f[b2]
  f[b0]=ta;    f[b1]=tb;    f[b2]=tc
}

function cycle3CCW(f, a0,a1,a2, b0,b1,b2, c0,c1,c2, d0,d1,d2) {
  const [ta,tb,tc] = [f[a0],f[a1],f[a2]]
  f[a0]=f[b0]; f[a1]=f[b1]; f[a2]=f[b2]
  f[b0]=f[c0]; f[b1]=f[c1]; f[b2]=f[c2]
  f[c0]=f[d0]; f[c1]=f[d1]; f[c2]=f[d2]
  f[d0]=ta;    f[d1]=tb;    f[d2]=tc
}

function applyMove(str, face, dir) {
  const f = [...str]
  const ccw = dir === 'CCW'
  const cycle = ccw ? cycle3CCW : cycle3CW
  switch (face) {
    case 'U':
      if (ccw) rotateFaceCCW(f,0); else rotateFaceCW(f,0)
      cycle(f, 18,19,20, 36,37,38, 45,46,47, 9,10,11)
      break
    case 'D':
      if (ccw) rotateFaceCCW(f,27); else rotateFaceCW(f,27)
      cycle(f, 24,25,26, 15,16,17, 51,52,53, 42,43,44)
      break
    case 'R':
      if (ccw) rotateFaceCCW(f,9); else rotateFaceCW(f,9)
      cycle(f, 2,5,8, 51,48,45, 35,32,29, 20,23,26)
      break
    case 'L':
      if (ccw) rotateFaceCCW(f,36); else rotateFaceCW(f,36)
      cycle(f, 0,3,6, 18,21,24, 27,30,33, 53,50,47)
      break
    case 'F':
      if (ccw) rotateFaceCCW(f,18); else rotateFaceCW(f,18)
      cycle(f, 6,7,8, 11,14,17, 29,28,27, 42,39,36)
      break
    case 'B':
      if (ccw) rotateFaceCCW(f,45); else rotateFaceCW(f,45)
      cycle(f, 0,1,2, 44,41,38, 35,34,33, 9,12,15)
      break
  }
  return f
}

// Print cube net
//        [U]
//  [L] [F] [R] [B]
//        [D]
function printNet(f) {
  const g = (s, i) => f[s+i]
  const U = s => [0,1,2,3,4,5,6,7,8].map(i=>g(0,i))
  const R = s => [0,1,2,3,4,5,6,7,8].map(i=>g(9,i))
  const F = s => [0,1,2,3,4,5,6,7,8].map(i=>g(18,i))
  const D = s => [0,1,2,3,4,5,6,7,8].map(i=>g(27,i))
  const L = s => [0,1,2,3,4,5,6,7,8].map(i=>g(36,i))
  const B = s => [0,1,2,3,4,5,6,7,8].map(i=>g(45,i))
  const u=U(),r=R(),fac=F(),d=D(),l=L(),b=B()
  const pad = '       '
  // U
  console.log(`${pad} ${u[0]}${u[1]}${u[2]}`)
  console.log(`${pad} ${u[3]}${u[4]}${u[5]}`)
  console.log(`${pad} ${u[6]}${u[7]}${u[8]}`)
  // L F R B
  console.log(` ${l[0]}${l[1]}${l[2]}  ${fac[0]}${fac[1]}${fac[2]}  ${r[0]}${r[1]}${r[2]}  ${b[0]}${b[1]}${b[2]}`)
  console.log(` ${l[3]}${l[4]}${l[5]}  ${fac[3]}${fac[4]}${fac[5]}  ${r[3]}${r[4]}${r[5]}  ${b[3]}${b[4]}${b[5]}`)
  console.log(` ${l[6]}${l[7]}${l[8]}  ${fac[6]}${fac[7]}${fac[8]}  ${r[6]}${r[7]}${r[8]}  ${b[6]}${b[7]}${b[8]}`)
  // D
  console.log(`${pad} ${d[0]}${d[1]}${d[2]}`)
  console.log(`${pad} ${d[3]}${d[4]}${d[5]}`)
  console.log(`${pad} ${d[6]}${d[7]}${d[8]}`)
}

const faceNames = { U:'U(white)', R:'R(red)', F:'F(green)', D:'D(yellow)', L:'L(orange)', B:'B(blue)' }

console.log('=== SOLVED STATE ===')
console.log('Net:  [U=top]  [L=left] [F=front] [R=right] [B=back]  [D=bottom]')
console.log('W=white(U) R=red(R) G=green(F) Y=yellow(D) O=orange(L) B=blue(B)\n')
printNet([...SOLVED])

for (const face of ['U','D','R','L','F','B']) {
  const after = applyMove(SOLVED, face, 'CW')
  console.log(`\n========== ${faceNames[face]} CW ==========`)
  printNet(after)
}
