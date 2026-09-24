// Everything the Vesper battle miniature (src/presentation/vesper-model.js) uses
// from three.js, exposed as the global EmberVesperThree. Rebuild with
// `npm run vendor:vesper`; ordinary builds never need npm or a CDN.
export * from "three";
export { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
