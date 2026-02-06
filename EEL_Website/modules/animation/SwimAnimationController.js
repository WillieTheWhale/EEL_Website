/**
 * SwimAnimationController.js
 * Orchestrates smooth swimming animation with wave propagation
 *
 * Provides composable animation controllers for realistic finger motion
 *
 * Requires: THREE.js and FingerKinematics.js must be loaded before this module.
 */

/**
 * Easing functions for smooth transitions
 */
const AnimationEasing = {
    // Smooth cubic interpolation
    smoothstep: (x) => x * x * (3 - 2 * x),

    // Smoother quintic interpolation
    smootherstep: (x) => x * x * x * (x * (x * 6 - 15) + 10),

    // Ease in-out cubic
    easeInOutCubic: (x) => x < 0.5
        ? 4 * x * x * x
        : 1 - Math.pow(-2 * x + 2, 3) / 2,

    // Power curve for natural motion
    powerCurve: (x, power) => Math.pow(x, power)
};

/**
 * Animates a single joint (phalanx) with wave-like motion
 */
class JointAnimator {
    constructor(phalanx, config) {
        this.phalanx = phalanx;
        this.phaseOffset = config.phaseOffset || 0;
        this.amplitudeMultiplier = config.amplitudeMultiplier || 1.0;
        this.axis = config.axis || 'x';

        // Secondary motion parameters
        this.secondaryAmplitude = config.secondaryAmplitude || 0;
        this.secondaryFrequency = config.secondaryFrequency || 1;
    }

    /**
     * Update joint rotation for current animation frame
     * @param {number} swimPhase - Main swimming phase
     * @param {number} baseCurl - Base curl amount for this frame
     * @param {number} deltaTime - Time since last frame
     */
    update(swimPhase, baseCurl, deltaTime) {
        // Calculate phase with offset for wave propagation
        const phase = swimPhase + this.phaseOffset;

        // Main curl rotation (x-axis)
        const curlRotation = baseCurl * this.amplitudeMultiplier;

        // Add subtle wave overlay for organic feel
        const waveOverlay = Math.sin(phase * 1.5) * 0.015 * this.amplitudeMultiplier;

        // Secondary motion (subtle y/z sway)
        const secondaryY = Math.sin(phase * this.secondaryFrequency) * this.secondaryAmplitude;
        const secondaryZ = Math.sin(phase * 0.7) * this.secondaryAmplitude * 0.5;

        // Apply to phalanx
        this.phalanx.applyAnimationRotation(
            curlRotation + waveOverlay,
            secondaryY,
            secondaryZ
        );
    }
}

/**
 * Controls wave propagation across a finger's joints
 */
class WavePropagationController {
    constructor(fingerChain, config) {
        this.fingerChain = fingerChain;
        this.animators = [];
        this.config = config;

        this._initializeAnimators(config);
    }

    _initializeAnimators(config) {
        const waveCfg = config.wavePropagation;
        const ampCurve = waveCfg.amplitudeCurve;

        // Create animator for each phalanx with increasing phase delay
        this.fingerChain.phalanges.forEach((phalanx, i) => {
            const animator = new JointAnimator(phalanx, {
                phaseOffset: i * waveCfg.phaseDelay,
                amplitudeMultiplier: ampCurve[i] || ampCurve[ampCurve.length - 1],
                axis: 'x',
                secondaryAmplitude: config.secondaryMotion?.enabled
                    ? config.secondaryMotion.yAxisAmplitude * (1 - i * 0.3)
                    : 0,
                secondaryFrequency: config.secondaryMotion?.yAxisFrequency || 0.9
            });
            this.animators.push(animator);
        });
    }

    /**
     * Update all joints in this finger
     * @param {number} swimPhase - Main swimming phase
     * @param {number} baseCurl - Base curl for this finger
     * @param {number} deltaTime - Frame delta
     */
    update(swimPhase, baseCurl, deltaTime) {
        this.animators.forEach(animator => {
            animator.update(swimPhase, baseCurl, deltaTime);
        });
    }
}

/**
 * Controls spread animation (finger separation)
 */
class SpreadController {
    constructor(fingerChain, fingerIndex, totalFingers) {
        this.fingerChain = fingerChain;
        // Offset from center (-1.5 to 1.5 for 4 fingers)
        this.spreadOffset = fingerIndex - (totalFingers - 1) / 2;
    }

    /**
     * Update finger spread
     * @param {number} spreadAmount - Current spread amount
     */
    update(spreadAmount) {
        const proximal = this.fingerChain.getProximal();
        if (proximal) {
            // Use the proper spread rotation method to integrate with animation system
            proximal.setSpreadRotation(this.spreadOffset * spreadAmount);
        }
    }
}

/**
 * Main orchestrator for the entire hand animation
 */
class SwimAnimationController {
    constructor(handStructure, config) {
        this.hand = handStructure;
        this.config = config || window.SWIM_ANIMATION_CONFIG;
        this.fingerControllers = new Map();
        this.spreadControllers = new Map();

        // Animation state
        this.swimPhase = 0;
        this.fluidTime = 0;

        // Initialize if finger chains are available
        if (handStructure.userData.fingerChains) {
            this._initializeControllers();
        }
    }

    _initializeControllers() {
        const chains = this.hand.userData.fingerChains;
        const fingerNames = ['index', 'middle', 'ring', 'pinky'];

        // Create controllers for each finger
        fingerNames.forEach((name, idx) => {
            if (chains[name]) {
                // Wave propagation controller
                this.fingerControllers.set(name, new WavePropagationController(
                    chains[name],
                    this.config
                ));

                // Spread controller
                this.spreadControllers.set(name, new SpreadController(
                    chains[name],
                    idx,
                    fingerNames.length
                ));
            }
        });

        // Thumb has different animation
        if (chains.thumb) {
            this.fingerControllers.set('thumb', new WavePropagationController(
                chains.thumb,
                {
                    ...this.config,
                    wavePropagation: {
                        ...this.config.wavePropagation,
                        phaseDelay: this.config.wavePropagation.phaseDelay * 0.7,
                        amplitudeCurve: [0.50, 0.35, 0.15]  // Different distribution for thumb
                    }
                }
            ));
            // Store base rotation for thumb opposition animation
            chains.thumb.root.userData = chains.thumb.root.userData || {};
            chains.thumb.root.userData.baseRotY = chains.thumb.root.rotation.y || -0.48;
        }
    }

    /**
     * Main update method - called each animation frame
     * @param {number} deltaTime - Time since last frame
     * @param {number} time - Total elapsed time
     */
    update(deltaTime, time) {
        // Update phases
        const PHI = 1.618033988749;
        this.swimPhase += deltaTime * PHI * this.config.cycleMultiplier;
        this.fluidTime += deltaTime;

        // Calculate swimming motion values
        const strokePhase = Math.sin(this.swimPhase);
        const strokeIntensity = Math.abs(strokePhase);
        const isPowerPhase = strokePhase > 0;
        const powerIntensity = isPowerPhase ? strokePhase : 0;

        // Smooth transition between power and recovery using easing
        const powerRamp = AnimationEasing.smoothstep((strokePhase + 1) / 2);

        // Calculate base curl with smooth transitions
        this._updateFingers(strokePhase, strokeIntensity, isPowerPhase, powerRamp, deltaTime);

        // Update spread
        this._updateSpread(strokePhase, isPowerPhase, strokeIntensity);

        // Update overall hand motion
        this._updateHandMotion(time);

        // Return animation state for hydrodynamics
        return {
            swimPhase: this.swimPhase,
            fluidTime: this.fluidTime,
            strokePhase,
            strokeIntensity,
            isPowerPhase,
            powerIntensity
        };
    }

    _updateFingers(strokePhase, strokeIntensity, isPowerPhase, powerRamp, deltaTime) {
        const fingerNames = ['index', 'middle', 'ring', 'pinky'];
        const curlConfig = this.config.fingerCurl;

        fingerNames.forEach((name, idx) => {
            const controller = this.fingerControllers.get(name);
            if (!controller) return;

            // Get finger-specific curl configuration
            const cfg = curlConfig[name] || curlConfig.default;

            // Interpolate between power and recovery curl using smooth ramp
            const baseCurl = cfg.recovery + (cfg.power - cfg.recovery) * powerRamp;

            // Add subtle phase offset between fingers for natural wave
            const fingerPhase = this.swimPhase + idx * 0.12;

            // Add sine wave modulation for organic feel
            const curlModulation = Math.sin(fingerPhase) * 0.02;

            controller.update(fingerPhase, baseCurl + curlModulation, deltaTime);
        });

        // Update thumb separately (different motion pattern)
        const thumbController = this.fingerControllers.get('thumb');
        if (thumbController) {
            const thumbCfg = curlConfig.thumb || curlConfig.default;
            const thumbCurl = thumbCfg.recovery + (thumbCfg.power - thumbCfg.recovery) * powerRamp * 0.6;

            // Thumb has slower, more independent motion
            const thumbPhase = this.swimPhase * 0.7;
            thumbController.update(thumbPhase, thumbCurl, deltaTime);

            // Thumb opposition motion
            if (this.hand.userData.fingerChains.thumb) {
                const thumb = this.hand.userData.fingerChains.thumb;
                const opposition = Math.sin(thumbPhase * 0.8) * 0.06;
                thumb.root.rotation.y = (thumb.root.userData?.baseRotY || -0.48) + opposition;
            }
        }
    }

    _updateSpread(strokePhase, isPowerPhase, strokeIntensity) {
        const spreadCfg = this.config.spread;

        // Smooth interpolation between spread amounts
        const targetSpread = isPowerPhase
            ? spreadCfg.powerPhase
            : spreadCfg.recoveryPhase * (1 - strokeIntensity * 0.5);

        // Apply to each finger
        this.spreadControllers.forEach((controller, name) => {
            controller.update(targetSpread);
        });
    }

    _updateHandMotion(time) {
        const motionCfg = this.config.handMotion;

        // Smooth, organic hand motion
        const pitchMotion = Math.sin(this.swimPhase * motionCfg.pitchFrequency) * motionCfg.pitchAmplitude;
        const yawMotion = Math.sin(time * 0.18) * motionCfg.yawAmplitude +
                          Math.sin(this.swimPhase * motionCfg.yawFrequency) * motionCfg.yawAmplitude * 0.3;
        const rollMotion = Math.sin(this.swimPhase * motionCfg.rollFrequency) * motionCfg.rollAmplitude;

        // Apply to hand structure
        this.hand.rotation.x = pitchMotion;
        this.hand.rotation.y = yawMotion;
        this.hand.rotation.z = rollMotion;
    }

    /**
     * Get current animation state (for hydrodynamics coupling)
     */
    getAnimationState() {
        const strokePhase = Math.sin(this.swimPhase);
        return {
            swimPhase: this.swimPhase,
            fluidTime: this.fluidTime,
            strokePhase,
            strokeIntensity: Math.abs(strokePhase),
            isPowerPhase: strokePhase > 0,
            powerIntensity: strokePhase > 0 ? strokePhase : 0
        };
    }
}

// Expose globally
window.AnimationEasing = AnimationEasing;
window.JointAnimator = JointAnimator;
window.WavePropagationController = WavePropagationController;
window.SpreadController = SpreadController;
window.SwimAnimationController = SwimAnimationController;
