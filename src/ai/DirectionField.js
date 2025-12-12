import * as THREE from 'three';

/**
 * DirectionField - Generates a grid-based direction field (slope field) from waypoints
 *
 * Each grid cell contains a direction vector that AI can follow
 */

export class DirectionField {
  constructor(options = {}) {
    this.gridWidth = options.gridWidth ?? 60;
    this.gridHeight = options.gridHeight ?? 60;
    this.tileSize = options.tileSize ?? 2;
    this.waypoints = options.waypoints ?? [];

    this.field = [];
    this.path = null;

    if (this.waypoints.length > 0) {
      this.generateField();
    }
  }

  generatePath() {
    if (this.waypoints.length < 2) {
      console.warn('Need at least 2 waypoints to generate path');
      return null;
    }

    const points = this.waypoints.map(wp =>
      new THREE.Vector3(wp.position.x, 0, wp.position.z)
    );

    const curve = new THREE.CatmullRomCurve3(points, true);
    this.path = curve;
    return curve;
  }

  generateField() {
    this.generatePath();
    if (!this.path) {
      console.warn('Failed to generate path');
      return;
    }

    this.field = [];
    for (let row = 0; row < this.gridHeight; row++) {
      const rowData = [];
      for (let col = 0; col < this.gridWidth; col++) {
        rowData.push(new THREE.Vector2(0, 0));
      }
      this.field.push(rowData);
    }

    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        const worldX = (col - this.gridWidth / 2) * this.tileSize + this.tileSize / 2;
        const worldZ = (row - this.gridHeight / 2) * this.tileSize + this.tileSize / 2;
        const cellPos = new THREE.Vector3(worldX, 0, worldZ);

        const nearestT = this.findNearestPointOnPath(cellPos);
        const nearestPoint = this.path.getPoint(nearestT);
        const tangent = this.path.getTangent(nearestT);
        const distanceToPath = cellPos.distanceTo(nearestPoint);
        const pullStrength = Math.min(distanceToPath / 80, 1.0);

        const toPath = new THREE.Vector2(
          nearestPoint.x - cellPos.x,
          nearestPoint.z - cellPos.z
        ).normalize();

        const alongPath = new THREE.Vector2(tangent.x, tangent.z).normalize();

        const blended = new THREE.Vector2(
          alongPath.x * (1 - pullStrength) + toPath.x * pullStrength,
          alongPath.y * (1 - pullStrength) + toPath.y * pullStrength
        ).normalize();

        this.field[row][col] = blended;
      }
    }
  }

  findNearestPointOnPath(position) {
    let minDist = Infinity;
    let closestT = 0;

    const samples = 100;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = this.path.getPoint(t);
      const dist = position.distanceTo(point);
      if (dist < minDist) {
        minDist = dist;
        closestT = t;
      }
    }

    const refinement = 20;
    const step = 1 / samples;
    const startT = Math.max(0, closestT - step);
    const endT = Math.min(1, closestT + step);

    for (let i = 0; i <= refinement; i++) {
      const t = startT + (endT - startT) * (i / refinement);
      const point = this.path.getPoint(t);
      const dist = position.distanceTo(point);
      if (dist < minDist) {
        minDist = dist;
        closestT = t;
      }
    }

    return closestT;
  }

  getDirectionAt(position) {
    const col = Math.floor((position.x + (this.gridWidth * this.tileSize) / 2) / this.tileSize);
    const row = Math.floor((position.z + (this.gridHeight * this.tileSize) / 2) / this.tileSize);

    if (row < 0 || row >= this.gridHeight || col < 0 || col >= this.gridWidth) {
      return new THREE.Vector2(0, 0);
    }

    return this.field[row][col].clone();
  }

  getTargetAhead(position, distance) {
    const direction = this.getDirectionAt(position);
    return new THREE.Vector3(
      position.x + direction.x * distance,
      position.y,
      position.z + direction.y * distance
    );
  }

  visualize(scene, spacing = 5) {
    const arrows = [];

    for (let row = 0; row < this.gridHeight; row += spacing) {
      for (let col = 0; col < this.gridWidth; col += spacing) {
        const worldX = (col - this.gridWidth / 2) * this.tileSize + this.tileSize / 2;
        const worldZ = (row - this.gridHeight / 2) * this.tileSize + this.tileSize / 2;

        const direction = this.field[row][col];
        const dir3d = new THREE.Vector3(direction.x, 0, direction.y);
        const origin = new THREE.Vector3(worldX, 0.5, worldZ);
        const arrowHelper = new THREE.ArrowHelper(
          dir3d,
          origin,
          this.tileSize * 2,
          0xff00ff,
          0.5,
          0.3
        );

        scene.add(arrowHelper);
        arrows.push(arrowHelper);
      }
    }

    return arrows;
  }

  toJSON() {
    return {
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      tileSize: this.tileSize,
      waypoints: this.waypoints.map(wp => wp.toJSON())
    };
  }
}
