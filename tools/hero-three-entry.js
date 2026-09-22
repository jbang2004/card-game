// Deliberately expose only the new hero miniature's dependencies. This bundle
// is checked in so ordinary builds never require npm or an external CDN.
export {
  WebGLRenderer,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  Scene,
  Group,
  Box3,
  Vector3,
  HemisphereLight,
  DirectionalLight,
  OrthographicCamera,
  AnimationMixer,
  LoopOnce,
} from "three";
export { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
export { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
export { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
