export const shaderConstants = `
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
`;

export const shapeUniforms = `
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform vec4 u_colorFront;
uniform vec4 u_colorBack;
uniform float u_shape; // 1=sphere, 2=swirl, 3=ripple
uniform float u_scale;
`;

// Shape functions - all shapes expect normalized UV coordinates centered at origin
export const shapeFunctions = `
// Sphere - 3D lit sphere with rotating light source
float sphereShape(vec2 uv, float time) {
  uv *= 2.0;
  float d = 1.0 - pow(length(uv), 2.0);
  vec3 pos = vec3(uv, sqrt(max(0.0, d)));
  vec3 lightPos = normalize(vec3(cos(3.0 * time), 0.8, sin(2.5 * time)));
  float shape = 0.5 + 0.5 * dot(lightPos, pos);
  return shape * step(0.0, d);
}

// Swirl - spiral vortex pattern
float swirlShape(vec2 uv, float time) {
  float l = length(uv);
  float angle = 6.0 * atan(uv.y, uv.x) + 8.0 * time;
  float twist = 1.2;
  float offset = 1.0 / pow(max(l, 1e-6), twist) + angle / TWO_PI;
  float mid = smoothstep(0.0, 1.0, pow(l, twist));
  return mix(0.0, fract(offset), mid);
}

// Ripple - concentric expanding waves
float rippleShape(vec2 uv, float time) {
  float dist = length(uv);
  float waves = sin(pow(dist, 1.7) * 7.0 - 6.0 * time) * 0.5 + 0.5;
  return waves;
}

// Get shape value based on u_shape uniform
float getShape(vec2 uv, float time) {
  if (u_shape < 1.5) {
    return sphereShape(uv, time);
  } else if (u_shape < 2.5) {
    return swirlShape(uv, time);
  } else {
    return rippleShape(uv, time);
  }
}
`;

function createTransparentRgba(): [number, number, number, number] {
  return [0, 0, 0, 0];
}

function parseHexColor(color: string): [number, number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color.trim());
  if (!result) {
    return null;
  }

  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
    1.0,
  ];
}

function parseRgbColor(color: string): [number, number, number, number] | null {
  const rgbResult =
    /^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(
      color.trim()
    );

  if (!rgbResult) {
    return null;
  }

  return [
    Math.min(255, Math.max(0, Number(rgbResult[1]))) / 255,
    Math.min(255, Math.max(0, Number(rgbResult[2]))) / 255,
    Math.min(255, Math.max(0, Number(rgbResult[3]))) / 255,
    rgbResult[4] ? Math.min(1, Math.max(0, Number(rgbResult[4]))) : 1.0,
  ];
}

function resolveBrowserColor(color: string): string | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const probe = document.createElement("span");
  probe.style.color = color;

  // If the browser rejected the color value, style.color will be empty
  if (!probe.style.color) {
    return null;
  }

  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";

  document.body.appendChild(probe);
  const resolvedColor = window.getComputedStyle(probe).color;
  probe.remove();

  return resolvedColor || null;
}

// Helper to convert CSS color values to RGBA array
export function hexToRgba(color: string): [number, number, number, number] {
  const normalizedColor = color.trim();

  if (!normalizedColor || normalizedColor === "transparent") {
    return createTransparentRgba();
  }

  const fromHex = parseHexColor(normalizedColor);
  if (fromHex) {
    return fromHex;
  }

  const fromRgb = parseRgbColor(normalizedColor);
  if (fromRgb) {
    return fromRgb;
  }

  const resolvedColor = resolveBrowserColor(normalizedColor);
  if (resolvedColor) {
    const resolvedFromHex = parseHexColor(resolvedColor);
    if (resolvedFromHex) {
      return resolvedFromHex;
    }

    const resolvedFromRgb = parseRgbColor(resolvedColor);
    if (resolvedFromRgb) {
      return resolvedFromRgb;
    }
  }

  return createTransparentRgba();
}
