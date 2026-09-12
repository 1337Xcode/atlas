uniform sampler2D uPage; uniform sampler2D uWorld; uniform float uMix; uniform float uCell;
varying vec2 vUv;
void main() {
  vec4 page = texture2D(uPage, vUv); vec4 world = texture2D(uWorld, vUv);
  float lum = dot(page.rgb, vec3(0.299, 0.587, 0.114));
  vec2 cell = fract(vUv * uCell) - 0.5; float d = length(cell) * 2.0;
  float threshold = mix(lum, 1.0, uMix);
  float open = step(d, uMix * 1.45) * step(threshold, 0.98 + uMix);
  gl_FragColor = mix(page, world, open * uMix);
}
