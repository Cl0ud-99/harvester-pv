import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Planar reflection for the deck at y = planeY
 *
 *  A mirror camera renders only the objects assigned to REFLECT_LAYER
 *  (harvester + station + sky) into a half-res HDR target. The deck
 *  material samples it projectively through textureMatrix. The deck mesh
 *  itself is excluded so the shader never samples its own target.
 * ------------------------------------------------------------------ */
export class PlanarReflection {
  constructor(renderer, scene, camera, opts = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.planeY = opts.y ?? 0;
    this.clipBias = opts.clipBias ?? 0.02;
    this.layer = opts.layer ?? 2;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(size.x * 0.5)),
      Math.max(1, Math.floor(size.y * 0.5)),
      { type: THREE.HalfFloatType },
    );
    this.rt.texture.name = 'deck-reflection';
    this.texture = this.rt.texture;
    this.textureMatrix = new THREE.Matrix4();

    this.virtualCamera = new THREE.PerspectiveCamera();
    this.virtualCamera.layers.set(this.layer);

    this._normal = new THREE.Vector3(0, 1, 0);
    this._planePos = new THREE.Vector3(0, this.planeY, 0);
    this._plane = new THREE.Plane();
    this._q = new THREE.Vector4();
    this._rot = new THREE.Matrix4();
    this._camPos = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._view = new THREE.Vector3();

    this.enabled = opts.enabled !== false;
  }

  addToLayer(objects) {
    for (const o of objects) {
      if (!o) continue;
      o.traverse?.((child) => child.layers.enable(this.layer));
    }
  }

  setSize(w, h) {
    const dpr = this.renderer.getPixelRatio();
    this.rt.setSize(
      Math.max(1, Math.floor(w * dpr * 0.5)),
      Math.max(1, Math.floor(h * dpr * 0.5)),
    );
  }

  render() {
    if (!this.enabled) return;
    const renderer = this.renderer;
    const camera = this.camera;

    // use the un-jittered projection for the mirror camera
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    camera.getWorldPosition(this._camPos);

    this._view.subVectors(this._planePos, this._camPos);
    this._view.reflect(this._normal).negate().add(this._planePos);

    this._rot.extractRotation(camera.matrixWorld);
    this._lookAt.set(0, 0, -1).applyMatrix4(this._rot).add(this._camPos);
    this._target.subVectors(this._planePos, this._lookAt).reflect(this._normal).negate().add(this._planePos);

    const vc = this.virtualCamera;
    vc.position.copy(this._view);
    vc.up.set(0, 1, 0).applyMatrix4(this._rot).reflect(this._normal);
    vc.lookAt(this._target);
    vc.near = camera.near;
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    // world -> reflection texture UV
    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0,
    );
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);

    // oblique near-plane clipping at the deck plane
    this._plane.setFromNormalAndCoplanarPoint(this._normal, this._planePos);
    this._plane.applyMatrix4(vc.matrixWorldInverse);
    const clip = new THREE.Vector4(
      this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant,
    );
    const pm = vc.projectionMatrix;
    this._q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    this._q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    this._q.z = -1.0;
    this._q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(this._q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1.0 - this.clipBias;
    pm.elements[14] = clip.w;

    const current = renderer.getRenderTarget();
    const oldAutoClear = renderer.autoClear;
    const oldShadowAuto = renderer.shadowMap.autoUpdate;
    renderer.autoClear = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(this.scene, vc);
    renderer.shadowMap.autoUpdate = oldShadowAuto;
    renderer.autoClear = oldAutoClear;
    renderer.setRenderTarget(current);
  }

  dispose() {
    this.rt.dispose();
  }
}

export function attachDeckReflection(material, reflection, strength = 0.385) {
  const uniforms = {
    tReflection: { value: reflection.texture },
    uReflectionMatrix: { value: reflection.textureMatrix },
    uReflectionStrength: { value: strength },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'uniform mat4 uReflectionMatrix;\nvarying vec4 vReflectCoord;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vReflectCoord = uReflectionMatrix * modelMatrix * vec4(transformed, 1.0);',
    );
    shader.fragmentShader = 'uniform sampler2D tReflection;\nuniform float uReflectionStrength;\nvarying vec4 vReflectCoord;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      [
        '{',
        '  vec3 refl = texture2DProj(tReflection, vReflectCoord).rgb;',
        '  float ndv = saturate(dot(normal, geometryViewDir));',
        '  float fres = pow(1.0 - ndv, 3.0);',
        '  outgoingLight += refl * uReflectionStrength * (0.22 + 0.78 * fres);',
        '}',
        '#include <opaque_fragment>',
      ].join('\n'),
    );
  };
  material.needsUpdate = true;
  return uniforms;
}
