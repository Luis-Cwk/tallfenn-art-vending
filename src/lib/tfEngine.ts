/**
 * Tall Fenn engine (app port). Shaders are inlined; determinism is preserved:
 * sha256(seedInput + "|v1|tallfenn") decides everything.
 *
 * Looks:
 *  - masas|...      -> standard look (matrix/cut/fly modes)
 *  - masas|premium| -> premium look: orbital sculpture, two lights, double fresnel,
 *                      light veins, travelling bands, dust, luxury palettes
 */
import { byteAt } from './seedHash'

export type Traits = {
  mode: 'seccion' | 'vuelo' | 'campo' | 'orbita'
  count: number
  drift: number
  tempo: number
  cut: number
  style: number
}

export type Score = {
  falls: number
  breath: number
  catchDepth: number
  attractorX: number
  attractorY: number
  swirl: number
}

export type Palette = {
  name: string
  hue: number | null
  objA: number[]
  objB: number[]
  bgDark: number[]
  bgCrystal: number[]
  bgBright: number[]
  inner: number[]
  accent?: number[]
}

export const DETAIL = 64
export const TIME_SCALE = 0.25
export const MODES: Traits['mode'][] = ['seccion', 'vuelo', 'campo']
export const PALETTE_CYCLE = ['auto', 'A', 'B']

export const PALETTES: Record<'A' | 'B', Palette> = {
  A: { name: 'A', hue: null, objA: [0.75, 0.25, 0.95], objB: [0.05, 0.9, 0.55], bgDark: [0.05, 0.02, 0.1], bgCrystal: [0.6, 0.2, 0.95], bgBright: [0.08, 0.95, 0.6], inner: [0.95, 0.72, 0.85] },
  B: { name: 'B', hue: null, objA: [0.2, 0.3, 0.8], objB: [0.9, 0.1, 0.3], bgDark: [0.03, 0.04, 0.12], bgCrystal: [0.25, 0.3, 0.85], bgBright: [0.1, 0.85, 0.4], inner: [0.95, 0.8, 0.75] },
}

// Premium palettes: deep bases with a single hot accent. The lights read stronger.
export const PREMIUM_PALETTES: Palette[] = [
  { name: 'obsidian-gold', hue: null, objA: [0.14, 0.14, 0.15], objB: [0.86, 0.68, 0.28], bgDark: [0.035, 0.035, 0.045], bgCrystal: [0.42, 0.33, 0.1], bgBright: [0.95, 0.82, 0.45], inner: [0.95, 0.89, 0.76], accent: [0.98, 0.86, 0.52] },
  { name: 'oxblood-bone', hue: null, objA: [0.15, 0.06, 0.08], objB: [0.72, 0.36, 0.3], bgDark: [0.055, 0.03, 0.04], bgCrystal: [0.38, 0.1, 0.14], bgBright: [0.9, 0.84, 0.74], inner: [0.93, 0.88, 0.81], accent: [0.94, 0.86, 0.74] },
  { name: 'teal-copper', hue: null, objA: [0.045, 0.2, 0.18], objB: [0.76, 0.45, 0.26], bgDark: [0.02, 0.06, 0.055], bgCrystal: [0.07, 0.29, 0.26], bgBright: [0.86, 0.61, 0.4], inner: [0.95, 0.85, 0.73], accent: [0.9, 0.65, 0.42] },
]

export function applyPremiumPalette(hash: string): Palette {
  return PREMIUM_PALETTES[byteAt(hash, 23) % PREMIUM_PALETTES.length]
}

function hslToRgb(h: number, s: number, l: number): number[] {
  h = (((h % 360) + 360) % 360) / 360
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p2 = 2 * l - q
  const f = (t: number) => {
    t = (t + 1) % 1
    if (t < 1 / 6) return p2 + (q - p2) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p2 + (q - p2) * (2 / 3 - t) * 6
    return p2
  }
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)]
}

export function generatePalette(hash: string): Palette {
  const h0 = (byteAt(hash, 20) / 255) * 360
  const accent = (h0 + 120 + (byteAt(hash, 21) % 120)) % 360
  const warm = (h0 + 20 + (byteAt(hash, 22) % 50)) % 360
  return {
    name: 'auto',
    hue: Math.round(h0),
    objA: hslToRgb(h0, 0.78, 0.55),
    objB: hslToRgb(accent, 0.85, 0.52),
    bgDark: hslToRgb(h0, 0.55, 0.06),
    bgCrystal: hslToRgb((h0 + 30) % 360, 0.6, 0.3),
    bgBright: hslToRgb(accent, 0.9, 0.62),
    inner: hslToRgb(warm, 0.45, 0.72),
  }
}

export function applyPalette(name: string, hash: string): Palette {
  if (name === 'A') return PALETTES.A
  if (name === 'B') return PALETTES.B
  return generatePalette(hash)
}

export function deriveTraits(hash: string, cfg: { mode: string; count: number }): Traits {
  if (cfg.mode === 'orbita') {
    const count = cfg.count > 0 ? cfg.count : 80 + (byteAt(hash, 1) % 60)
    const drift = 0.6 + (byteAt(hash, 4) % 100) / 100
    const tempo = 0.7 + (byteAt(hash, 5) % 70) / 100
    return { mode: 'orbita', count, drift, tempo, cut: 0.45, style: 1 }
  }
  const mode = (cfg.mode !== 'auto' ? cfg.mode : MODES[byteAt(hash, 0) % MODES.length]) as Traits['mode']
  let count: number
  if (cfg.count > 0) count = cfg.count
  else if (mode === 'vuelo') count = 40 + (byteAt(hash, 1) % 50)
  else if (mode === 'campo') count = 60 + (byteAt(hash, 2) % 100)
  else count = 40 + (byteAt(hash, 1) % 60)
  const drift = 0.6 + (byteAt(hash, 4) % 100) / 100
  const tempo = 0.7 + (byteAt(hash, 5) % 70) / 100
  const cut = mode === 'seccion' ? 0.62 : 0
  return { mode, count, drift, tempo, cut, style: mode === 'seccion' ? 1 : 0 }
}

export function deriveScore(hash: string): Score {
  return {
    falls: 1 + (byteAt(hash, 8) % 4),
    breath: ((byteAt(hash, 9) % 100) / 100) * 0.3,
    catchDepth: 0.35 + (byteAt(hash, 11) % 50) / 100,
    attractorX: (byteAt(hash, 12) / 255 - 0.5) * 1.7,
    attractorY: (byteAt(hash, 13) / 255 - 0.5) * 1.7,
    swirl: 0.1 + (byteAt(hash, 14) % 60) / 400,
  }
}

/** Deterministic frame time used for posters, so they stay stable and comparable. */
export function getPosterTime(hash: string): number {
  return 6 + (byteAt(hash, 15) % 14)
}

/** Traits + palette for a hash, honoring the premium look. */
export function resolveLook(hash: string, premium: boolean): { traits: Traits; pal: Palette } {
  const traits = deriveTraits(hash, premium ? { mode: 'orbita', count: 0 } : { mode: 'auto', count: 0 })
  const pal = premium ? applyPremiumPalette(hash) : applyPalette('auto', hash)
  return { traits, pal }
}

export const SPHERE_VERT = `precision mediump float;

attribute vec2 aTexCoord;
attribute vec3 aPosition;
attribute vec3 aNormal;

uniform float uTime;
uniform float uIndex;
uniform float uFreq;
uniform float uCut;
uniform float uPremium;
uniform float uGlow;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec2 vUv;
varying float vFlat;
varying vec3 vLocal;
varying vec3 vNormal;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec3 P) {
  vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod289(Pi0); Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 * (1.0 / 7.0); vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0); vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 * (1.0 / 7.0); vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1); vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x, gy0.x, gz0.x); vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
  vec3 g010 = vec3(gx0.z, gy0.z, gz0.z); vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
  vec3 g001 = vec3(gx1.x, gy1.x, gz1.x); vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
  vec3 g011 = vec3(gx1.z, gy1.z, gz1.z); vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z)); float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz)); float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

void main() {
  vUv = aTexCoord;
  vLocal = aPosition;
  vNormal = aNormal;

  vec3 pos = aPosition;

  float front = step(0.0, aPosition.z);
  vFlat = 0.0;
  if (uCut > 0.5 && front < 0.5) {
    pos.z = 0.0;
    vFlat = 1.0;
  }

  float t = uTime * 0.5;

  if (uPremium > 0.5) {
    float tp = uTime * 0.55;
    float n1 = cnoise(pos * 1.5 + vec3(tp * 0.35, tp * 0.2, tp * 0.15));
    float n2 = cnoise(pos * 3.4 - vec3(tp * 0.22));
    float crest = sin(pos.y * 9.0 + tp * 1.6 + uIndex * 0.9) * 0.5 + 0.5;
    pos += aNormal * (n1 * 0.95 + n2 * 0.4 + crest * 0.22);
    float pulse = sin(tp * (0.8 + uFreq * 0.004) + uIndex * 0.7 + pos.y * 0.06);
    pos += aNormal * pulse * 0.35;
  } else {
    vec3 offset = vec3(
      sin(pos.y * 1.5 + t) * cos(pos.z * 1.2 + t * 0.8),
      cos(pos.x * 1.3 + t * 1.1) * sin(pos.z * 1.5 + t * 0.9),
      sin(pos.x * 1.4 + t * 0.7) * cos(pos.y * 1.1 + t * 1.2)
    ) * 1.2;
    pos += offset;
    float n = cnoise(pos * 2.0 + vec3(t * 0.5));
    pos += aNormal * n * 0.4;
    float pulse = sin(t * (0.9 + uFreq * 0.005) + uIndex * 0.7 + pos.y * 0.05);
    pos += aNormal * pulse * 0.25;
  }

  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(pos, 1.0);
}
`

export const SPHERE_FRAG = `precision mediump float;

uniform float uTime;uniform float uIndex;uniform float uFreq;uniform float uSpeed;
uniform float uIsBackground;uniform float uFade;uniform float uStyle;uniform float uCut;uniform float uPremium;
uniform vec2 uVel;uniform vec3 uObjA;uniform vec3 uObjB;uniform vec3 uBgDark;
uniform vec3 uBgCrystal;uniform vec3 uBgBright;uniform vec3 uInner;uniform vec3 uAccent;

varying vec2 vUv;varying float vFlat;varying vec3 vLocal;varying vec3 vNormal;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}

float cnoise(vec3 P){
  vec3 Pi0=floor(P);vec3 Pi1=Pi0+vec3(1.0);
  Pi0=mod289(Pi0);Pi1=mod289(Pi1);
  vec3 Pf0=fract(P);vec3 Pf1=Pf0-vec3(1.0);
  vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x);vec4 iy=vec4(Pi0.yy,Pi1.yy);
  vec4 iz0=Pi0.zzzz;vec4 iz1=Pi1.zzzz;
  vec4 ixy=permute(permute(ix)+iy);
  vec4 ixy0=permute(ixy+iz0);vec4 ixy1=permute(ixy+iz1);
  vec4 gx0=ixy0*(1.0/7.0);vec4 gy0=fract(floor(gx0)*(1.0/7.0))-0.5;
  gx0=fract(gx0);vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0);
  vec4 sz0=step(gz0,vec4(0.0));
  gx0-=sz0*(step(0.0,gx0)-0.5);gy0-=sz0*(step(0.0,gy0)-0.5);
  vec4 gx1=ixy1*(1.0/7.0);vec4 gy1=fract(floor(gx1)*(1.0/7.0))-0.5;
  gx1=fract(gx1);vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1);
  vec4 sz1=step(gz1,vec4(0.0));
  gx1-=sz1*(step(0.0,gx1)-0.5);gy1-=sz1*(step(0.0,gy1)-0.5);
  vec3 g000=vec3(gx0.x,gy0.x,gz0.x);vec3 g100=vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010=vec3(gx0.z,gy0.z,gz0.z);vec3 g110=vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001=vec3(gx1.x,gy1.x,gz1.x);vec3 g101=vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011=vec3(gx1.z,gy1.z,gz1.z);vec3 g111=vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000*=norm0.x;g010*=norm0.y;g100*=norm0.z;g110*=norm0.w;
  vec4 norm1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001*=norm1.x;g011*=norm1.y;g101*=norm1.z;g111*=norm1.w;
  float n000=dot(g000,Pf0);float n100=dot(g100,vec3(Pf1.x,Pf0.yz));
  float n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z));float n110=dot(g110,vec3(Pf1.xy,Pf0.z));
  float n001=dot(g001,vec3(Pf0.xy,Pf1.z));float n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011=dot(g011,vec3(Pf0.x,Pf1.yz));float n111=dot(g111,Pf1);
  vec3 fade_xyz=fade(Pf0);
  vec4 n_z=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz=mix(n_z.xy,n_z.zw,fade_xyz.y);
  float n_xyz=mix(n_yz.x,n_yz.y,fade_xyz.x);
  return 2.2*n_xyz;
}

void main(){
  vec2 uv=vUv;

  if(uIsBackground>0.5){
    if(uPremium>0.5){
      float tBg=uTime*0.45;
      vec2 p=uv*vec2(2.2,1.3)-vec2(0.6,0.15);
      float flow=cnoise(vec3(p*1.1,tBg*0.12));
      float r=length(uv-0.5);
      float vig=smoothstep(1.0,0.15,r);
      vec3 bg=uBgDark*(0.5+0.9*vig);
      bg+=uBgCrystal*0.35*(0.5+0.5*sin(flow*2.4));
      bg+=uBgBright*0.10*(0.5+0.5*cnoise(vec3(p*0.7,tBg*0.08)));
      float fil=abs(cnoise(vec3(p*3.0+vec2(0.0,flow),tBg*0.25)));
      fil=smoothstep(0.20,0.0,fil);
      bg+=uAccent*fil*0.35;
      float dn=0.5+0.5*cnoise(vec3(p*30.0,tBg*0.6));
      float dust=smoothstep(0.90,1.0,dn);
      bg+=uAccent*dust*1.6;
      bg+=uAccent*smoothstep(0.035,0.0,abs(uv.y-0.17))*0.07;
      bg+=uAccent*smoothstep(0.030,0.0,abs(uv.y-0.83))*0.05;
      gl_FragColor=vec4(bg,1.0);
    } else if(uStyle>0.5){
      float tBg=uTime*0.6;
      vec2 p=uv*vec2(2.6,1.5)-vec2(0.8,0.4);
      float flow=cnoise(vec3(p*1.6,tBg*0.15));
      p+=vec2(flow,-flow)*0.5;
      float staff=smoothstep(0.82,0.99,sin(p.y*24.0+flow*5.0));
      float streakMask=0.5+0.5*cnoise(vec3(p*2.2,tBg*0.25));
      float streak=smoothstep(0.90,1.0,sin(p.x*3.2+flow*2.0-tBg*0.35))*smoothstep(0.35,0.95,streakMask);
      vec3 bg=mix(uBgDark,uBgCrystal*0.55,0.30+0.30*sin(flow*2.2));
      bg+=uBgBright*staff*0.30;bg+=uObjB*streak*0.30;bg*=1.05;
      gl_FragColor=vec4(bg,1.0);
    } else {
      float tBg=uTime*0.9;
      vec2 p=uv*6.0-1.5;
      p.x+=sin(tBg*0.5+p.y*1.5)*0.5;p.y+=cos(tBg*0.4+p.x*1.5)*0.5;
      float c=abs(sin(p.x*p.y*4.0));
      p.x+=sin(tBg*0.3+p.y*2.5)*0.5;p.y+=cos(tBg*0.6+p.x*2.5)*0.5;
      c+=abs(sin(p.x*p.y*2.0));
      c=fract(c*0.8);
      float edge=smoothstep(0.45,0.5,c)-smoothstep(0.5,0.55,c);
      float noise=cnoise(vec3(p*2.0,tBg))*0.5+0.5;
      float fac=smoothstep(0.15,0.85,c*(0.6+0.7*noise));
      vec3 bgColor=mix(uBgDark,uBgCrystal,fac);
      bgColor+=(noise-0.5)*vec3(0.16,0.35,0.28);
      bgColor+=uBgBright*edge*3.2;bgColor*=1.15;
      gl_FragColor=vec4(bgColor,1.0);
    }
  } else {
    if(vFlat>0.5){
      float r=clamp(length(vLocal.xy)*2.2,0.0,1.0);
      float rings=fract(r*7.0-uTime*0.05);
      vec3 inner=mix(uInner,uObjA*0.55,smoothstep(0.35,0.7,rings));
      inner*=0.55+0.45*(1.0-r);inner*=uFade;
      gl_FragColor=vec4(inner,1.0);return;
    }

    if(uPremium>0.5){
      vec3 N=normalize(vNormal);
      vec3 V=vec3(0.0,0.0,1.0);
      float tObj=uTime*uSpeed*0.45;

      float n=cnoise(vec3(uv*2.4,tObj))*0.5+0.5;
      n=smoothstep(0.15,0.9,n);
      vec3 base=mix(uObjA,uObjB,n);

      vec3 L1=normalize(vec3(0.45,0.75,0.55));
      vec3 L2=normalize(vec3(-0.65,-0.25,0.45));
      float d1=max(dot(N,L1),0.0);
      float d2=max(dot(N,L2),0.0);

      vec3 col=base*(0.40+0.95*d1);
      col+=base*0.12;
      col+=uAccent*d2*0.45;

      float f1=pow(1.0-abs(dot(N,L1)),2.0);
      float f2=pow(1.0-abs(dot(N,L2)),3.0);
      col+=uAccent*f1*1.05;
      col+=mix(uObjB,uAccent,0.5)*f2*0.75;

      float vein=abs(cnoise(vec3(uv*6.5,tObj*0.8)));
      vein=smoothstep(0.28,0.0,vein);
      col+=uAccent*vein*0.85;

      float bands=0.5+0.5*sin(N.y*16.0+tObj*1.6+f1*4.0);
      col=mix(col,col*(0.65+0.85*bands),0.30);

      vec3 H1=normalize(L1+V);
      vec3 H2=normalize(L2+V);
      col+=pow(max(dot(N,H1),0.0),64.0)*uAccent*1.0;
      col+=pow(max(dot(N,H2),0.0),32.0)*uObjB*0.4;

      float iri=0.5+0.5*sin(tObj*1.8+N.y*7.0+f1*3.0);
      col=mix(col,col*vec3(1.10,0.96,1.18),iri*0.7);

      col*=uFade;
      col=clamp(col,0.0,1.0);
      gl_FragColor=vec4(col,1.0);
    } else if(uStyle>0.5){
      float tObj=uTime*uSpeed*0.5;
      float n=cnoise(vec3(uv*3.0,tObj))*0.5+0.5;
      n=smoothstep(0.15,0.85,n);
      vec3 color=mix(uObjA,uObjB,n);
      vec2 dir=normalize(uVel+vec2(0.001));
      float s=0.5+0.5*sin(dot(uv-0.5,dir)*(8.0+uFreq*0.5)+tObj*1.5);
      color=mix(color*0.75,color*1.35,s);
      color+=uBgBright*smoothstep(0.85,1.0,s)*0.25;
      color*=uFade;color=clamp(color,0.0,1.0);
      gl_FragColor=vec4(color,1.0);
    } else {
      float tObj=uTime*uSpeed*0.5;
      float n=cnoise(vec3(uv*4.0,tObj))*0.5+0.5;
      n=smoothstep(0.1,0.8,n);
      vec3 color=mix(uObjA,uObjB,n);
      float wave=sin(uv.x*uFreq)*cos(uv.y*uFreq+tObj);
      float smoothWave=smoothstep(0.4,0.6,wave);
      color+=smoothWave*vec3(0.18,0.45,0.3);
      float luma=dot(color,vec3(0.299,0.587,0.114));
      color=mix(vec3(luma),color,1.4);color*=1.1;color*=uFade;
      color=clamp(color,0.0,1.0);
      gl_FragColor=vec4(color,1.0);
    }
  }
}
`
