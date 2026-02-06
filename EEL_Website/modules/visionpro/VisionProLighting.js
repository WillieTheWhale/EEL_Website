/**
 * Vision Pro Lighting System
 * HDRI environment with shadow-casting studio lights
 */

window.VisionProLighting = class VisionProLighting {
    constructor(scene, renderer, config) {
        this.scene = scene;
        this.renderer = renderer;
        this.config = config;
        this.lights = {};
        this.envMap = null;
        this.hdriLoader = null;
    }

    /**
     * Setup complete lighting system with HDRI
     * @returns {Promise<THREE.Texture>} Environment map for materials
     */
    async setup() {
        // 1. Enable physically correct lights
        this.renderer.physicallyCorrectLights = true;

        // 2. Load HDRI environment
        this.hdriLoader = new VisionProHDRI(this.renderer, this.config);
        this.envMap = await this.hdriLoader.load(this.config.hdri.path);

        // Set as scene environment
        this.scene.environment = this.envMap;

        // 3. Setup shadow-casting studio lights
        this._setupStudioLights();

        // 4. Configure shadow mapping
        this._configureShadows();

        // 5. Configure tone mapping
        this._configureToneMapping();

        return this.envMap;
    }

    /**
     * Setup multi-light studio configuration WITH SHADOWS
     * @private
     */
    _setupStudioLights() {
        const l = this.config.lighting;
        const s = this.config.shadows;

        // Ambient base light (reduced since HDRI provides ambient)
        this.lights.ambient = new THREE.AmbientLight(
            l.ambient.color,
            l.ambient.intensity
        );
        this.scene.add(this.lights.ambient);

        // Key light (main illumination with shadows)
        this.lights.key = new THREE.DirectionalLight(
            l.keyLight.color,
            l.keyLight.intensity
        );
        this.lights.key.position.set(...l.keyLight.position);

        if (s.enabled) {
            this.lights.key.castShadow = true;
            this.lights.key.shadow.mapSize.width = s.mapSize;
            this.lights.key.shadow.mapSize.height = s.mapSize;
            this.lights.key.shadow.camera.near = 0.5;
            this.lights.key.shadow.camera.far = 50;
            this.lights.key.shadow.camera.left = -3;
            this.lights.key.shadow.camera.right = 3;
            this.lights.key.shadow.camera.top = 3;
            this.lights.key.shadow.camera.bottom = -3;
            this.lights.key.shadow.bias = s.bias;
            this.lights.key.shadow.normalBias = s.normalBias;
        }
        this.scene.add(this.lights.key);

        // Fill light (softer, from left)
        this.lights.fill = new THREE.DirectionalLight(
            l.fillLight.color,
            l.fillLight.intensity
        );
        this.lights.fill.position.set(...l.fillLight.position);

        if (s.enabled) {
            this.lights.fill.castShadow = true;
            this.lights.fill.shadow.mapSize.width = s.mapSize / 2;
            this.lights.fill.shadow.mapSize.height = s.mapSize / 2;
            this.lights.fill.shadow.bias = s.bias;
        }
        this.scene.add(this.lights.fill);

        // Rim light (edge definition from behind)
        this.lights.rim = new THREE.DirectionalLight(
            l.rimLight.color,
            l.rimLight.intensity
        );
        this.lights.rim.position.set(...l.rimLight.position);
        this.scene.add(this.lights.rim);

        // Bottom fill (subtle uplighting)
        this.lights.bottom = new THREE.DirectionalLight(
            l.bottomFill.color,
            l.bottomFill.intensity
        );
        this.lights.bottom.position.set(...l.bottomFill.position);
        this.scene.add(this.lights.bottom);
    }

    /**
     * Configure renderer shadow mapping
     * @private
     */
    _configureShadows() {
        const s = this.config.shadows;
        if (s.enabled) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
    }

    /**
     * Configure renderer tone mapping
     * @private
     */
    _configureToneMapping() {
        const l = this.config.lighting;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = l.toneMappingExposure;
        // Use colorSpace for modern Three.js compatibility
        if (this.renderer.outputColorSpace !== undefined) {
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        } else {
            this.renderer.outputEncoding = THREE.sRGBEncoding;
        }
    }

    /**
     * Get environment map
     * @returns {THREE.Texture}
     */
    getEnvMap() {
        return this.envMap;
    }

    /**
     * Update light intensity
     * @param {string} lightName Name of light to update
     * @param {number} intensity New intensity value
     */
    setLightIntensity(lightName, intensity) {
        if (this.lights[lightName]) {
            this.lights[lightName].intensity = intensity;
        }
    }

    /**
     * Dispose all lights and resources
     */
    dispose() {
        Object.values(this.lights).forEach(light => {
            this.scene.remove(light);
            if (light.dispose) light.dispose();
        });

        if (this.hdriLoader) {
            this.hdriLoader.dispose();
        }

        if (this.envMap) {
            this.envMap.dispose();
        }
    }
};
