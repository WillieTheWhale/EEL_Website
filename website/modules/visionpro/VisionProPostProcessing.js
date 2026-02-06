/**
 * Vision Pro Post-Processing
 * Bloom, SSAO, and output pass for photorealistic rendering
 */

window.VisionProPostProcessing = class VisionProPostProcessing {
    constructor(renderer, scene, camera, config) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.config = config;
        this.composer = null;
        this.passes = {};
    }

    /**
     * Setup post-processing pipeline
     * @returns {THREE.EffectComposer|null}
     */
    setupPasses() {
        const pp = this.config.postProcessing;

        if (!pp.enabled) {
            return null;
        }

        // Check if EffectComposer is available
        if (typeof THREE.EffectComposer === 'undefined') {
            console.warn('EffectComposer not loaded. Post-processing disabled.');
            return null;
        }

        // Create composer
        this.composer = new THREE.EffectComposer(this.renderer);

        // 1. Render pass (base scene)
        if (typeof THREE.RenderPass !== 'undefined') {
            this.passes.render = new THREE.RenderPass(this.scene, this.camera);
            this.composer.addPass(this.passes.render);
        } else {
            console.warn('RenderPass not available');
            return null;
        }

        // 2. SSAO pass (ambient occlusion)
        if (pp.ssao.enabled && typeof THREE.SSAOPass !== 'undefined') {
            this.passes.ssao = new THREE.SSAOPass(
                this.scene,
                this.camera,
                this.renderer.domElement.width,
                this.renderer.domElement.height
            );
            this.passes.ssao.kernelRadius = pp.ssao.kernelRadius;
            this.passes.ssao.minDistance = pp.ssao.minDistance;
            this.passes.ssao.maxDistance = pp.ssao.maxDistance;
            this.composer.addPass(this.passes.ssao);
        }

        // 3. Bloom pass (glass highlights)
        if (pp.bloom.enabled && typeof THREE.UnrealBloomPass !== 'undefined') {
            this.passes.bloom = new THREE.UnrealBloomPass(
                new THREE.Vector2(
                    this.renderer.domElement.width,
                    this.renderer.domElement.height
                ),
                pp.bloom.strength,
                pp.bloom.radius,
                pp.bloom.threshold
            );
            this.composer.addPass(this.passes.bloom);
        }

        // 4. Output pass or FXAA
        if (typeof THREE.OutputPass !== 'undefined') {
            this.passes.output = new THREE.OutputPass();
            this.composer.addPass(this.passes.output);
        } else if (typeof THREE.ShaderPass !== 'undefined' && typeof THREE.GammaCorrectionShader !== 'undefined') {
            // Fallback to gamma correction shader
            this.passes.gamma = new THREE.ShaderPass(THREE.GammaCorrectionShader);
            this.composer.addPass(this.passes.gamma);
        }

        return this.composer;
    }

    /**
     * Get the composer for rendering
     * @returns {THREE.EffectComposer|null}
     */
    getComposer() {
        return this.composer;
    }

    /**
     * Update pass parameters
     * @param {string} passName Pass name ('bloom', 'ssao')
     * @param {Object} params New parameters
     */
    updatePass(passName, params) {
        const pass = this.passes[passName];
        if (!pass) return;

        if (passName === 'bloom') {
            if (params.strength !== undefined) pass.strength = params.strength;
            if (params.radius !== undefined) pass.radius = params.radius;
            if (params.threshold !== undefined) pass.threshold = params.threshold;
        } else if (passName === 'ssao') {
            if (params.kernelRadius !== undefined) pass.kernelRadius = params.kernelRadius;
            if (params.minDistance !== undefined) pass.minDistance = params.minDistance;
            if (params.maxDistance !== undefined) pass.maxDistance = params.maxDistance;
        }
    }

    /**
     * Resize all passes
     * @param {number} width New width
     * @param {number} height New height
     */
    setSize(width, height) {
        if (this.composer) {
            this.composer.setSize(width, height);
        }

        if (this.passes.ssao) {
            this.passes.ssao.setSize(width, height);
        }

        if (this.passes.bloom) {
            this.passes.bloom.setSize(width, height);
        }
    }

    /**
     * Render using the composer
     */
    render() {
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Dispose all passes
     */
    dispose() {
        Object.values(this.passes).forEach(pass => {
            if (pass.dispose) pass.dispose();
        });

        if (this.composer) {
            this.composer.dispose();
        }
    }
};
