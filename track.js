import * as THREE from 'three';;

export class Track {
  constructor(scene, mode = "prototype") {
    this.scene = scene;
    this.mode = mode;

    this.boostPads = [];
    this.startLine = null;
    this.startBox = null;

    this._makeGround();
    this._makeRoad();
    this._makeWalls();
    this._makeBoosts();
    this._makeLights();
    this._makeStartLine();
  }

  _makeGround() {
    const geom = new THREE.PlaneGeometry(200, 200);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x225522,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    this.scene.add(mesh);
  }

  _makeRoad() {
    const geom = new THREE.PlaneGeometry(20, 100);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.z = -20;
    this.scene.add(mesh);
  }

  _makeWalls() {
    const wallGeom = new THREE.BoxGeometry(1, 2, 100);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });

    const left = new THREE.Mesh(wallGeom, mat);
    left.position.set(-10.5, 1, -20);

    const right = new THREE.Mesh(wallGeom, mat);
    right.position.set(10.5, 1, -20);

    this.scene.add(left);
    this.scene.add(right);
  }

  _makeBoosts() {
    const geom = new THREE.PlaneGeometry(4, 4);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      emissive: 0x007777
    });

    const zPositions = [-40, -60];
    for (const z of zPositions) {
      const pad = new THREE.Mesh(geom, mat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(0, 0.06, z);
      this.scene.add(pad);

      const box = new THREE.Box3().setFromObject(pad);
      this.boostPads.push({ mesh: pad, box });
    }
  }

  _makeLights() {
    const amb = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(amb);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(30, 50, 10);
    this.scene.add(dir);
  }

  _makeStartLine() {
    const geom = new THREE.BoxGeometry(6, 0.1, 0.5);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333
    });

    this.startLine = new THREE.Mesh(geom, mat);
    this.startLine.position.set(0, 0.07, -20);
    this.scene.add(this.startLine);

    this.startBox = new THREE.Box3().setFromObject(this.startLine);
  }
}
