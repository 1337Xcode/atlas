uniform float t;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 warm = inputColor.rgb * vec3(1.0, 0.86, 0.68);
  outputColor = vec4(mix(inputColor.rgb, warm, t * 0.55), inputColor.a);
}
