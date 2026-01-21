// EEL Mobile Handler
// Detects mobile portrait mode and adjusts behavior accordingly

(function() {
    'use strict';
    
    const MobileHandler = {
        isMobile: false,
        isPortrait: false,
        initialized: false,
        
        init: function() {
            if (this.initialized) return;
            this.initialized = true;
            
            this.checkDeviceAndOrientation();
            this.setupEventListeners();
            
        },
        
        checkDeviceAndOrientation: function() {
            // Check for touch device
            const isTouchDevice = 'ontouchstart' in window || 
                                  navigator.maxTouchPoints > 0 || 
                                  navigator.msMaxTouchPoints > 0;
            
            // Check for coarse pointer (finger vs mouse)
            const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
            
            // Check for hover capability
            const noHover = window.matchMedia('(hover: none)').matches;
            
            // Check viewport width
            const isNarrow = window.innerWidth <= 768;
            
            // Check orientation
            this.isPortrait = window.innerHeight > window.innerWidth;
            
            // Determine if mobile
            this.isMobile = (isTouchDevice && hasCoarsePointer && noHover) || 
                           (isTouchDevice && isNarrow);
            
            this.applyMobileStyles();
        },
        
        applyMobileStyles: function() {
            const body = document.body;
            
            if (this.isMobile && this.isPortrait) {
                body.classList.add('mobile-portrait');
                this.disablePanelPhysics();
            } else {
                body.classList.remove('mobile-portrait');
                this.enablePanelPhysics();
            }
        },
        
        disablePanelPhysics: function() {
            // Disable physics and show panels in scrollable layout
            if (typeof radialPanelPhysics !== 'undefined' && radialPanelPhysics) {
                radialPanelPhysics.panels.forEach((panelData) => {
                    panelData.physicsDisabled = true;
                    panelData.isDragging = false;
                    panelData.isMoving = false;
                    panelData.velocity = { x: 0, y: 0 };
                    
                    // Reset transform for mobile layout
                    panelData.element.style.transform = 'none';
                });
            }
            
            // Remove js-positioned classes and reveal immediately
            document.querySelectorAll('.js-positioned').forEach(el => {
                el.classList.add('ready');
            });
        },
        
        enablePanelPhysics: function() {
            // Re-enable physics for desktop
            if (typeof radialPanelPhysics !== 'undefined' && radialPanelPhysics) {
                radialPanelPhysics.panels.forEach((panelData) => {
                    panelData.physicsDisabled = false;
                });
                
                // Trigger bounds update to reposition panels
                radialPanelPhysics.updateBounds();
            }
        },
        
        setupEventListeners: function() {
            // Handle orientation changes
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    this.checkDeviceAndOrientation();
                }, 100);
            });
            
            // Handle resize (also catches orientation changes on some devices)
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    this.checkDeviceAndOrientation();
                }, 150);
            });
            
            // Handle media query changes
            const portraitQuery = window.matchMedia('(orientation: portrait)');
            if (portraitQuery.addEventListener) {
                portraitQuery.addEventListener('change', () => {
                    this.checkDeviceAndOrientation();
                });
            } else if (portraitQuery.addListener) {
                portraitQuery.addListener(() => {
                    this.checkDeviceAndOrientation();
                });
            }
        }
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Small delay to let main script initialize first
            setTimeout(() => MobileHandler.init(), 150);
        });
    } else {
        setTimeout(() => MobileHandler.init(), 150);
    }
    
    // Expose for debugging
    window.MobileHandler = MobileHandler;
})();