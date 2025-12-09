import * as THREE from 'three';
import { getTile } from '../track/TileRegistry.js';

/**
 * CpuDriver - lightweight AI to follow checkpoints and run laps
 *
 * Generates throttle/steer/brake inputs that aim for the next checkpoint.
 * Keeps things simple and readable so we can expand the behaviour later.
 */
export class CpuDriver {
  constructor(options = {}) {
    this.targetSpeedFactor = options.targetSpeedFactor ?? 1; // % of kart max speed
    this.cornerSlowdownAngle = options.cornerSlowdownAngle ?? 1.2; // radians before slowing
    this.lookAhead = options.lookAhead ?? 6; // meters past checkpoint center
    this.brakeAggression = options.brakeAggression ?? 0.6;
    this.maxThrottle = options.maxThrottle ?? 1.0;
    this.driftEnabled = options.driftEnabled ?? false; // Disable heavy drifting by default

    // Precomputed waypoint path (tile centers) that visits checkpoints in order
    this.waypoints = [];
    this.lastCheckpointCount = 0;
    this.segmentLengths = [];
    this.totalPathLength = 0;
    this.pathCursor = 0; // distance along path
    this.targetLeadDistance = options.targetLeadDistance ?? 50; // distance ahead of kart to place target on path
    this.lateralSlowdownThreshold = options.lateralSlowdownThreshold ?? 3.5;
    this.stuckSpeedThreshold = options.stuckSpeedThreshold ?? 0.6;
    this.stuckTimeThreshold = options.stuckTimeThreshold ?? 0.8;
    this.reverseDuration = options.reverseDuration ?? 0.9;
    this.stuckTimer = 0;
    this.reversing = false;
    this.reverseTimer = 0;
    this.debugPath = options.debugPath ?? true;
    this.debugLine = null;
    this.debugCurrentWp = null;
    this.debugTargetPoint = null;
  }

  /**
   * Build a full lap path that goes through all checkpoints in order.
   * Uses a simple grid BFS between consecutive checkpoints to avoid walls/barriers.
   */
  _ensurePath(track) {
    const checkpoints = track?.checkpointSystem?.checkpoints ?? [];
    if (!track || checkpoints.length === 0) {
      this.waypoints = [];
      this.segmentLengths = [];
      this.totalPathLength = 0;
      return;
    }

    if (this.waypoints.length > 0 && this.lastCheckpointCount === checkpoints.length) {
      return; // already built
    }

    this.lastCheckpointCount = checkpoints.length;
    this.waypoints = [];
    this.segmentLengths = [];
    this.totalPathLength = 0;

    for (let i = 0; i < checkpoints.length; i++) {
      const curr = checkpoints[i];
      const next = checkpoints[(i + 1) % checkpoints.length]; // loop for lap

      const startGrid = track.worldToGrid(curr.position);
      const endGrid = track.worldToGrid(next.position);
      if (!startGrid || !endGrid) continue;

      let segment = this._bfs(track, startGrid, endGrid);
      if (segment.length === 0) {
        // Fallback: just use the checkpoint position
        this.waypoints.push(curr.position.clone());
        continue;
      }

      segment = this._smoothPath(track, segment);

      // Push segment waypoints (world positions)
      segment.forEach((wp, idx) => {
        // De-duplicate consecutive identical points
        if (idx > 0 && wp.distanceTo(this.waypoints[this.waypoints.length - 1] ?? new THREE.Vector3()) < 0.1) {
          return;
        }
        this.waypoints.push(wp);
      });
    }

    // Ensure we include the first checkpoint to close the loop
    const firstCp = checkpoints[0];
    if (firstCp) {
      this.waypoints.push(firstCp.position.clone());
    }

    this._recomputeSegmentLengths();
    this.pathCursor = 0;

    // Update debug path line
    if (this.debugPath) {
      this._updateDebugPath(track, this.waypoints);
    }
  }

  /**
   * Build inputs for the current frame
   */
  getInputs({ kart, track, delta }) {
    this._ensurePath(track);

    const pathTarget = this._updatePathCursor(kart.pos);
    const target = pathTarget?.target ?? null;
    const currentWp = pathTarget?.projection ?? null;
    const lateralError = pathTarget?.lateralError ?? 0;

    if (this.debugPath) {
      this._updateDebugTargets(track, currentWp, target);
    }

    // Default to gentle throttle if we have nothing to aim at
    if (!target) {
      return { throttle: 0.4, brake: 0, steer: 0, drift: false };
    }

    const toTarget = new THREE.Vector2(
      target.x - kart.pos.x,
      target.z - kart.pos.z
    );
    const distance = toTarget.length();
    const desiredHeading = Math.atan2(toTarget.x, toTarget.y);

    // Normalize angle difference to [-PI, PI]
    let angleDiff = desiredHeading - kart.heading;
    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

    // Steering: proportional to angle difference (invert to match input scheme), slightly damped to avoid oscillation
    const steer = THREE.MathUtils.clamp(-angleDiff * 1.0, -1, 1);

    // Target speed slows down for tighter turns and large lateral error
    const cornerFactor = THREE.MathUtils.clamp(
      Math.abs(angleDiff) / this.cornerSlowdownAngle,
      0,
      1
    );
    const baseMax = kart.controller.maxSpeed * this.targetSpeedFactor;
    const lateralFactor = lateralError > this.lateralSlowdownThreshold
      ? THREE.MathUtils.clamp(1 - (lateralError - this.lateralSlowdownThreshold) * 0.25, 0.3, 1)
      : 1;
    const targetSpeed = baseMax * (1 - 0.55 * cornerFactor) * lateralFactor;

    // Throttle/brake logic
    const shouldBrake =
      kart.speed > targetSpeed + 4 ||
      (Math.abs(angleDiff) > this.cornerSlowdownAngle && distance < 12);

    // Reduce throttle when pointed far off the segment to curb zig-zagging
    const throttleScale = THREE.MathUtils.clamp(1 - Math.abs(angleDiff) * 0.7, 0.2, 1);
    let throttle = shouldBrake ? 0 : this.maxThrottle * throttleScale;
    let brake = shouldBrake ? this.brakeAggression : 0;

    // Detect and handle stuck cases (likely after a wall bump)
    if (!this.reversing) {
      if (kart.speed < this.stuckSpeedThreshold && throttle > 0.2) {
        this.stuckTimer += delta;
        if (this.stuckTimer > this.stuckTimeThreshold) {
          this.reversing = true;
          this.reverseTimer = this.reverseDuration;
          this.stuckTimer = 0;
        }
      } else {
        this.stuckTimer = 0;
      }
    } else {
      this.reverseTimer -= delta;
      if (this.reverseTimer <= 0) {
        this.reversing = false;
      }
    }

    if (this.reversing) {
      throttle = 0;
      brake = Math.max(brake, 0.8); // use brake to go into reverse
    }

    // Avoid aggressive drifting; only allow in extreme turns if enabled
    const drift = this.driftEnabled && Math.abs(angleDiff) > 1.0 && kart.speed > baseMax * 0.6;

    return { throttle, brake, steer, drift };
  }

  /**
   * Keep a target point on the path a fixed distance ahead of the kart.
   */
  _updatePathCursor(kartPos) {
    if (this.waypoints.length < 2 || this.totalPathLength <= 0) return null;

    // Project onto path, advance cursor forward only
    const projection = this._projectOntoPath(kartPos);
    if (projection) {
      this.pathCursor = this._advanceCursor(this.pathCursor, projection.distanceAlong);
    }

    // Place target ahead along the path
    const cursorNorm = this._wrapDistance(this.pathCursor);
    let targetDistance = this._wrapDistance(cursorNorm + this.targetLeadDistance);
    let targetPoint = this._pointAtDistance(targetDistance);

    // Keep target in front relative to path direction
    const pathDir = this._directionAtDistance(this.pathCursor);
    if (pathDir && targetPoint) {
      const toTarget = targetPoint.clone().sub(kartPos).normalize();
      if (toTarget.dot(pathDir) < 0) {
        targetDistance = this._wrapDistance(targetDistance + this.targetLeadDistance * 0.5);
        targetPoint = this._pointAtDistance(targetDistance);
      }
    }

    const lateralError = projection?.point ? projection.point.distanceTo(kartPos) : 0;

    return { target: targetPoint, projection: projection?.point ?? null, lateralError };
  }

  /**
   * Project a position onto the current path and return nearest point and distance along path.
   */
  _projectOntoPath(pos) {
    let best = null;
    let bestDist = Infinity;
    let accumulated = 0;

    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      const seg = b.clone().sub(a);
      const segLen = seg.length();
      if (segLen < 0.001) {
        accumulated += segLen;
        continue;
      }

      const t = THREE.MathUtils.clamp(pos.clone().sub(a).dot(seg) / (segLen * segLen), 0, 1);
      const proj = a.clone().add(seg.clone().multiplyScalar(t));
      const dist = proj.distanceTo(pos);
      if (dist < bestDist) {
        bestDist = dist;
        best = {
          point: proj,
          distanceAlong: accumulated + segLen * t,
          segmentIndex: i
        };
      }

      accumulated += segLen;
    }

    return best;
  }

  /**
   * Simple BFS over the grid between two tiles (collision-only)
   */
  _bfs(track, start, goal) {
    const rows = track.height;
    const cols = track.width;
    const inBounds = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols;

    const key = (r, c) => `${r},${c}`;
    const queue = [start];
    const cameFrom = new Map([[key(start.row, start.col), null]]);

    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      const currentKey = key(current.row, current.col);

      if (current.row === goal.row && current.col === goal.col) {
        return this._reconstructPath(cameFrom, currentKey, track);
      }

      for (const [dr, dc] of dirs) {
        const nr = current.row + dr;
        const nc = current.col + dc;
        if (!inBounds(nr, nc)) continue;

        const tileId = track.trackData[nr][nc];
        const tile = getTile(tileId);
        // Note: collision === true means DRIVABLE; false means a blocking wall/barrier.
        if (!tile || tile.collision !== true) continue;

        const neighborKey = key(nr, nc);
        if (cameFrom.has(neighborKey)) continue;

        cameFrom.set(neighborKey, currentKey);
        queue.push({ row: nr, col: nc });
      }
    }

    return [];
  }

  _reconstructPath(cameFrom, currentKey, track) {
    const path = [];
    let key = currentKey;
    while (key) {
      const [r, c] = key.split(',').map(Number);
      const wp = track.gridToWorld(r, c);
      if (wp) path.unshift(wp);
      key = cameFrom.get(key);
    }
    return path;
  }

  /**
   * Reduce zig-zag in a path by keeping the farthest waypoint reachable in a straight line.
   */
  _smoothPath(track, points) {
    if (!points || points.length <= 2) return points;

    const result = [points[0]];
    let anchorIdx = 0;

    while (anchorIdx < points.length - 1) {
      let farthestIdx = anchorIdx + 1;

      for (let i = anchorIdx + 1; i < points.length; i++) {
        if (this._lineIsClear(track, points[anchorIdx], points[i])) {
          farthestIdx = i;
        } else {
          break;
        }
      }

      result.push(points[farthestIdx]);
      anchorIdx = farthestIdx;
    }

    return result;
  }

  /**
   * Check if the straight segment between two points stays on drivable tiles.
   */
  _lineIsClear(track, a, b) {
    if (!track) return false;

    const distance = a.distanceTo(b);
    const step = Math.max(track.tileSize * 0.4, 2); // sample every ~half tile or 2 units
    const dir = b.clone().sub(a).normalize();
    const samples = Math.ceil(distance / step);

    for (let i = 0; i <= samples; i++) {
      const p = a.clone().add(dir.clone().multiplyScalar(step * i));
      const tile = track.getTileAtPosition(p);
      if (!tile || tile.collision !== true) return false;
    }

    return true;
  }

  /**
   * Compute cumulative segment lengths for fast lookup.
   */
  _recomputeSegmentLengths() {
    this.segmentLengths = [];
    this.totalPathLength = 0;

    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const len = this.waypoints[i].distanceTo(this.waypoints[i + 1]);
      this.segmentLengths.push(len);
      this.totalPathLength += len;
    }
  }

  /**
   * Draw or update a debug line showing the computed path.
   */
  _updateDebugPath(track, points) {
    if (!track || !track.scene || !points || points.length === 0) return;

    if (this.debugLine) {
      track.scene.remove(this.debugLine);
      this.debugLine.geometry.dispose();
      this.debugLine.material.dispose();
      this.debugLine = null;
    }

    const elevatedPoints = points.map((p) => new THREE.Vector3(p.x, 0.6, p.z));
    const geometry = new THREE.BufferGeometry().setFromPoints(elevatedPoints);
    const material = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 10;
    track.scene.add(line);
    this.debugLine = line;
  }

  /**
   * Visualize current projection (magenta) and active target point (yellow).
   */
  _updateDebugTargets(track, currentWp, target) {
    if (!track || !track.scene) return;

    const ensureMarker = (marker, color) => {
      if (!marker) {
        const geom = new THREE.SphereGeometry(0.8, 10, 10);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 11;
        track.scene.add(mesh);
        return mesh;
      }
      return marker;
    };

    if (currentWp) {
      this.debugCurrentWp = ensureMarker(this.debugCurrentWp, 0xff00ff);
      this.debugCurrentWp.position.set(currentWp.x, 0.8, currentWp.z);
      this.debugCurrentWp.visible = true;
    } else if (this.debugCurrentWp) {
      this.debugCurrentWp.visible = false;
    }

    if (target) {
      this.debugTargetPoint = ensureMarker(this.debugTargetPoint, 0xffff00);
      this.debugTargetPoint.position.set(target.x, 0.8, target.z);
      this.debugTargetPoint.visible = true;
    } else if (this.debugTargetPoint) {
      this.debugTargetPoint.visible = false;
    }
  }

  _wrapDistance(d) {
    if (this.totalPathLength <= 0) return 0;
    let dist = d % this.totalPathLength;
    if (dist < 0) dist += this.totalPathLength;
    return dist;
  }

  /**
   * Get point on path at cumulative distance.
   */
  _pointAtDistance(distance) {
    if (this.segmentLengths.length === 0) return this.waypoints[0] ?? null;

    const dist = this._wrapDistance(distance);
    let remaining = dist;
    for (let i = 0; i < this.segmentLengths.length; i++) {
      const segLen = this.segmentLengths[i];
      if (remaining <= segLen) {
        const t = segLen < 0.001 ? 0 : remaining / segLen;
        return this.waypoints[i].clone().lerp(this.waypoints[i + 1], t);
      }
      remaining -= segLen;
    }
    return this.waypoints[this.waypoints.length - 1]?.clone() ?? null;
  }

  /**
   * Get direction of path at cumulative distance.
   */
  _directionAtDistance(distance) {
    if (this.segmentLengths.length === 0) return null;
    const dist = this._wrapDistance(distance);
    let remaining = dist;
    for (let i = 0; i < this.segmentLengths.length; i++) {
      const segLen = this.segmentLengths[i];
      if (remaining <= segLen) {
        const dir = this.waypoints[i + 1].clone().sub(this.waypoints[i]).normalize();
        return dir;
      }
      remaining -= segLen;
    }
    return null;
  }

  /**
   * Advance the path cursor forward, never backward, handling lap wrap.
   */
  _advanceCursor(current, projected) {
    if (this.totalPathLength <= 0) return current;

    const currNorm = this._wrapDistance(current);
    const projNorm = this._wrapDistance(projected);

    // Compute forward delta along the loop
    let delta = projNorm - currNorm;
    if (delta < 0) {
      delta += this.totalPathLength;
    }

    // Only move forward if projection is meaningfully ahead
    if (delta > 0.1) {
      return current + delta;
    }

    return current; // do not move backward
  }
}
