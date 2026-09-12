uniform sampler2D uMap; uniform vec4 uBox; uniform float uStrength; uniform float uDesat; uniform vec4 uMarks[8]; uniform int uMarkCount; uniform float uProvenance;
varying vec2 vUv;
float inBox(vec2 uv, vec4 b, float soft) { vec2 d = max(b.xy - uv, uv - (b.xy + b.zw)); float dist = max(d.x, d.y); return 1.0 - smoothstep(0.0, soft, dist); }
void main() {
  vec4 c = texture2D(uMap, vUv);
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float word = inBox(vUv, uBox, 0.004) * uStrength;
  vec3 desat = mix(c.rgb, vec3(lum), uDesat * (1.0 - word)) * (1.0 - 0.12 * uDesat * (1.0 - word));
  vec3 warm = mix(desat, desat * vec3(1.0, 0.78, 0.5), word * 0.55);
  float rule = 0.0;
  for (int i = 0; i < 8; i++) { if (i >= uMarkCount) break; vec4 m = uMarks[i]; float edge = step(abs(vUv.x - (m.x + m.z)), 0.0008) * step(m.y, vUv.y) * step(vUv.y, m.y + m.w); rule = max(rule, edge); }
  gl_FragColor = vec4(mix(warm, vec3(0.92, 0.9, 0.86), rule * 0.8), c.a);
}
