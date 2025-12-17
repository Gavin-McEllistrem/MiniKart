import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Renderer - Handles Three.js rendering setup
 *
 * Manages:
 * - WebGL renderer
 * - Scene setup
 * - Lighting
 * - Orbit controls (for debugging)
 */

export class Renderer {
  constructor(options = {}) {
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: options.antialias ?? true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = options.shadows ?? true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(options.backgroundColor ?? 0x87CEEB);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      options.fov ?? 60,
      window.innerWidth / window.innerHeight,
      options.near ?? 0.1,
      options.far ?? 500
    );
    this.camera.position.set(0, 15, 25);

    // Orbit controls (disabled by default)
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.enabled = false;

    // Setup lighting
    this.setupLighting(options.lighting);

    // Handle window resize
    this._onResize = () => this.onResize();
    window.addEventListener('resize', this._onResize);
  }

  /**
   * Setup scene lighting
   */
  setupLighting(lightingOptions = {}) {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(
      lightingOptions.ambientColor ?? 0xffffff,
      lightingOptions.ambientIntensity ?? 0.6
    );
    this.scene.add(ambientLight);

    // Directional light (sun)
    this.directionalLight = new THREE.DirectionalLight(
      lightingOptions.directionalColor ?? 0xffffff,
      lightingOptions.directionalIntensity ?? 0.8
    );
    this.directionalLight.position.set(50, 50, 25);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.scene.add(this.directionalLight);
  }

  /**
   * Get the DOM element to append to the page
   */
  getDomElement() {
    return this.renderer.domElement;
  }

  /**
   * Enable/disable orbit controls
   */
  setOrbitControls(enabled) {
    this.orbitControls.enabled = enabled;
  }

  /**
   * Update orbit controls (call each frame if enabled)
   */
  updateOrbitControls() {
    if (this.orbitControls.enabled) {
      this.orbitControls.update();
    }
  }

  /**
   * Render the scene
   */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Handle window resize
   */
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Clean up resources
   */
  destroy() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
