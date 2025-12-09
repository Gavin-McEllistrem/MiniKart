import { Checkpoint } from '../entities/Checkpoint.js';
import { eventBus } from '../utils/EventBus.js';

/**
 * CheckpointSystem - Manages checkpoint validation and lap tracking
 *
 * Features:
 * - Sequential checkpoint validation
 * - Lap counting
 * - No shortcut prevention
 * - Per-kart progress tracking
 */

export class CheckpointSystem {
  constructor(scene, checkpointData = []) {
    this.scene = scene;
    this.checkpoints = [];
    this.kartStates = new Map();

    // Load checkpoints from data
    if (checkpointData.length > 0) {
      this.loadCheckpoints(checkpointData);
    }
  }

  /**
   * Load checkpoints from data
   */
  loadCheckpoints(checkpointData) {
    // Clear existing
    this.clearCheckpoints();

    // Sort by ID to ensure correct order
    const sorted = [...checkpointData].sort((a, b) => a.id - b.id);

    // Create checkpoint entities
    sorted.forEach(data => {
      const checkpoint = new Checkpoint(this.scene, {
        id: data.id,
        position: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
        rotation: data.rotation,
        width: data.width ?? 20,
        height: data.height ?? 10,
        isFinishLine: data.isFinishLine ?? false
      });
      this.checkpoints.push(checkpoint);
    });

    console.log(`Loaded ${this.checkpoints.length} checkpoints`);
  }

  /**
   * Initialize kart tracking
   */
  initKart(kartId) {
    this.kartStates.set(kartId, {
      currentLap: 0,
      nextCheckpointIndex: 0,
      checkpointsPassed: [],
      lapStartTime: performance.now(),
      lastLapTime: null,
      bestLapTime: null
    });

    // Highlight first checkpoint
    if (this.checkpoints.length > 0) {
      this.checkpoints[0].setHighlight(true);
    }
  }

  /**
   * Update checkpoint system (call each frame)
   */
  update(kartId, kartPosition) {
    if (!this.kartStates.has(kartId)) {
      this.initKart(kartId);
    }

    if (this.checkpoints.length === 0) {
      return null; // No checkpoints
    }

    const state = this.kartStates.get(kartId);

    // Check if kart is passing through the next checkpoint in sequence
    const nextCheckpoint = this.checkpoints[state.nextCheckpointIndex];
    if (nextCheckpoint && nextCheckpoint.checkCollision(kartId, kartPosition)) {
      // Unhighlight current checkpoint
      nextCheckpoint.setHighlight(false);

      // Mark checkpoint as passed
      state.checkpointsPassed.push(nextCheckpoint.id);
      state.nextCheckpointIndex++;

      eventBus.emit('checkpoint-reached', {
        kartId,
        checkpointId: nextCheckpoint.id,
        checkpointIndex: state.nextCheckpointIndex - 1,
        remaining: this.checkpoints.length - state.nextCheckpointIndex,
        isFinishLine: nextCheckpoint.isFinishLine
      });

      // If this was the last checkpoint (finish line), complete the lap immediately
      if (state.nextCheckpointIndex >= this.checkpoints.length) {
        return this.completeLap(kartId);
      } else {
        // Highlight next checkpoint
        this.checkpoints[state.nextCheckpointIndex].setHighlight(true);
      }
    }

    return null;
  }

  /**
   * Complete a lap
   */
  completeLap(kartId) {
    const state = this.kartStates.get(kartId);
    const lapTime = (performance.now() - state.lapStartTime) / 1000; // Convert to seconds

    // Update best lap time
    if (!state.bestLapTime || lapTime < state.bestLapTime) {
      state.bestLapTime = lapTime;
    }

    state.lastLapTime = lapTime;
    state.currentLap++;

    // Reset for next lap
    state.nextCheckpointIndex = 0;
    state.checkpointsPassed = [];
    state.lapStartTime = performance.now();

    // Unhighlight all checkpoints, then highlight the first one
    this.checkpoints.forEach(cp => cp.setHighlight(false));
    if (this.checkpoints.length > 0) {
      this.checkpoints[0].setHighlight(true);
    }

    console.log(`Lap ${state.currentLap} completed in ${lapTime.toFixed(2)}s (Best: ${state.bestLapTime.toFixed(2)}s)`);

    eventBus.emit('lap-completed', {
      kartId,
      lapNumber: state.currentLap,
      lapTime,
      bestLapTime: state.bestLapTime
    });

    return {
      type: 'lap',
      lapNumber: state.currentLap,
      lapTime,
      bestLapTime: state.bestLapTime
    };
  }

  /**
   * Get kart progress
   */
  getProgress(kartId) {
    if (!this.kartStates.has(kartId)) return null;

    const state = this.kartStates.get(kartId);
    return {
      lap: state.currentLap,
      checkpoint: state.nextCheckpointIndex,
      totalCheckpoints: this.checkpoints.length,
      percentage: this.checkpoints.length > 0
        ? (state.nextCheckpointIndex / this.checkpoints.length) * 100
        : 0
    };
  }

  /**
   * Get lap times
   */
  getLapTimes(kartId) {
    if (!this.kartStates.has(kartId)) return null;

    const state = this.kartStates.get(kartId);
    return {
      currentLap: state.currentLap,
      lastLapTime: state.lastLapTime,
      bestLapTime: state.bestLapTime
    };
  }

  /**
   * Show/hide all checkpoints
   */
  setCheckpointsVisible(visible) {
    this.checkpoints.forEach(cp => cp.setVisible(visible));
  }

  /**
   * Clear all checkpoints
   */
  clearCheckpoints() {
    this.checkpoints.forEach(cp => cp.destroy());
    this.checkpoints = [];
  }

  /**
   * Add checkpoint at position
   */
  addCheckpoint(position, rotation = 0, isFinishLine = false) {
    const id = this.checkpoints.length;
    const checkpoint = new Checkpoint(this.scene, {
      id,
      position,
      rotation,
      isFinishLine
    });
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  /**
   * Remove checkpoint by ID
   */
  removeCheckpoint(id) {
    const index = this.checkpoints.findIndex(cp => cp.id === id);
    if (index !== -1) {
      this.checkpoints[index].destroy();
      this.checkpoints.splice(index, 1);

      // Reindex remaining checkpoints
      this.checkpoints.forEach((cp, i) => {
        cp.id = i;
      });
    }
  }

  /**
   * Serialize all checkpoints
   */
  serializeCheckpoints() {
    return this.checkpoints.map(cp => cp.serialize());
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.clearCheckpoints();
    this.kartStates.clear();
  }
}
