import * as THREE from 'three';

/**
 * Checkpoint - Collision plane for lap validation
 *
 * Creates a vertical plane that detects when karts pass through
 */

export class Checkpoint {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.id = options.id ?? 0;
    this.position = options.position ?? new THREE.Vector3(0, 0, 0);
    this.rotation = options.rotation ?? 0; // Rotation in radians
    this.width = options.width ?? 20; // Width of checkpoint plane
    this.height = options.height ?? 10; // Height of checkpoint plane
    this.isFinishLine = options.isFinishLine ?? false;

    // Visual style
    this.color = this.isFinishLine ? 0xff0000 : 0x00ff00; // Red for finish, green for checkpoint
    this.opacity = options.opacity ?? 0.3;
    this.debugVisible = false; // Track if checkpoint is in debug visibility mode
    this.isHighlighted = false; // Track highlight state

    // Collision tracking
    this.kartsInside = new Set();

    // Create visual mesh
    this.mesh = this._createMesh();
    this.scene.add(this.mesh);

    // Create collision plane
    this.collisionPlane = this._createCollisionPlane();
  }

  /**
   * Create visual checkpoint mesh
   */
  _createMesh() {
    const geometry = new THREE.PlaneGeometry(this.width, this.height);
    const material = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: this.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      // Set render order to ensure consistent rendering
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(this.position);
    mesh.position.y += this.height / 2; // Raise to ground level
    // Negate rotation to correct for coordinate system when rendering
    mesh.rotation.y = -this.rotation;
    mesh.renderOrder = 1; // Render after opaque objects

    // Add glowing edges
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: this.color,
      linewidth: 2,
      depthTest: true
    });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    edges.renderOrder = 2; // Render edges after plane
    mesh.add(edges);

    return mesh;
  }

  /**
   * Create collision plane for raycasting
   */
  _createCollisionPlane() {
    // Create bounding box for collision detection
    const box = new THREE.Box3();
    box.setFromCenterAndSize(
      new THREE.Vector3(this.position.x, this.height / 2, this.position.z),
      new THREE.Vector3(this.width, this.height, 0.5) // Thin depth for plane
    );
    return box;
  }

  /**
   * Check if a kart is passing through the checkpoint
   * @param {string} kartId - Kart identifier
   * @param {THREE.Vector3} kartPos - Kart position
   * @returns {boolean} True if kart just entered checkpoint
   */
  checkCollision(kartId, kartPos) {
    // Transform kart position to checkpoint local space
    const localPos = kartPos.clone().sub(this.position);

    // Rotate inverse to checkpoint rotation
    const cosTheta = Math.cos(-this.rotation);
    const sinTheta = Math.sin(-this.rotation);
    const rotatedX = localPos.x * cosTheta - localPos.z * sinTheta;
    const rotatedZ = localPos.x * sinTheta + localPos.z * cosTheta;

    // Check if within checkpoint bounds
    const isInside =
      Math.abs(rotatedX) < this.width / 2 &&
      kartPos.y < this.height &&
      kartPos.y > 0 &&
      Math.abs(rotatedZ) < 2; // Thin depth tolerance

    // Detect entry (wasn't inside before, is now)
    if (isInside && !this.kartsInside.has(kartId)) {
      this.kartsInside.add(kartId);
      return true; // Just entered
    } else if (!isInside && this.kartsInside.has(kartId)) {
      this.kartsInside.delete(kartId);
    }

    return false;
  }

  /**
   * Set visibility
   */
  setVisible(visible) {
    this.mesh.visible = visible;
    this.debugVisible = visible; // Track debug visibility state

    // When making visible (debug mode), apply the correct opacity based on highlight state
    if (visible) {
      if (this.isHighlighted) {
        this.mesh.material.opacity = 0.7;
        this.mesh.material.emissive = new THREE.Color(this.color);
        this.mesh.material.emissiveIntensity = 0.3;
      } else {
        this.mesh.material.opacity = 0.6;
        this.mesh.material.emissive = new THREE.Color(0x000000);
        this.mesh.material.emissiveIntensity = 0;
      }
      this.mesh.material.needsUpdate = true;
    }
  }

  /**
   * Highlight checkpoint (for next checkpoint indicator)
   */
  setHighlight(highlighted) {
    this.isHighlighted = highlighted; // Always track state

    // Apply visual changes if in debug mode (visible)
    if (this.debugVisible) {
      if (highlighted) {
        this.mesh.material.opacity = 0.7;
        this.mesh.material.emissive = new THREE.Color(this.color);
        this.mesh.material.emissiveIntensity = 0.3;
      } else {
        this.mesh.material.opacity = 0.6;
        this.mesh.material.emissive = new THREE.Color(0x000000);
        this.mesh.material.emissiveIntensity = 0;
      }
      this.mesh.material.needsUpdate = true;
    }
  }

  /**
   * Serialize checkpoint data
   */
  serialize() {
    return {
      id: this.id,
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      rotation: this.rotation,
      width: this.width,
      height: this.height,
      isFinishLine: this.isFinishLine
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
