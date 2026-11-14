import * as THREE from 'three';

export interface RetroPassConfig {
  targetHeight: number;
  vhsEnabled: boolean;
  ditherStrength: number;
  colorLevels: number;
  exposure?: number;
  useHalfFloat?: boolean;
}

/**
 * Renders the 3D scene to a deliberately low-resolution WebGLRenderTarget with NearestFilter
 * and composites it to screen with ACES Filmic tone mapping, linear-to-sRGB conversion,
 * PS1 Bayer dithering, 15-bit color quantization, subtle VHS chroma bleed, analog tape grain,
 * faint scanlines, and moody vignette.
 *
 * Also cuts mobile/tablet fragment shading cost by 15x-30x compared to native resolution.
 */
export class RetroCompositePass {
  public target: THREE.WebGLRenderTarget;
  private quadScene: THREE.Scene;
  private quadCamera: THREE.OrthographicCamera;
  private quadMesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  private internalW = 320;
  private internalH = 180;
  private screenW = 1280;
  private screenH = 720;
  private config: RetroPassConfig;

  constructor(screenW: number, screenH: number, config: RetroPassConfig) {
    this.config = { ...config };
    this.screenW = Math.max(1, screenW);
    this.screenH = Math.max(1, screenH);
    this.computeInternalSize();

    this.target = new THREE.WebGLRenderTarget(this.internalW, this.internalH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: config.useHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.target.texture.generateMipmaps = false;

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.material = new THREE.ShaderMaterial({
      toneMapped: false,
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uTexSize: { value: new THREE.Vector2(this.internalW, this.internalH) },
        uTime: { value: 0 },
        uVhsEnabled: { value: config.vhsEnabled ? 1.0 : 0.0 },
        uDitherStrength: { value: config.ditherStrength },
        uColorLevels: { value: config.colorLevels },
        uExposure: { value: config.exposure ?? 1.25 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uTexSize;
        uniform float uTime;
        uniform float uVhsEnabled;
        uniform float uDitherStrength;
        uniform float uColorLevels;
        uniform float uExposure;
        varying vec2 vUv;

        float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        // Exact Three.js ACES Filmic tone mapping so render-target output matches renderer exposure
        vec3 rrtAndOdtFit(vec3 v) {
          vec3 a = v * (v + 0.0245786) - 0.000090537;
          vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
          return a / b;
        }

        vec3 applyACESFilmic(vec3 color, float exposure) {
          const mat3 ACESInputMat = mat3(
            vec3(0.59719, 0.07600, 0.02840),
            vec3(0.35458, 0.90834, 0.13383),
            vec3(0.04823, 0.01566, 0.83777)
          );
          const mat3 ACESOutputMat = mat3(
            vec3( 1.60475, -0.10208, -0.00327),
            vec3(-0.53108,  1.10813, -0.07276),
            vec3(-0.07367, -0.00605,  1.07602)
          );
          color *= exposure / 0.6;
          color = ACESInputMat * color;
          color = rrtAndOdtFit(color);
          color = ACESOutputMat * color;
          return clamp(color, 0.0, 1.0);
        }

        vec3 linearToSRGBColor(vec3 c) {
          vec3 clamped = max(c, vec3(0.0));
          vec3 low = clamped * 12.92;
          vec3 high = 1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055;
          return mix(low, high, step(vec3(0.0031308), clamped));
        }

        // 4x4 Bayer ordered dithering threshold in [-0.5, 0.5]
        float bayer4x4(vec2 pos) {
          int x = int(mod(pos.x, 4.0));
          int y = int(mod(pos.y, 4.0));
          int idx = x + y * 4;
          float m = 0.0;
          if (idx == 0) m = 0.0;
          else if (idx == 1) m = 8.0;
          else if (idx == 2) m = 2.0;
          else if (idx == 3) m = 10.0;
          else if (idx == 4) m = 12.0;
          else if (idx == 5) m = 4.0;
          else if (idx == 6) m = 14.0;
          else if (idx == 7) m = 6.0;
          else if (idx == 8) m = 3.0;
          else if (idx == 9) m = 11.0;
          else if (idx == 10) m = 1.0;
          else if (idx == 11) m = 9.0;
          else if (idx == 12) m = 15.0;
          else if (idx == 13) m = 7.0;
          else if (idx == 14) m = 13.0;
          else m = 5.0;
          return (m / 16.0) - 0.5;
        }

        void main() {
          vec2 uv = vUv;
          vec2 texel = 1.0 / uTexSize;

          // Snap sampling coordinates to the low-res pixel grid
          vec2 pixelCoord = floor(uv * uTexSize);
          vec2 snappedUv = (pixelCoord + 0.5) * texel;

          vec3 col;
          if (uVhsEnabled > 0.5) {
            // Subtle analog horizontal line jitter & soft chroma smear
            float lineJitter = (hash12(vec2(pixelCoord.y, floor(uTime * 14.0))) - 0.5) * 0.35 * texel.x;
            float trackingBand = smoothstep(0.92, 1.0, sin(uv.y * 5.0 - uTime * 0.65)) * 0.7 * texel.x;
            vec2 sampleUv = snappedUv + vec2(lineJitter + trackingBand, 0.0);

            // Slight horizontal analog blur + R/B convergence bleed
            float r = mix(
              texture2D(tDiffuse, sampleUv + vec2(texel.x * 0.85, 0.0)).r,
              texture2D(tDiffuse, sampleUv).r,
              0.45
            );
            float g = mix(
              texture2D(tDiffuse, sampleUv).g,
              texture2D(tDiffuse, sampleUv - vec2(texel.x * 0.45, 0.0)).g,
              0.25
            );
            float b = mix(
              texture2D(tDiffuse, sampleUv - vec2(texel.x * 0.95, 0.0)).b,
              texture2D(tDiffuse, sampleUv).b,
              0.45
            );
            col = vec3(r, g, b);
          } else {
            col = texture2D(tDiffuse, snappedUv).rgb;
          }

          // Tone map & convert linear scene render target to perceptual sRGB before PS1 quantization
          col = applyACESFilmic(col, uExposure);
          col = linearToSRGBColor(col);

          // Ordered Bayer dithering + PS1 color depth quantization (banding)
          float dither = bayer4x4(pixelCoord) * uDitherStrength;
          col = clamp(col + dither / uColorLevels, 0.0, 1.0);
          col = floor(col * uColorLevels + 0.5) / uColorLevels;

          if (uVhsEnabled > 0.5) {
            // Faint CRT scanline shadow + analog grain
            float scanline = 1.0 - 0.065 * (0.5 + 0.5 * sin(uv.y * uTexSize.y * 3.14159 * 2.0));
            float grain = (hash12(pixelCoord + fract(uTime * 23.17) * 97.0) - 0.5) * 0.044;
            col = col * scanline + grain;
          }

          // Melancholic atmospheric edge vignette (gentle so outer corners stay readable)
          vec2 vigUv = uv * (1.0 - uv.yx);
          float vig = pow(clamp(vigUv.x * vigUv.y * 16.0, 0.0, 1.0), 0.25);
          col *= mix(0.74, 1.0, vig);

          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    this.quadMesh = new THREE.Mesh(geo, this.material);
    this.quadScene.add(this.quadMesh);
  }

  private computeInternalSize(): void {
    const aspect = this.screenW / Math.max(1, this.screenH);
    const h = Math.max(120, Math.round(this.config.targetHeight));
    const w = Math.max(160, Math.round(h * aspect));
    this.internalW = w;
    this.internalH = h;
  }

  public updateConfig(partial: Partial<RetroPassConfig>): void {
    const prevHeight = this.config.targetHeight;
    Object.assign(this.config, partial);
    this.material.uniforms.uVhsEnabled.value = this.config.vhsEnabled ? 1.0 : 0.0;
    this.material.uniforms.uDitherStrength.value = this.config.ditherStrength;
    this.material.uniforms.uColorLevels.value = this.config.colorLevels;

    if (partial.targetHeight !== undefined && partial.targetHeight !== prevHeight) {
      this.resize(this.screenW, this.screenH);
    }
  }

  public resize(screenW: number, screenH: number): void {
    this.screenW = Math.max(1, screenW);
    this.screenH = Math.max(1, screenH);
    this.computeInternalSize();
    this.target.setSize(this.internalW, this.internalH);
    this.material.uniforms.uTexSize.value.set(this.internalW, this.internalH);
  }

  public render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    elapsed: number
  ): void {
    this.material.uniforms.uTime.value = elapsed;

    // 1. Render 3D scene to low-res render target
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, camera);

    // 2. Composite low-res buffer to screen with PS1 dither + VHS pass
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }

  public dispose(): void {
    this.target.dispose();
    this.quadMesh.geometry.dispose();
    this.material.dispose();
  }
}
