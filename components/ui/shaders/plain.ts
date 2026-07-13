import { shaderConstants, shapeUniforms, shapeFunctions } from "./utils";

export const plainFragmentShader = `#version 300 es
precision mediump float;

${shaderConstants}
${shapeUniforms}

out vec4 fragColor;

${shapeFunctions}

// Gaussian-like blur by sampling shape at multiple offsets
float blurredShape(vec2 uv, float time, float blurSize) {
  float sum = 0.0;
  float totalWeight = 0.0;
  
  // 9-tap blur kernel
  for (float x = -1.0; x <= 1.0; x += 1.0) {
    for (float y = -1.0; y <= 1.0; y += 1.0) {
      vec2 offset = vec2(x, y) * blurSize;
      float weight = 1.0 - length(vec2(x, y)) * 0.3;
      sum += getShape(uv + offset, time) * weight;
      totalWeight += weight;
    }
  }
  
  return sum / totalWeight;
}

void main() {
  // Normalize coordinates to [-0.5, 0.5] centered
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  uv /= u_scale;
  
  float time = u_time;
  
  float core = getShape(uv, time);
  float mask = 1.0 - smoothstep(0.7, 1.05, length(uv));
  core *= mask;
  
  // Crisp core with a gentle bloom
  float solid = smoothstep(0.2, 0.85, core);
  float glow = blurredShape(uv, time, 0.018);
  float halo = smoothstep(0.0, 0.6, glow) * 0.35;
  float finalShape = clamp(solid + halo, 0.0, 1.0);
  
  // Subtle lighting for a more polished feel
  float radial = 1.0 - smoothstep(0.2, 1.05, length(uv));
  float highlight =
      pow(max(0.0, 1.0 - length(uv - vec2(-0.25, 0.25))), 3.0);
  float shade = clamp(0.75 + 0.25 * radial + 0.2 * highlight, 0.0, 1.15);
  
  // Mix colors with glow
  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a * finalShape;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;
  
  vec3 color = fgColor * shade * finalShape;
  float opacity = fgOpacity;
  
  color += bgColor * (1.0 - opacity);
  opacity += bgOpacity * (1.0 - opacity);
  
  fragColor = vec4(color, opacity);
}
`;
