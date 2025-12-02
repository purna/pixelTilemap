// app.js
// Main application initialization and coordination

const App = {
    initialized: false,
    
    async init() {
        if (this.initialized) {
            console.warn('App already initialized');
            return;
        }
        
        console.log('Initializing Seamless Tilemap Editor Pro...');
        
        try {
            // Initialize core modules in order
            await this.initializeModules();
            
            // Set up global event handlers
            this.setupGlobalHandlers();
            
            // Load autosave if available
            this.loadAutosave();
            
            // Start auto-save
            FileManager.startAutoSave();
            
            this.initialized = true;
            
            console.log('Seamless Tilemap Editor Pro initialized successfully');
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            if (typeof InputHandler !== 'undefined') {
                InputHandler.showNotification('Failed to initialize application', 'error');
            }
        }
    },
    
    async initializeModules() {
        // Initialize DOM first
        DOM.init();
        
        // Initialize core functionality
        TilemapCore.init();
        
        // Initialize managers
        PaletteManager.init();
        LayerManager.init();
        ToolManager.init();
        FileManager.init();
        SettingsManager.init();
        ZoomManager.init();
        
        // Initialize UI and Input handlers
        UIManager.init();
        InputHandler.init();
        
        // Update initial UI state
        State.updateUI();
        ToolManager.updateActivePresetButton(State.brushSize);
        FileManager.updateHistoryButtons();
        
        console.log('All modules initialized');
    },
    
    setupGlobalHandlers() {
        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Handle visibility change (for auto-save)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                FileManager.autoSave();
            }
        });
        
        // Handle before unload (save confirmation)
        window.addEventListener('beforeunload', (e) => {
            if (State.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
        
        // Handle drag and drop files
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleFileDrop(e);
        });
        
        // Handle keyboard shortcuts globally
        document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
    },
    
    handleResize() {
        // Recalculate canvas positions if needed
        // For now, just update UI elements that depend on window size
        State.updateUI();
    },
    
    handleFileDrop(e) {
        const files = e.dataTransfer.files;
        
        if (files.length > 0) {
            const file = files[0];
            
            if (file.type.startsWith('image/')) {
                // Import image
                FileManager.importImage();
            } else if (file.name.endsWith('.json')) {
                // Load project
                FileManager.loadFromFile(file);
            }
        }
    },
    
    handleGlobalKeydown(e) {
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey;
        
        // Prevent default for handled shortcuts
        const handledKeys = ['b', 'e', 'i', 'l', 's', 'o', 'z', 'y'];
        
        if (handledKeys.includes(key) || (ctrl && handledKeys.includes(key))) {
            e.preventDefault();
        }
        
        // Handle specific shortcuts
        switch (key) {
            case 'escape':
                // Cancel current operation
                State.setDrawing(false);
                break;
                
            case 'delete':
            case 'backspace':
                // Clear canvas with delete key
                if (confirm('Clear the entire canvas? This action cannot be undone.')) {
                    TilemapCore.clearCanvas();
                    State.saveState();
                }
                break;
        }
    },
    
    loadAutosave() {
        const loaded = FileManager.loadAutoSave();
        if (loaded) {
            if (typeof InputHandler !== 'undefined') {
                InputHandler.showNotification('Auto-saved project loaded', 'info');
            }
        }
    },
    
    showWelcomeMessage() {
        // Check if helpers should be shown
        if (typeof SettingsManager !== 'undefined' && SettingsManager.settings && SettingsManager.settings.showHelpers === false) {
            return; // Don't show welcome message if helpers are disabled
        }

        setTimeout(() => {
            const welcomeMessage = `
                <strong>Welcome to Seamless Tilemap Editor Pro!</strong><br><br>
                <strong>Quick Start:</strong><br>
                • Click and drag across the 9 tiles to draw seamlessly<br>
                • Use toolbar to switch between Brush (B), Eraser (E), and Color Picker (I)<br>
                • Adjust brush size with the slider<br>
                • Save/Load projects with Ctrl+S / Ctrl+O<br><br>
                <strong>Drawing wraps around edges for seamless tiles!</strong>
            `;
            
            // Create welcome notification
            const notification = document.createElement('div');
            notification.className = 'welcome-notification';
            notification.innerHTML = welcomeMessage;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 400px;
                background: var(--bg-dark);
                border: 1px solid var(--accent-primary);
                border-radius: 8px;
                padding: 16px;
                color: var(--text-primary);
                font-size: 13px;
                line-height: 1.4;
                z-index: 10000;
                box-shadow: 0 0 20px rgba(0, 255, 65, 0.2);
                animation: slideIn 0.3s ease-out;
            `;
            
            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                color: var(--text-secondary);
                font-size: 18px;
                cursor: pointer;
                width: 24px;
                height: 24px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            closeBtn.addEventListener('click', () => {
                notification.remove();
            });
            
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = 'var(--bg-light)';
                closeBtn.style.color = 'var(--text-primary)';
            });
            
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'none';
                closeBtn.style.color = 'var(--text-secondary)';
            });
            
            notification.appendChild(closeBtn);
            document.body.appendChild(notification);
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => {
                        notification.remove();
                    }, 300);
                }
            }, 10000);
            
            // Add CSS animations
            if (!document.getElementById('welcome-animations')) {
                const style = document.createElement('style');
                style.id = 'welcome-animations';
                style.textContent = `
                    @keyframes slideIn {
                        from {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    @keyframes slideOut {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                    }
                `;
                document.head.appendChild(style);
            }
        }, 500);
    },
    
    // Public API methods
    getState() {
        return {
            initialized: this.initialized,
            currentTool: State.currentTool,
            hasUnsavedChanges: State.hasUnsavedChanges,
            layerCount: State.layers.length
        };
    },
    
    exportProject(format = 'png') {
        FileManager.exportProject(format);
    },
    
    importProject() {
        FileManager.loadProject();
    },
    
    reset() {
        if (confirm('Reset the application? This will clear all data.')) {
            // Clear autosave
            FileManager.clearAutoSave();
            
            // Reload page
            location.reload();
        }
    }
};

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { App, State, DOM, TilemapCore, PaletteManager, LayerManager, ToolManager, FileManager, InputHandler, UIManager };
}