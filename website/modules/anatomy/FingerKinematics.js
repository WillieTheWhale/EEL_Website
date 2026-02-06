/**
 * FingerKinematics.js
 * Hierarchical kinematic structure for realistic finger articulation
 *
 * Provides parent-child bone relationships for natural wave propagation
 * during swimming animation.
 *
 * Requires: THREE.js must be loaded before this module.
 */

// Ensure THREE.js is loaded
if (typeof THREE === 'undefined') {
    console.error('FingerKinematics requires THREE.js to be loaded first');
}

/**
 * Represents a single bone segment (phalanx) in a finger
 */
class Phalanx {
    constructor(name, length, width) {
        this.name = name;
        this.group = new THREE.Group();
        this.group.name = `phalanx_${name}`;
        this.length = length;
        this.width = width;
        this.meshes = [];

        // Store base rotation (rest pose) - explicit rotation order
        this.baseRotation = new THREE.Euler(0, 0, 0, 'XYZ');

        // Animation state
        this.currentRotation = new THREE.Euler(0, 0, 0, 'XYZ');

        // Track spread rotation separately
        this.spreadRotation = 0;
    }

    /**
     * Add a mesh to this phalanx
     */
    addMesh(mesh) {
        this.meshes.push(mesh);
        this.group.add(mesh);
    }

    /**
     * Set the base (rest) rotation
     */
    setBaseRotation(x, y, z) {
        this.baseRotation.set(x, y, z, 'XYZ');
        this.group.rotation.set(x, y, z, 'XYZ');
    }

    /**
     * Apply animation rotation on top of base rotation
     * @param {number} x - X rotation (curl/extension)
     * @param {number} y - Y rotation (side-to-side)
     * @param {number} z - Z rotation (twist)
     */
    applyAnimationRotation(x, y, z) {
        this.currentRotation.set(x, y, z, 'XYZ');
        this.group.rotation.set(
            this.baseRotation.x + x,
            this.baseRotation.y + y,
            this.baseRotation.z + z + this.spreadRotation,
            'XYZ'
        );
    }

    /**
     * Set spread rotation (finger separation)
     * @param {number} z - Z rotation for spread
     */
    setSpreadRotation(z) {
        this.spreadRotation = z;
    }

    /**
     * Get the end position of this bone (for attaching next bone)
     */
    getEndPosition() {
        return new THREE.Vector3(0, this.length, 0);
    }

    /**
     * Dispose of GPU resources (geometries and materials)
     */
    dispose() {
        this.meshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
        this.meshes = [];
    }
}

/**
 * Represents a complete finger as a kinematic chain
 * Parent-child hierarchy enables natural transform cascading
 */
class FingerChain {
    constructor(fingerName, fingerData, scale, materials, geometryBuilders) {
        this.name = fingerName;
        this.scale = scale;
        this.phalanges = [];
        this.root = new THREE.Group();
        this.root.name = `finger_${fingerName}_root`;

        // Store references for animation
        this.fingerData = fingerData;

        // Build the kinematic chain
        this._buildChain(fingerData, scale, materials, geometryBuilders);
    }

    /**
     * Build hierarchical bone structure
     * Structure: root -> proximal -> middle -> distal
     */
    _buildChain(data, S, materials, builders) {
        const lens = data.len.map(l => l * S);
        const w = data.w * S;

        // Create phalanges
        const proximal = new Phalanx('proximal', lens[0], w);
        const middle = new Phalanx('middle', lens[1], w * 0.88);
        const distal = new Phalanx('distal', lens[2], w * 0.80);

        // Build geometry for each phalanx
        this._buildProximalPhalanx(proximal, lens[0], w, materials, builders);
        this._buildMiddlePhalanx(middle, lens[1], w, materials, builders);
        this._buildDistalPhalanx(distal, lens[2], w, materials, builders);

        // Create hierarchical structure
        // Position middle at end of proximal
        middle.group.position.y = lens[0] + w * 0.22;  // Account for PIP joint

        // Position distal at end of middle
        distal.group.position.y = lens[1] + w * 0.18;  // Account for DIP joint

        // Build hierarchy: root -> proximal -> middle -> distal
        proximal.group.add(middle.group);
        middle.group.add(distal.group);
        this.root.add(proximal.group);

        // Store references
        this.phalanges = [proximal, middle, distal];

        // Calculate total length
        this.totalLength = lens[0] + lens[1] + lens[2] + w * 0.40;
        this.baseWidth = w;
    }

    /**
     * Build proximal phalanx geometry
     */
    _buildProximalPhalanx(phalanx, length, w, materials, builders) {
        const { matMain, matLight, matFlesh, matGlow } = materials;

        // Main bone geometry
        const proxGeo = builders.createBone(length, w, w * 0.88, false);
        const proxMain = new THREE.Mesh(proxGeo, matMain.clone());
        phalanx.addMesh(proxMain);

        // Wireframe overlay
        const proxWire = new THREE.Mesh(proxGeo.clone(), matLight.clone());
        proxWire.scale.set(1.02, 1, 1.02);
        phalanx.addMesh(proxWire);

        // Inner flesh glow
        const proxFlesh = new THREE.Mesh(proxGeo.clone(), matFlesh.clone());
        proxFlesh.scale.set(0.92, 0.98, 0.92);
        phalanx.addMesh(proxFlesh);

        // PIP Joint at end of proximal (will be at y = length)
        const pipGeo = builders.createJoint(w * 0.42);
        const pip = new THREE.Mesh(pipGeo, matLight.clone());
        pip.position.y = length;
        phalanx.addMesh(pip);

        // Joint glow
        const pipGlow = new THREE.Mesh(pipGeo.clone(), matGlow.clone());
        pipGlow.position.y = length;
        pipGlow.scale.set(1.15, 1.1, 1.15);
        phalanx.addMesh(pipGlow);
    }

    /**
     * Build middle phalanx geometry
     */
    _buildMiddlePhalanx(phalanx, length, w, materials, builders) {
        const { matMain, matLight, matFlesh, matGlow } = materials;

        // Main bone
        const midGeo = builders.createBone(length, w * 0.88, w * 0.80, false);
        const mid = new THREE.Mesh(midGeo, matMain.clone());
        phalanx.addMesh(mid);

        // Wireframe overlay
        const midWire = new THREE.Mesh(midGeo.clone(), matLight.clone());
        midWire.scale.set(1.02, 1, 1.02);
        phalanx.addMesh(midWire);

        // Inner flesh
        const midFlesh = new THREE.Mesh(midGeo.clone(), matFlesh.clone());
        midFlesh.scale.set(0.92, 0.98, 0.92);
        phalanx.addMesh(midFlesh);

        // DIP Joint at end
        const dipGeo = builders.createJoint(w * 0.36);
        const dip = new THREE.Mesh(dipGeo, matLight.clone());
        dip.position.y = length;
        phalanx.addMesh(dip);

        // DIP glow
        const dipGlow = new THREE.Mesh(dipGeo.clone(), matGlow.clone());
        dipGlow.position.y = length;
        dipGlow.scale.set(1.15, 1.1, 1.15);
        phalanx.addMesh(dipGlow);
    }

    /**
     * Build distal phalanx (fingertip) geometry
     */
    _buildDistalPhalanx(phalanx, length, w, materials, builders) {
        const { matMain, matLight, matFlesh } = materials;

        // Fingertip
        const tipGeo = builders.createTip(length, w * 0.80);
        const tip = new THREE.Mesh(tipGeo, matMain.clone());
        phalanx.addMesh(tip);

        // Wireframe overlay
        const tipWire = new THREE.Mesh(tipGeo.clone(), matLight.clone());
        tipWire.scale.set(1.02, 1, 1.02);
        phalanx.addMesh(tipWire);

        // Inner flesh
        const tipFlesh = new THREE.Mesh(tipGeo.clone(), matFlesh.clone());
        tipFlesh.scale.set(0.92, 0.98, 0.92);
        phalanx.addMesh(tipFlesh);

        // Fingernail
        const nailGeo = builders.createNail(w * 0.55, length * 0.58);
        const nail = new THREE.Mesh(nailGeo, matLight.clone());
        nail.position.set(0, length * 0.26, -w * 0.32);
        phalanx.addMesh(nail);
    }

    /**
     * Get a specific phalanx by index
     * @param {number} index - 0=proximal, 1=middle, 2=distal
     */
    getPhalanx(index) {
        return this.phalanges[index];
    }

    /**
     * Get proximal (base) phalanx
     */
    getProximal() {
        return this.phalanges[0];
    }

    /**
     * Get middle phalanx
     */
    getMiddle() {
        return this.phalanges[1];
    }

    /**
     * Get distal (tip) phalanx
     */
    getDistal() {
        return this.phalanges[2];
    }

    /**
     * Dispose of GPU resources
     */
    dispose() {
        this.phalanges.forEach(phalanx => phalanx.dispose());
    }
}

/**
 * Represents a thumb kinematic chain (3 joints instead of 4)
 * CMC -> MCP -> IP (distal)
 */
class ThumbChain {
    constructor(thumbData, scale, materials, geometryBuilders) {
        this.name = 'thumb';
        this.scale = scale;
        this.phalanges = [];
        this.root = new THREE.Group();
        this.root.name = 'finger_thumb_root';

        this._buildChain(thumbData, scale, materials, geometryBuilders);
    }

    _buildChain(TD, S, materials, builders) {
        const meta = TD.metacarpal * S;
        const prox = TD.proximal * S;
        const dist = TD.distal * S;
        const w = TD.width * S;

        // Create phalanges
        const metacarpal = new Phalanx('metacarpal', meta, w * 1.15);
        const proximal = new Phalanx('proximal', prox, w * 0.95);
        const distal = new Phalanx('distal', dist, w * 0.85);

        // Build geometry
        this._buildMetacarpal(metacarpal, meta, w, materials, builders);
        this._buildProximal(proximal, prox, w, meta, materials, builders);
        this._buildDistal(distal, dist, w, materials, builders);

        // Create hierarchical structure
        proximal.group.position.y = meta + w * 0.24;  // MCP joint offset
        distal.group.position.y = prox + w * 0.20;    // IP joint offset

        metacarpal.group.add(proximal.group);
        proximal.group.add(distal.group);
        this.root.add(metacarpal.group);

        this.phalanges = [metacarpal, proximal, distal];
        this.totalLength = meta + prox + dist + w * 0.44;
        this.baseWidth = w;
    }

    _buildMetacarpal(phalanx, length, w, materials, builders) {
        const { matMain, matLight, matFlesh, matGlow } = materials;

        const metaGeo = builders.createBone(length, w * 1.15, w * 0.95, false);
        phalanx.addMesh(new THREE.Mesh(metaGeo, matMain.clone()));

        const metaWire = new THREE.Mesh(metaGeo.clone(), matLight.clone());
        metaWire.scale.set(1.02, 1, 1.02);
        phalanx.addMesh(metaWire);

        const metaFlesh = new THREE.Mesh(metaGeo.clone(), matFlesh.clone());
        metaFlesh.scale.set(0.92, 0.98, 0.92);
        phalanx.addMesh(metaFlesh);

        // MCP joint at end
        const mcpGeo = builders.createJoint(w * 0.48);
        const mcp = new THREE.Mesh(mcpGeo, matLight.clone());
        mcp.position.y = length;
        phalanx.addMesh(mcp);

        const mcpGlow = new THREE.Mesh(mcpGeo.clone(), matGlow.clone());
        mcpGlow.position.y = length;
        mcpGlow.scale.set(1.18, 1.1, 1.18);
        phalanx.addMesh(mcpGlow);
    }

    _buildProximal(phalanx, length, w, metaLen, materials, builders) {
        const { matMain, matLight, matFlesh, matGlow } = materials;

        const proxGeo = builders.createBone(length, w * 0.95, w * 0.85, false);
        phalanx.addMesh(new THREE.Mesh(proxGeo, matMain.clone()));

        const proxWire = new THREE.Mesh(proxGeo.clone(), matLight.clone());
        proxWire.scale.set(1.02, 1, 1.02);
        phalanx.addMesh(proxWire);

        const proxFlesh = new THREE.Mesh(proxGeo.clone(), matFlesh.clone());
        proxFlesh.scale.set(0.92, 0.98, 0.92);
        phalanx.addMesh(proxFlesh);

        // IP joint
        const ipGeo = builders.createJoint(w * 0.40);
        const ip = new THREE.Mesh(ipGeo, matLight.clone());
        ip.position.y = length;
        phalanx.addMesh(ip);

        const ipGlow = new THREE.Mesh(ipGeo.clone(), matGlow.clone());
        ipGlow.position.y = length;
        ipGlow.scale.set(1.15, 1.1, 1.15);
        phalanx.addMesh(ipGlow);
    }

    _buildDistal(phalanx, length, w, materials, builders) {
        const { matMain, matLight, matFlesh } = materials;

        const tipGeo = builders.createTip(length, w * 0.85);
        phalanx.addMesh(new THREE.Mesh(tipGeo, matMain.clone()));

        const tipWire = new THREE.Mesh(tipGeo.clone(), matLight.clone());
        tipWire.scale.set(1.02, 1, 1.02);
        phalanx.addMesh(tipWire);

        const tipFlesh = new THREE.Mesh(tipGeo.clone(), matFlesh.clone());
        tipFlesh.scale.set(0.92, 0.98, 0.92);
        phalanx.addMesh(tipFlesh);

        // Thumbnail
        const nailGeo = builders.createNail(w * 0.62, length * 0.58);
        const nail = new THREE.Mesh(nailGeo, matLight.clone());
        nail.position.set(0, length * 0.24, -w * 0.38);
        phalanx.addMesh(nail);
    }

    getPhalanx(index) {
        return this.phalanges[index];
    }

    /**
     * Dispose of GPU resources
     */
    dispose() {
        this.phalanges.forEach(phalanx => phalanx.dispose());
    }
}

// Expose globally
window.Phalanx = Phalanx;
window.FingerChain = FingerChain;
window.ThumbChain = ThumbChain;
