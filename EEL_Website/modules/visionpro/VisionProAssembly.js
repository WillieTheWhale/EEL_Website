/**
 * Vision Pro Assembly
 * Main orchestration class with ASYNC build and post-processing
 */

window.VisionProAssembly = class VisionProAssembly {
    constructor(scene, renderer, config, camera) {
        this.scene = scene;
        this.renderer = renderer;
        this.config = config || window.VISION_PRO_CONFIG;
        this.camera = camera;

        this.group = new THREE.Group();
        this.components = {};
        this.materials = null;
        this.lighting = null;
        this.geometry = null;
        this.postProcessing = null;
        this.composer = null;
    }

    /**
     * Build the complete Vision Pro model (ASYNC)
     * @returns {Promise<THREE.Group>} The assembled model
     */
    async build() {
        // 1. Setup lighting and get environment map (ASYNC)
        this.lighting = new VisionProLighting(this.scene, this.renderer, this.config);
        const envMap = await this.lighting.setup();

        // 2. Initialize materials with environment map
        this.materials = new VisionProMaterials(this.config, envMap);

        // 3. Initialize geometry builder
        this.geometry = new VisionProGeometry(this.config);

        // 4. Build all components
        this._buildComponents();

        // 5. Apply materials to all components
        this._applyMaterials();

        // 6. Enable shadows on meshes
        this._enableShadows();

        // 7. Setup post-processing
        this._setupPostProcessing();

        // 8. Position for marketing angle
        this._positionForMarketingAngle();

        // 9. Add to scene
        this.scene.add(this.group);

        return this.group;
    }

    /**
     * Build all geometry components
     * @private
     */
    _buildComponents() {
        // Build order: back to front for proper depth

        // 1. Headband (furthest back)
        this.components.headband = this.geometry.createHeadband();
        this.group.add(this.components.headband);

        // 2. Light Seal (behind housing)
        this.components.lightSeal = this.geometry.createLightSeal();
        this.group.add(this.components.lightSeal);

        // 3. Aluminum housing
        this.components.housing = this.geometry.createAluminumHousing();
        this.group.add(this.components.housing);

        // 4. Audio straps (sides)
        this.components.audioStraps = this.geometry.createAudioStraps();
        this.group.add(this.components.audioStraps);

        // 5. Glass visor (front)
        const visorGeom = this.geometry.createGlassVisor();
        this.components.visor = new THREE.Mesh(visorGeom, null);
        this.components.visor.userData.material = 'glass';
        this.group.add(this.components.visor);

        // 6. Digital crown (top right)
        this.components.crown = this.geometry.createDigitalCrown();
        this.group.add(this.components.crown);

        // 7. Camera button (top left)
        this.components.button = this.geometry.createCameraButton();
        this.group.add(this.components.button);
    }

    /**
     * Apply materials to all components
     * @private
     */
    _applyMaterials() {
        // Apply to simple meshes
        if (this.components.visor) {
            this.components.visor.material = this.materials.getMaterial('glass');
        }

        // Apply to groups
        const groupComponents = [
            'housing',
            'lightSeal',
            'crown',
            'button',
            'audioStraps',
            'headband'
        ];

        groupComponents.forEach(name => {
            if (this.components[name]) {
                this._applyMaterialsToGroup(this.components[name]);
            }
        });
    }

    /**
     * Recursively apply materials to group children
     * @private
     */
    _applyMaterialsToGroup(group) {
        group.traverse(node => {
            if (node.isMesh) {
                const matName = node.userData.material || 'aluminum';
                node.material = this.materials.getMaterial(matName);
            }
        });
    }

    /**
     * Enable shadow casting/receiving on all meshes
     * @private
     */
    _enableShadows() {
        const shadowConfig = this.config.shadows;
        if (!shadowConfig || !shadowConfig.enabled) return;

        this.group.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
    }

    /**
     * Setup post-processing pipeline
     * @private
     */
    _setupPostProcessing() {
        if (!this.camera) {
            console.warn('Camera not provided, skipping post-processing');
            return;
        }

        this.postProcessing = new VisionProPostProcessing(
            this.renderer,
            this.scene,
            this.camera,
            this.config
        );
        this.composer = this.postProcessing.setupPasses();
    }

    /**
     * Position model at Apple's marketing 3/4 angle
     * @private
     */
    _positionForMarketingAngle() {
        const angle = this.config.camera.marketingAngle;
        this.group.rotation.y = angle.rotationY;
        this.group.rotation.x = angle.rotationX;
    }

    /**
     * Get the assembled group
     * @returns {THREE.Group}
     */
    getGroup() {
        return this.group;
    }

    /**
     * Get a specific component
     * @param {string} name Component name
     * @returns {THREE.Object3D}
     */
    getComponent(name) {
        return this.components[name];
    }

    /**
     * Get the post-processing composer
     * @returns {THREE.EffectComposer|null}
     */
    getComposer() {
        return this.composer;
    }

    /**
     * Render using composer or fallback to standard render
     */
    render() {
        if (this.postProcessing) {
            this.postProcessing.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Update model rotation
     * @param {number} deltaX X rotation delta
     * @param {number} deltaY Y rotation delta
     */
    rotate(deltaX, deltaY) {
        this.group.rotation.y += deltaX;
        this.group.rotation.x += deltaY;
        // Clamp X rotation
        this.group.rotation.x = Math.max(-0.5, Math.min(0.5, this.group.rotation.x));
    }

    /**
     * Reset to marketing angle
     */
    resetRotation() {
        const angle = this.config.camera.marketingAngle;
        this.group.rotation.y = angle.rotationY;
        this.group.rotation.x = angle.rotationX;
    }

    /**
     * Handle window resize
     * @param {number} width New width
     * @param {number} height New height
     */
    resize(width, height) {
        if (this.postProcessing) {
            this.postProcessing.setSize(width, height);
        }
    }

    /**
     * Dispose all resources
     */
    dispose() {
        // Dispose geometries
        this.group.traverse(node => {
            if (node.geometry) {
                node.geometry.dispose();
            }
        });

        // Dispose materials
        if (this.materials) {
            this.materials.dispose();
        }

        // Dispose lighting
        if (this.lighting) {
            this.lighting.dispose();
        }

        // Dispose post-processing
        if (this.postProcessing) {
            this.postProcessing.dispose();
        }

        // Remove from scene
        this.scene.remove(this.group);
    }
};
