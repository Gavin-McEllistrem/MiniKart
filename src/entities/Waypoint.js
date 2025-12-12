import * as THREE from 'three';

/**
 * Waypoint - A discrete point that defines AI racing line
 *
 * Waypoints are used to generate a path and direction field for AI navigation
 */

export class Waypoint {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.id = options.id ?? 0;
    this.position = options.position ?? new THREE.Vector3(0, 0, 0);
    this.visible = options.visible ?? true;

    this.mesh = null;
    this.createMesh();
  }

  createMesh() {
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.7
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.visible = this.visible;

    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5, 8);
    const poleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 2.5;
    this.mesh.add(pole);

    this.createLabel();
    this.scene.add(this.mesh);
  }

  createLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.id.toString(), 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 2, 1);
    sprite.position.y = 6;

    this.mesh.add(sprite);
  }

  setPosition(position) {
    this.position.copy(position);
    if (this.mesh) {
      this.mesh.position.copy(position);
    }
  }

  setVisible(visible) {
    this.visible = visible;
    if (this.mesh) {
      this.mesh.visible = visible;
    }
  }

  toJSON() {
    return {
      id: this.id,
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      }
    };
  }

  destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();

      this.mesh.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });

      this.mesh = null;
    }
  }
}
