import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ArcadeController } from '../physics/ArcadeController.js';
import { eventBus } from '../utils/EventBus.js';

/**
 * Kart - Vehicle entity with arcade-style controls
 *
 * Currently supports player control only.
 * TODO: Add proper bot AI system later
 */

export class Kart {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.id = options.id || 'kart-' + Math.random().toString(36).substr(2, 9);
    this.isPlayer = options.isPlayer ?? true;
    this.color = options.color ?? 0xff4444;
    this.mode = options.mode ?? "prototype";
    this.renderMode = options.renderMode ?? 'prototype';
    this.modelVariant = options.modelVariant || 'ferrari'; // ferrari | audi

    // Transform
    this.pos = new THREE.Vector3(0, 0.5, 0);
    this.heading = 0; // radians
    this.speed = 0;

    // Arcade controller (simple Mario Kart style)
    this.controller = new ArcadeController({
      // Using arcade defaults
    });

    // Visual mesh
    if (this.renderMode === 'full') {
      // Start with procedural mesh so we have a visible kart and collider, then swap to glTF when ready
      this.mesh = this._buildFormulaGroup('full');
      this.mesh.position.y += this._getBotYOffset();
      this.scene.add(this.mesh);
      this._useGltfModel();
    } else {
      this.mesh = this._buildFormulaGroup(this.renderMode);
      this.scene.add(this.mesh);
    }

    // Collision box
    this.box = new THREE.Box3();

    // State flags
    this.isDrifting = false;
    this.boostActive = false;
    this._wasDrifting = false;
    this.driftAngle = 0;

    // Visual smoothing
    this.visualDriftAngle = 0; // Smoothed version for rendering
    this.visualLean = 0; // Smoothed lean angle
    this.visualSpeed = 0; // Smoothed speed for debug vector length

    // Debug vectors
    this.debugVectors = this._createDebugVectors();
    this._loadingModel = false;
  }

  _getBotYOffset() {
    if (!this.isPlayer && this.renderMode === 'full') {
      return 0.8;
    }
    return 0;
  }

  /**
   * Create debug visualization arrows
   */
  _createDebugVectors() {
    const vectors = {
      heading: new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0.5, 0),
        5,
        0x00ff00,
        1,
        0.5
      ),
      velocity: new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0.5, 0),
        5,
        0xff0000,
        1,
        0.5
      )
    };

    vectors.heading.visible = false; // Hidden by default
    vectors.velocity.visible = false;

    this.scene.add(vectors.heading);
    this.scene.add(vectors.velocity);

    return vectors;
  }

  /**
   * Toggle debug vectors visibility
   */
  toggleDebugVectors(show) {
    this.debugVectors.heading.visible = show;
    this.debugVectors.velocity.visible = show;
  }

  /**
   * Create the kart 3D mesh (formula-inspired), optionally for prototype/full.
   */
  _buildFormulaGroup(renderMode = 'prototype') {
    const group = new THREE.Group();
    const sf = renderMode === 'full' ? 1.5 : 1.0;

    // Chassis base (slightly larger)
    const baseGeom = new THREE.BoxGeometry(2.6 * sf, 0.65 * sf, 4.8 * sf);
    const baseMat = this._createBodyMaterial(renderMode);
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 0.45;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    this.bodyMesh = base;

    // Nose cone
    const noseGeom = new THREE.CylinderGeometry(0.4 * sf, 0.75 * sf, 1.8 * sf, 16);
    const noseMat = this._createBodyMaterial(renderMode);
    const nose = new THREE.Mesh(noseGeom, noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.6, 2.3);
    nose.castShadow = true;
    group.add(nose);

    // Cockpit/halo
    const cockpitGeom = new THREE.CylinderGeometry(0.4 * sf, 0.6 * sf, 1.4 * sf, 12);
    const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x1b1f2a, metalness: 0.45, roughness: 0.35 });
    const cockpit = new THREE.Mesh(cockpitGeom, cockpitMat);
    cockpit.rotation.x = Math.PI / 2;
    cockpit.position.set(0, 1.05, -0.2);
    cockpit.castShadow = true;
    group.add(cockpit);
    this.coneMesh = cockpit;

    // Front wing
    const fwGeom = new THREE.BoxGeometry(3.8 * sf, 0.18 * sf, 1.0 * sf);
    const fwMat = this._createBodyMaterial(renderMode);
    const frontWing = new THREE.Mesh(fwGeom, fwMat);
    frontWing.position.set(0, 0.25, 3.0);
    frontWing.castShadow = true;
    group.add(frontWing);

    // Rear wing
    const rwGeom = new THREE.BoxGeometry(3.0 * sf, 0.3 * sf, 0.7 * sf);
    const rwMat = this._createBodyMaterial(renderMode);
    const rearWing = new THREE.Mesh(rwGeom, rwMat);
    rearWing.position.set(0, 0.95, -2.5);
    rearWing.castShadow = true;
    group.add(rearWing);

    // Side pods
    const podGeom = new THREE.BoxGeometry(0.7 * sf, 0.5 * sf, 2.0 * sf);
    const podMat = this._createBodyMaterial(renderMode);
    const leftPod = new THREE.Mesh(podGeom, podMat);
    leftPod.position.set(-1.5, 0.55, -0.5);
    leftPod.castShadow = true;
    group.add(leftPod);
    const rightPod = leftPod.clone();
    rightPod.position.x = 1.5;
    group.add(rightPod);

    // Engine cover
    const coverGeom = new THREE.BoxGeometry(1.4 * sf, 0.8 * sf, 2.2 * sf);
    const cover = new THREE.Mesh(coverGeom, this._createBodyMaterial(renderMode));
    cover.position.set(0, 0.9, -1.2);
    cover.castShadow = true;
    group.add(cover);

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.8 * sf, 0.8 * sf, 0.8 * sf, 20);
    const wheelMat = this._createWheelMaterial(renderMode);

    const wheelPositions = [
      [-1.5, 0.35,  1.9],  // Front left
      [ 1.5, 0.35,  1.9],  // Front right
      [-1.5, 0.35, -1.9],  // Rear left
      [ 1.5, 0.35, -1.9],  // Rear right
    ];

    this.wheels = [];

    for (const [x, y, z] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      group.add(wheel);
      this.wheels.push(wheel);
    }

    group.position.copy(this.pos);
    group.position.y += this._getBotYOffset();
    return group;
  }

  /**
   * Give the kart a boost
   */
  giveBoost() {
    this.controller.giveBoost();
    eventBus.emit('boost-activated', { kartId: this.id });
  }

  /**
   * Main update step
   * @param {number} delta - Time step
   * @param {Object} inputs - Input state { throttle, brake, steer, drift }
   */
  step(delta, inputs = {}) {
    // Update arcade controller
    const result = this.controller.update(
      delta,
      this.pos,
      this.heading,
      inputs
    );

    // Update state from controller result
    this.pos = result.position;
    this.heading = result.heading;
    this.speed = result.speed;
    this.isDrifting = result.isDrifting;
    this.boostActive = result.boostActive;
    this.driftCharge = result.driftCharge || 0;
    this.driftAngle = result.driftAngle || 0;
    this.smoothedOutwardPush = result.smoothedOutwardPush || 0;

    // Visual feedback for drifting
    if (this.isDrifting && !this._wasDrifting) {
      eventBus.emit('drift-start', { kartId: this.id });
    } else if (!this.isDrifting && this._wasDrifting) {
      eventBus.emit('drift-end', { kartId: this.id });
    }
    this._wasDrifting = this.isDrifting;

    // Animate front wheels based on steering
    if (this.wheels && this.wheels.length >= 2 && inputs.steer !== undefined) {
      const wheelAngle = -(inputs.steer * 0.4); // Visual steering angle
      this.wheels[0].rotation.y = wheelAngle; // Front left
      this.wheels[1].rotation.y = wheelAngle; // Front right
    }

    // Smooth visual drift angle, lean, and speed
    const lerpSpeed = 6.0; // Adjust for faster/slower transitions
    this.visualDriftAngle = THREE.MathUtils.lerp(
      this.visualDriftAngle,
      this.driftAngle,
      lerpSpeed * delta
    );
    this.visualLean = THREE.MathUtils.lerp(
      this.visualLean,
      this.driftAngle * 0.5,
      lerpSpeed * delta
    );
    this.visualSpeed = THREE.MathUtils.lerp(
      this.visualSpeed,
      this.speed,
      4.0 * delta // Slower lerp for speed (smoother vector length change)
    );

    // Update visual mesh
    this.mesh.position.copy(this.pos);
    this.mesh.position.y += this._getBotYOffset();

    // Apply drift angle for visual effect
    // When drifting right (+), kart angles LEFT (inward)
    // When drifting left (-), kart angles RIGHT (inward)
    const visualHeading = this.heading - this.visualDriftAngle; // Use smoothed angle
    this.mesh.rotation.y = visualHeading;

    // Lean kart while drifting (lean OUTWARD from turn)
    // When drifting right (+), lean right (+Z)
    // When drifting left (-), lean left (-Z)
    this.mesh.rotation.z = this.visualLean; // Use smoothed lean

    // Update debug vectors
    this._updateDebugVectors();

    // Update collision box
    this.box.setFromObject(this.mesh);
  }

  /**
   * Update debug visualization vectors
   */
  _updateDebugVectors() {
    if (!this.debugVectors.heading.visible) return;

    // Heading vector (where kart is pointing)
    const headingDir = new THREE.Vector3(
      Math.sin(this.heading),
      0,
      Math.cos(this.heading)
    );
    this.debugVectors.heading.position.copy(this.pos);
    this.debugVectors.heading.setDirection(headingDir);
    this.debugVectors.heading.setLength(5, 1, 0.5);

    // Velocity vector (where kart is actually moving)
    // Use smoothedOutwardPush from controller for accurate representation
    const moveHeading = this.heading + (this.smoothedOutwardPush || 0);

    const velocityDir = new THREE.Vector3(
      Math.sin(moveHeading),
      0,
      Math.cos(moveHeading)
    );
    this.debugVectors.velocity.position.copy(this.pos);
    this.debugVectors.velocity.setDirection(velocityDir);
    // Use visualSpeed for smoother arrow length transitions
    this.debugVectors.velocity.setLength(this.visualSpeed * 0.2, 1, 0.5);
  }

  /**
   * Reset kart to initial state
   */
  reset(position, heading) {
    this.pos.copy(position);
    this.heading = heading;
    this.controller.reset();
    this.speed = 0;
    this.isDrifting = false;
    this.boostActive = false;
    this._wasDrifting = false;
    this.driftCharge = 0;
    this.driftAngle = 0;
    this.visualDriftAngle = 0;
    this.visualLean = 0;
    this.visualSpeed = 0;

    if (this.mesh) {
      this.mesh.position.copy(this.pos);
      this.mesh.position.y += this._getBotYOffset();
      this.mesh.rotation.y = this.heading;
    }
  }

  /**
   * Remove kart from scene
   */
  destroy() {
    this.scene.remove(this.mesh);
  }

  /**
   * Switch visual mode (prototype/full)
   */
  setRenderMode(mode) {
    if (mode !== 'prototype' && mode !== 'full') return;
    if (this.renderMode === mode) return;
    this.renderMode = mode;
    if (mode === 'full') {
      if (this.mesh) this.scene.remove(this.mesh);
      this.mesh = this._buildFormulaGroup('full');
      this.scene.add(this.mesh);
      this._useGltfModel();
    } else {
      // Switch back to procedural
      if (this.mesh) this.scene.remove(this.mesh);
      this.mesh = this._buildFormulaGroup(mode);
      this.scene.add(this.mesh);
    }
  }

  _createBodyMaterial(mode) {
    if (mode === 'full') {
      const tex = this._makeStripeTexture(this.color);
      return new THREE.MeshStandardMaterial({
        color: this.color,
        map: tex,
        metalness: 0.35,
        roughness: 0.45
      });
    }
    return new THREE.MeshStandardMaterial({
      color: this.color,
      metalness: 0.2,
      roughness: 0.7
    });
  }

  _createWheelMaterial(mode) {
    if (mode === 'full') {
      const tex = this._makeNoiseTexture('#111111', '#222222');
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.1 });
    }
    return new THREE.MeshStandardMaterial({ color: 0x111111 });
  }

  _makeStripeTexture(hexColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const base = '#' + new THREE.Color(hexColor).getHexString();
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = -16; x < 144; x += 24) {
      ctx.fillRect(x, 0, 12, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  }

  _makeNoiseTexture(colorA, colorB) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = colorB;
    for (let i = 0; i < 300; i++) {
      ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }

  /**
   * Load external glTF formula car (from assets) and use it as the mesh.
   */
  _useGltfModel() {
    if (this._loadingModel) return;
    this._loadingModel = true;
    const loader = this.modelVariant === 'audi' ? Kart._loadAudiModel : Kart._loadFerrariModel;
    loader().then((model) => {
      const cloned = model.clone(true);
      this._fitAndAssignModel(cloned);
      this._loadingModel = false;
    }).catch((err) => {
      console.error('Failed to load glTF car, falling back to procedural', err);
      this._loadingModel = false;
      // keep existing mesh (procedural) as fallback
    });
  }

  _fitAndAssignModel(model) {
    // Center and scale to roughly the same footprint as our procedural car
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetLen = 9.75; // large presence for glTF models (full mode)
    const maxDim = Math.max(size.x, size.z);
    const scale = maxDim > 0.0001 ? targetLen / maxDim : 1;
    model.scale.setScalar(scale);

    // Recenter
    box.setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center); // center at origin

    // Raise so the lowest point sits just above local y=0 to avoid clipping into the track
    box.setFromObject(model);
    const minY = box.min.y;
    model.position.y -= minY;
    model.position.y += 0.05; // small clearance above the ground plane

    // Apply current pose
    model.position.add(this.pos);
    model.position.y += this._getBotYOffset();
    model.rotation.y = this.heading;
    // We won't drive wheel rotations for external models; just ensure shadows
    this.wheels = [];
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const oldMesh = this.mesh;
    this.mesh = model;
    this.scene.add(this.mesh);
    if (oldMesh) {
      this.scene.remove(oldMesh);
    }
  }

  static _loadFerrariModel() {
    if (Kart._gltfFerrari) return Kart._gltfFerrari;
    const loader = new GLTFLoader();
    Kart._gltfFerrari = new Promise((resolve, reject) => {
      loader.load(
        'assets/2019_f1_ferrari_sf90/scene.gltf',
        (gltf) => resolve(gltf.scene),
        undefined,
        reject
      );
    });
    return Kart._gltfFerrari;
  }

  static _loadAudiModel() {
    if (Kart._gltfAudi) return Kart._gltfAudi;
    const loader = new GLTFLoader();
    Kart._gltfAudi = new Promise((resolve, reject) => {
      loader.load(
        'assets/audi_f1_2026_livery_textured/scene.gltf',
        (gltf) => resolve(gltf.scene),
        undefined,
        reject
      );
    });
    return Kart._gltfAudi;
  }
}

// TODO: Create separate Bot.js class for AI opponents
// This will extend or compose with Kart and have its own AI system
// Placeholder for future bot architecture:
//
// export class Bot {
//   constructor(scene, options) {
//     this.kart = new Kart(scene, { ...options, isPlayer: false });
//     this.ai = new BotAI(options.difficulty);
//   }
//
//   step(delta, trackData) {
//     const inputs = this.ai.calculateInputs(this.kart, trackData);
//     this.kart.step(delta, inputs);
//   }
// }
