/**
 * Vision Pro HDRI Environment
 * High-quality procedural studio environment for reflections
 */

window.VisionProHDRI = class VisionProHDRI {
    constructor(renderer, config) {
        this.renderer = renderer;
        this.config = config;
        this.pmremGenerator = null;
        this.envMap = null;
    }

    /**
     * Load or generate HDRI environment
     * @param {string} url Optional URL to .hdr file
     * @returns {Promise<THREE.Texture>}
     */
    async load(url) {
        // Initialize PMREM generator
        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();

        if (url && this.config.hdri.enabled) {
            try {
                return await this._loadHDRFile(url);
            } catch (error) {
                console.warn('HDRI load failed, using procedural:', error);
            }
        }

        // Fallback to procedural HDRI
        return this.generateProceduralHDRI();
    }

    /**
     * Load .hdr file using RGBELoader
     * @private
     */
    async _loadHDRFile(url) {
        return new Promise((resolve, reject) => {
            if (typeof THREE.RGBELoader === 'undefined') {
                reject(new Error('RGBELoader not available'));
                return;
            }

            const loader = new THREE.RGBELoader();
            loader.load(
                url,
                (texture) => {
                    texture.mapping = THREE.EquirectangularReflectionMapping;
                    this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
                    texture.dispose();
                    resolve(this.envMap);
                },
                undefined,
                reject
            );
        });
    }

    /**
     * Generate high-quality procedural studio HDRI
     * @returns {THREE.Texture}
     */
    generateProceduralHDRI() {
        const resolution = this.config.hdri.resolution || 2048;
        const width = resolution;
        const height = resolution / 2;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            console.error('Failed to get 2D context for HDRI');
            return null;
        }

        // Base dark studio background
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#2a2a32');
        bgGradient.addColorStop(0.3, '#1e1e24');
        bgGradient.addColorStop(0.5, '#18181c');
        bgGradient.addColorStop(0.7, '#141418');
        bgGradient.addColorStop(1, '#0e0e12');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Main softbox light (top center-left)
        this._drawSoftbox(ctx, width * 0.35, height * 0.15, 280, 180, 0.85);

        // Secondary fill light (upper right)
        this._drawSoftbox(ctx, width * 0.72, height * 0.22, 200, 140, 0.45);

        // Rim light (behind, lower)
        this._drawSoftbox(ctx, width * 0.5, height * 0.78, 350, 100, 0.35);

        // Subtle fill lights
        this._drawSoftbox(ctx, width * 0.15, height * 0.45, 120, 200, 0.22);
        this._drawSoftbox(ctx, width * 0.88, height * 0.55, 100, 180, 0.18);

        // Floor reflection gradient
        const floorGradient = ctx.createLinearGradient(0, height * 0.65, 0, height);
        floorGradient.addColorStop(0, 'rgba(40, 42, 50, 0)');
        floorGradient.addColorStop(0.5, 'rgba(35, 37, 44, 0.3)');
        floorGradient.addColorStop(1, 'rgba(30, 32, 38, 0.5)');
        ctx.fillStyle = floorGradient;
        ctx.fillRect(0, height * 0.65, width, height * 0.35);

        // Add subtle noise for realism
        this._addNoise(ctx, width, height, 0.03);

        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;

        // Process through PMREM for proper filtering
        this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
        texture.dispose();

        return this.envMap;
    }

    /**
     * Draw a soft rectangular light source
     * @private
     */
    _drawSoftbox(ctx, x, y, w, h, intensity) {
        // Outer glow
        const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.8);
        outerGlow.addColorStop(0, `rgba(255, 252, 248, ${intensity * 0.15})`);
        outerGlow.addColorStop(0.5, `rgba(255, 252, 248, ${intensity * 0.05})`);
        outerGlow.addColorStop(1, 'rgba(255, 252, 248, 0)');
        ctx.fillStyle = outerGlow;
        ctx.fillRect(x - w, y - h, w * 2, h * 2);

        // Softbox shape (rounded rectangle)
        const cornerRadius = Math.min(w, h) * 0.15;
        ctx.beginPath();
        ctx.moveTo(x - w / 2 + cornerRadius, y - h / 2);
        ctx.lineTo(x + w / 2 - cornerRadius, y - h / 2);
        ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + cornerRadius);
        ctx.lineTo(x + w / 2, y + h / 2 - cornerRadius);
        ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - cornerRadius, y + h / 2);
        ctx.lineTo(x - w / 2 + cornerRadius, y + h / 2);
        ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - cornerRadius);
        ctx.lineTo(x - w / 2, y - h / 2 + cornerRadius);
        ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + cornerRadius, y - h / 2);
        ctx.closePath();

        // Softbox gradient fill
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.6);
        gradient.addColorStop(0, `rgba(255, 253, 250, ${intensity})`);
        gradient.addColorStop(0.4, `rgba(255, 252, 248, ${intensity * 0.7})`);
        gradient.addColorStop(0.7, `rgba(248, 246, 244, ${intensity * 0.4})`);
        gradient.addColorStop(1, `rgba(240, 238, 236, ${intensity * 0.15})`);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    /**
     * Add subtle noise to the HDRI
     * @private
     */
    _addNoise(ctx, width, height, amount) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * amount * 255;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Dispose resources
     */
    dispose() {
        if (this.pmremGenerator) {
            this.pmremGenerator.dispose();
        }
        if (this.envMap) {
            this.envMap.dispose();
        }
    }
};
