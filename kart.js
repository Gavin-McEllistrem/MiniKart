import * as THREE from 'three';

export class Kart {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.isPlayer = options.isPlayer ?? true;
    this.color = options.color ?? 0xff4444;
    this.mode = options.mode ?? "prototype";

    this.pos = new THREE.Vector3(0, 0.5, 0);
    this.heading = 0; // radians
    this.speed = 0;

    this.maxSpeed = 40;
    this.accel = 25;
    this.brake = 40;
    this.friction = 10;
    this.turnRate = 2.2;

    this.boostTimer = 0;

    // Bot fields
    this.waypoints = options.waypoints || null;
    this.wpIndex = 0;
    this.botTargetSpeed = options.botTargetSpeed ?? 22;

    this.mesh = this._makeMesh();
    this.scene.add(this.mesh);

    this.box = new THREE.Box3();
  }

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
    group.add(body);

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const offs = [
      [-0.9, 0.2,  1.2],
      [ 0.9, 0.2,  1.2],
      [-0.9, 0.2, -1.2],
      [ 0.9, 0.2, -1.2],
    ];
    for (const [x, y, z] of offs) {
      const w = new THREE.Mesh(wheelGeom, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, y, z);
      group.add(w);
    }

    group.position.copy(this.pos);
    return group;
  }

  giveBoost() {
    this.boostTimer = 1.0;
    this.speed = Math.max(this.speed, 30);
  }

  _updatePlayer(delta, keyState, touchState) {
    const up = keyState["arrowup"] || keyState["w"] || touchState.up;
    const down = keyState["arrowdown"] || keyState["s"] || touchState.down;
    const left = keyState["arrowleft"] || keyState["a"] || touchState.left;
    const right = keyState["arrowright"] || keyState["d"] || touchState.right;

    // Accelerate / brake
    if (up) {
      this.speed += this.accel * delta;
    } else if (down) {
      this.speed -= this.brake * delta;
    } else {
      if (this.speed > 0) {
        this.speed -= this.friction * delta;
        if (this.speed < 0) this.speed = 0;
      } else if (this.speed < 0) {
        this.speed += this.friction * delta;
        if (this.speed > 0) this.speed = 0;
      }
    }

    // Boost
    if (this.boostTimer > 0) {
      this.speed = Math.min(this.speed + 10 * delta, this.maxSpeed * 1.5);
      this.boostTimer -= delta;
    } else {
      if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
    }

    // Steering
    if (Math.abs(this.speed) > 1) {
      if (left) this.heading += this.turnRate * delta;
      if (right) this.heading -= this.turnRate * delta;
    }
  }

  _updateBot(delta) {
    if (!this.waypoints || this.waypoints.length === 0) return;

    const target = this.waypoints[this.wpIndex];
    const toTarget = new THREE.Vector3(
      target.x - this.pos.x,
      0,
      target.z - this.pos.z
    );
    const dist = toTarget.length();

    if (dist < 2) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      return;
    }

    const desired = Math.atan2(toTarget.x, toTarget.z);
    let diff = desired - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to [-pi, pi]

    const maxTurn = this.turnRate * delta;
    if (diff > maxTurn) diff = maxTurn;
    if (diff < -maxTurn) diff = -maxTurn;
    this.heading += diff;

    this.speed = this.botTargetSpeed;
  }

  step(delta, keyState = {}, touchState = {}) {
    if (this.isPlayer) {
      this._updatePlayer(delta, keyState, touchState);
    } else {
      this._updateBot(delta);
    }

    const dx = Math.sin(this.heading) * this.speed * delta;
    const dz = Math.cos(this.heading) * this.speed * delta;
    this.pos.x += dx;
    this.pos.z += dz;

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = -this.heading;
    this.box.setFromObject(this.mesh);
  }
}
