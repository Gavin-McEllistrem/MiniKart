import * as THREE from 'three';
import { getObject } from '../objects/ObjectRegistry.js';
import { RenderConfig } from '../config/RenderConfig.js';
import { TextureManager } from '../core/TextureManager.js';

/**
 * Object3D - Decorative 3D object entity
 *
 * Features:
 * - Prototype mode: Simple colored geometry
 * - Full mode: Textured models (GLTF/GLB)
 * - Configurable position, rotation, scale
 * - Collision detection support
 */

export class Object3D {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.id = options.id ?? 0;
    this.type = options.type ?? 'tree_pine';
    this.position = options.position ?? new THREE.Vector3(0, 0, 0);
    this.rotation = options.rotation ?? new THREE.Euler(0, 0, 0);
    this.scale = options.scale ?? { x: 1, y: 1, z: 1 };
    this.isLoaded = false;

    this.definition = getObject(this.type);
    if (!this.definition) {
      console.error(`Unknown object type: ${this.type}`);
      return;
    }

    if (!options.scale) {
      this.scale = { ...this.definition.defaultScale };
    }

    this.mesh = null;
    this._createMesh();
  }

  async _createMesh() {
    if (RenderConfig.isPrototype()) {
      this.mesh = this._createPrototypeMesh();
      this.scene.add(this.mesh);
      this.isLoaded = true;
    } else {
      await this._createFullMesh();
    }
  }

  _createPrototypeMesh() {
    const def = this.definition;
    let geometry;

    switch (def.prototypeGeometry) {
      case 'box':
        geometry = new THREE.BoxGeometry(1, 1, 1);
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.5, 16, 16);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(0.5, 1, 16);
        break;
      case 'dodecahedron':
        geometry = new THREE.DodecahedronGeometry(0.5);
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    const material = new THREE.MeshStandardMaterial({
      color: def.prototypeColor,
      roughness: 0.8,
      metalness: 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(this.position.x, this.position.y, this.position.z);
    mesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
    mesh.scale.set(this.scale.x, this.scale.y, this.scale.z);

    if (def.id === 'tree_pine' || def.id === 'tree_oak') {
      return this._createTreeMesh();
    }

    return mesh;
  }

  _createTreeMesh() {
    const def = this.definition;
    const group = new THREE.Group();

    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.25, 1, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.9,
      metalness: 0.1
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 0.5;
    group.add(trunk);

    let canopy;
    if (def.id === 'tree_pine') {
      const canopyGeometry = new THREE.ConeGeometry(0.6, 1.5, 8);
      const canopyMaterial = new THREE.MeshStandardMaterial({
        color: def.prototypeColor,
        roughness: 0.8,
        metalness: 0.1
      });
      canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
      canopy.position.y = 1.5;
    } else {
      const canopyGeometry = new THREE.SphereGeometry(0.8, 16, 16);
      const canopyMaterial = new THREE.MeshStandardMaterial({
        color: def.prototypeColor,
        roughness: 0.8,
        metalness: 0.1
      });
      canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
      canopy.position.y = 1.3;
    }
    group.add(canopy);

    group.position.set(this.position.x, this.position.y, this.position.z);
    group.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
    group.scale.set(this.scale.x, this.scale.y, this.scale.z);

    return group;
  }

  async _createFullMesh() {
    const def = this.definition;

    if (def.model && def.model !== 'primitive' && def.model.endsWith('.gltf')) {
      try {
        const model = await TextureManager.loadModel(def.model, {
          castShadow: true,
          receiveShadow: true
        });

        if (model) {
          model.position.set(this.position.x, this.position.y, this.position.z);
          model.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
          model.scale.set(this.scale.x, this.scale.y, this.scale.z);

          this.mesh = model;
          this.scene.add(this.mesh);
          this.isLoaded = true;
          return;
        }
      } catch (error) {
        console.error(`[Object3D] Failed to load GLTF model for ${def.name}:`, error);
      }
    }

    const mesh = this._createPrototypeMesh();

    if (def.texture) {
      const texture = TextureManager.loadTexture(def.texture);
      if (texture && mesh.material) {
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
      }
    }

    this.mesh = mesh;
    this.scene.add(this.mesh);
    this.isLoaded = true;
  }

  checkCollision(point) {
    if (!this.definition.collisionRadius) {
      return false;
    }

    const distance = point.distanceTo(new THREE.Vector3(
      this.position.x,
      point.y,
      this.position.z
    ));

    return distance < this.definition.collisionRadius;
  }

  setPosition(x, y, z) {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
    this.mesh.position.set(x, y, z);
  }

  setRotation(x, y, z) {
    this.rotation.x = x;
    this.rotation.y = y;
    this.rotation.z = z;
    this.mesh.rotation.set(x, y, z);
  }

  setScale(x, y, z) {
    this.scale.x = x;
    this.scale.y = y;
    this.scale.z = z;
    this.mesh.scale.set(x, y, z);
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      rotation: {
        x: this.rotation.x,
        y: this.rotation.y,
        z: this.rotation.z
      },
      scale: {
        x: this.scale.x,
        y: this.scale.y,
        z: this.scale.z
      }
    };
  }

  destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);

      if (this.mesh.geometry) {
        this.mesh.geometry.dispose();
      }
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach(mat => mat.dispose());
        } else {
          this.mesh.material.dispose();
        }
      }

      if (this.mesh.children) {
        this.mesh.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    }
  }
}
