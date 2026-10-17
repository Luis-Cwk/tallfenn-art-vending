/**
 * Typed wrapper around p5's shader object.
 * p5's @types/p5 exposes p5.Shader but doesn't type it as what createShader returns.
 * We define our own interface so we don't need `any`.
 */
export interface P5Shader {
  setUniform(name: string, value: number | number[] | boolean): void
}

/** p5 extended with WEBGL-only methods not in @types/p5 */
export interface P5GL {
  createShader(vert: string, frag: string): P5Shader
  preload?(): void
}
