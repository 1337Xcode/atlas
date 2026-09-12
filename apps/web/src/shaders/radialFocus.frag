uniform vec2 center; uniform float radius; uniform float softness; uniform float enabled;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (enabled < 0.5) { outputColor = inputColor; return; }
  vec2 d = (uv - center) * vec2(resolution.x / resolution.y, 1.0);
  float m = smoothstep(radius, radius + softness, length(d));
  // perf: six taps are only worth taking where the mask is actually visible
  if (m < 0.004) { outputColor = inputColor; return; }
  vec4 blur = vec4(0.0); float step = 0.0025 * (1.0 + m);
  blur += texture2D(inputBuffer, uv + vec2(step, 0.0)); blur += texture2D(inputBuffer, uv - vec2(step, 0.0));
  blur += texture2D(inputBuffer, uv + vec2(0.0, step)); blur += texture2D(inputBuffer, uv - vec2(0.0, step));
  blur += texture2D(inputBuffer, uv + vec2(step, step)); blur += texture2D(inputBuffer, uv - vec2(step, step));
  outputColor = mix(inputColor, blur / 6.0, m);
}
