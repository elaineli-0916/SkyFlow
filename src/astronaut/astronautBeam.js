// Eye-space cone / sphere intersection. Astronaut mode stays in orbit, so
// a sphere is a stable approximation of the ellipsoid at this viewing scale.
// Both the surface pool and the subtle visible cone share the same 3D axis.
export const astronautBeamShader = `
uniform sampler2D colorTexture;
uniform vec3 earthCenter;
uniform vec3 sunDirection;
uniform sampler2D nightTexture;
uniform vec2 beamAim;
uniform float beamPower;
in vec2 v_textureCoordinates;
float surfaceDistance(vec3 ray) {
  float b = dot(-earthCenter, ray);
  float c = dot(earthCenter, earthCenter) - 1.0;
  float h = b*b-c;
  if(h<0.0) return -1.0;
  float t = -b-sqrt(h);
  return t>0.0 ? t : -1.0;
}
vec3 eyeRay(vec2 uv) {
  return normalize((czm_inverseProjection*vec4(uv*2.0-1.0,-1.0,1.0)).xyz);
}
void main() {
  vec4 color=texture(colorTexture,v_textureCoordinates);
  vec3 ray=eyeRay(v_textureCoordinates), aim=eyeRay(beamAim);
  float distanceToSurface=surfaceDistance(ray);
  float aimDistance=surfaceDistance(aim);
  vec3 source=vec3(.52,-.42,-.12);
  vec3 axis=normalize(aim*(aimDistance>0.0?aimDistance:length(earthCenter))-source);
  float pool=0.0;
  if(distanceToSurface>0.0) {
    vec3 hit=ray*distanceToSurface;
    vec3 lightRay=normalize(hit-source);
    float cone=smoothstep(.966,.996,dot(lightRay,axis));
    vec3 normal=normalize(hit-earthCenter);
    float daylight=smoothstep(-.12,.55,dot(normal,normalize(sunDirection)));
    vec3 worldNormal=mat3(czm_inverseView)*normal;
    vec2 earthUV=vec2(atan(worldNormal.y,worldNormal.x)/czm_twoPi+.5,asin(clamp(worldNormal.z,-1.0,1.0))/czm_pi+.5);
    vec3 cityLights=texture(nightTexture,earthUV).rgb;
    color.rgb=color.rgb*mix(.12,1.08,daylight)+cityLights*(1.0-daylight)*.7;
    float incidence=max(0.0,dot(normal,-lightRay));
    pool=cone*(.18+.82*incidence);
  }
  float end=distanceToSurface>0.0?distanceToSurface:length(earthCenter)+1.5;
  float mist=0.0;
  for(int i=0;i<16;i++) {
    float t=end*(float(i)+.5)/16.0;
    vec3 p=ray*t-source;
    float axial=dot(p,axis);
    float cone=smoothstep(.975,.998,dot(normalize(p),axis));
    mist+=cone*exp(-t*.48)*step(.04,axial)*.007;
  }
  vec3 light=vec3(.74,.85,1.0)*(pool*.42+mist)*beamPower;
  out_FragColor=vec4(color.rgb+light*(vec3(1.0)-color.rgb*.65),color.a);
}`;
