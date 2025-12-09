import * as THREE from 'three';
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

    // Transform
    this.pos = new THREE.Vector3(0, 0.5, 0);
    this.heading = 0; // radians
    this.speed = 0;

    // Arcade controller (simple Mario Kart style)
    this.controller = new ArcadeController({
      // Using arcade defaults
    });

    // Visual mesh
    this.mesh = this._makeMesh();
    this.scene.add(this.mesh);

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
   * Create the kart 3D mesh
   */
  _makeMesh() {
    const group = new THREE.Group();

    // Body
    const bodyGeom = new THREE.BoxGeometry(2, 1, 3);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.color,
      metalness: 0.2,
      roughness: 0.7
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Front indicator (arrow/cone to show which way is forward)
    const coneGeom = new THREE.ConeGeometry(0.5, 1.2, 8);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xffff00, // Yellow
      emissive: 0x444400
    });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    cone.position.set(0, 1.3, 1.8); // Front of kart
    cone.rotation.x = Math.PI / 2; // Point forward
    group.add(cone);

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const wheelPositions = [
      [-0.9, 0.2,  1.2],  // Front left
      [ 0.9, 0.2,  1.2],  // Front right
      [-0.9, 0.2, -1.2],  // Rear left
      [ 0.9, 0.2, -1.2],  // Rear right
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
    this.speed = result.speed+5000;
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
    if (this.wheels && inputs.steer !== undefined) {
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
  }

  /**
   * Remove kart from scene
   */
  destroy() {
    this.scene.remove(this.mesh);
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
