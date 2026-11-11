// file-manager.js
// File operations: save, load, export, import

const FileManager = {
    init() {
        this.setupEventListeners();
        console.log('File Manager initialized');
    },
    
    setupEventListeners() {
        // File operation buttons
        DOM.elements.undoBtn.addEventListener('click', () => {
            State.undo();
            this.updateHistoryButtons();
        });
        DOM.elements.redoBtn.addEventListener('click', () => {
            State.redo();
            this.updateHistoryButtons();
        });
        DOM.elements.saveBtn.addEventListener('click', () => this.saveProject());
        DOM.elements.loadBtn.addEventListener('click', () => this.loadProject());
        DOM.elements.exportBtn.addEventListener('click', () => this.exportProject());
        
        // Hidden file input
        DOM.elements.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadFromFile(file);
            }
        });
    },
    
    // Save project to JSON format
    saveProject() {
        try {
            const projectData = this.createProjectData();
            const jsonString = JSON.stringify(projectData, null, 2);
            
            this.downloadFile(jsonString, 'tilemap-project.json', 'application/json');
            State.markSaved();
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.success('Project saved successfully');
            }
            
        } catch (error) {
            console.error('Save error:', error);
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('Error saving project');
            }
        }
    },
    
    // Load project from JSON
    loadProject() {
        DOM.elements.fileInput.click();
    },
    
    // Load from selected file
    loadFromFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const projectData = JSON.parse(e.target.result);
                this.loadProjectData(projectData);
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.success('Project loaded successfully');
                }
            } catch (error) {
                console.error('Load error:', error);
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.error('Error loading project: Invalid file format');
                }
            }
        };
        
        reader.readAsText(file);
    },
    
    // Load project data into the application
    loadProjectData(data) {
        if (!data.version || data.version !== '1.0') {
            throw new Error('Unsupported project version');
        }
        
        // Restore the canvas resolution before recreating layers.
        const tileDim = parseInt(data.settings?.tileDim, 10)
            || Math.round(parseInt(data.settings?.canvasSize?.width, 10) / Config.PIXEL_SIZE);
        if (tileDim && tileDim !== Config.TILE_DIM && typeof SettingsManager !== 'undefined') {
            SettingsManager.resizeCanvas(tileDim, tileDim, { persist: false, silent: true });
        }

        // Load basic settings
        if (data.settings) {
            if (data.settings.brushSize) {
                State.setBrushSize(data.settings.brushSize);
                DOM.elements.brushSizeSlider.value = data.settings.brushSize;
                DOM.updateBrushDisplay(data.settings.brushSize);
            }
            if (data.settings.opacity !== undefined) {
                State.setOpacity(data.settings.opacity);
                DOM.elements.opacitySlider.value = data.settings.opacity * 100;
            }
            if (data.settings.currentColor) {
                State.setColor(data.settings.currentColor);
                DOM.elements.colorPicker.value = data.settings.currentColor;
                DOM.elements.colorHex.value = data.settings.currentColor;
            }
        }
        
        // Load palette
        if (data.palette && Array.isArray(data.palette)) {
            PaletteManager.importPalette(data.palette);
        }
        
        // Load layers
        const layerLoad = (data.layers && Array.isArray(data.layers))
            ? LayerManager.loadLayerData(data.layers)
            : Promise.resolve();
        
        State.markSaved();
        return layerLoad.then(() => {
            if (typeof TilemapCore !== 'undefined') TilemapCore.updatePreviews();
            return data;
        });
    },
    
    // Create project data structure
    createProjectData() {
        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            settings: {
                brushSize: State.brushSize,
                opacity: State.opacity,
                currentColor: State.currentColor,
                canvasSize: { width: Config.CANVAS_SIZE, height: Config.CANVAS_SIZE },
                tileDim: Config.TILE_DIM,
                pixelSize: Config.PIXEL_SIZE
            },
            palette: PaletteManager.getAllColors(),
            layers: LayerManager.getLayerData()
        };
    },
    
    // Export as image
    exportProject(format = 'png') {
        try {
            const dataURL = TilemapCore.exportCanvas(`image/${format}`);
            
            // Create filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `tilemap-export-${timestamp}.${format}`;
            
            this.downloadDataURL(dataURL, filename);
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.success(`Project exported as ${format.toUpperCase()}`);
            }
            
        } catch (error) {
            console.error('Export error:', error);
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('Error exporting project');
            }
        }
    },
    
    // Export as sprite sheet
    exportSpriteSheet() {
        try {
            // Create a sprite sheet with multiple tiles
            const spriteSize = Config.TILE_DIM;
            const numTiles = 9; // 3x3 grid
            
            // Create new canvas for sprite sheet
            const spriteCanvas = document.createElement('canvas');
            spriteCanvas.width = spriteSize * 3;
            spriteCanvas.height = spriteSize * 3;
            const spriteCtx = spriteCanvas.getContext('2d');
            
            // Draw current tile in center of sprite sheet
            spriteCtx.drawImage(DOM.editorCanvas, spriteSize, spriteSize);
            
            // Export sprite sheet
            const dataURL = spriteCanvas.toDataURL('image/png');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `tilemap-spritesheet-${timestamp}.png`;
            
            this.downloadDataURL(dataURL, filename);
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.success('Sprite sheet exported');
            }
            
        } catch (error) {
            console.error('Sprite sheet export error:', error);
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('Error exporting sprite sheet');
            }
        }
    },
    
    // Download helper methods
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    },
    
    downloadDataURL(dataURL, filename) {
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },
    
    // Import image as new tile
    importImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    const img = new Image();
                    
                    img.onload = () => {
                        // Clear canvas and draw imported image
                        TilemapCore.clearCanvas();
                        
                        // Calculate scaling to fit canvas
                        const scale = Math.min(Config.CANVAS_SIZE / img.width, Config.CANVAS_SIZE / img.height);
                        const scaledWidth = img.width * scale;
                        const scaledHeight = img.height * scale;
                        const x = (Config.CANVAS_SIZE - scaledWidth) / 2;
                        const y = (Config.CANVAS_SIZE - scaledHeight) / 2;
                        
                        DOM.editorCtx.drawImage(img, x, y, scaledWidth, scaledHeight);
                        TilemapCore.updatePreviews();
                        
                        State.markUnsaved();
                        if (typeof Notifications !== 'undefined') {
                            const notifications = new Notifications();
                            notifications.success('Image imported successfully');
                        }
                    };
                    
                    img.src = event.target.result;
                };
                
                reader.readAsDataURL(file);
            }
        };
        
        input.click();
    },
    
    // Auto-save functionality
    startAutoSave() {
        if (Config.AUTOSAVE_INTERVAL > 0) {
            this.autoSaveInterval = setInterval(() => {
                if (State.hasUnsavedChanges) {
                    this.autoSave();
                }
            }, Config.AUTOSAVE_INTERVAL);
        }
    },
    
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    },
    
    autoSave() {
        try {
            const projectData = this.createProjectData();
            localStorage.setItem('tilemap-autosave', JSON.stringify(projectData));
        } catch (error) {
            console.error('Auto-save error:', error);
        }
    },

    // Explicitly save the current project to browser storage
    saveToBrowser() {
        try {
            const projectData = this.createProjectData();
            localStorage.setItem('tilemap-browser-project', JSON.stringify(projectData));
            localStorage.setItem('tilemap-autosave', JSON.stringify(projectData));
            State.markSaved();
            if (typeof Notifications !== 'undefined') {
                new Notifications().success('Project saved to browser storage');
            }
        } catch (error) {
            console.error('Browser save error:', error);
            if (typeof Notifications !== 'undefined') {
                new Notifications().error('Could not save to browser storage');
            }
        }
    },

    // Restore the project most recently saved to browser storage
    async loadFromBrowser() {
        try {
            const stored = localStorage.getItem('tilemap-browser-project')
                || localStorage.getItem('tilemap-autosave');
            if (!stored) {
                if (typeof Notifications !== 'undefined') {
                    new Notifications().error('No browser-saved project was found');
                }
                return false;
            }
            await this.loadProjectData(JSON.parse(stored));
            if (typeof Notifications !== 'undefined') {
                new Notifications().success('Project restored from browser storage');
            }
            return true;
        } catch (error) {
            console.error('Browser load error:', error);
            if (typeof Notifications !== 'undefined') {
                new Notifications().error('Could not restore the browser-saved project');
            }
            return false;
        }
    },
    
    loadAutoSave() {
        try {
            const saved = localStorage.getItem('tilemap-autosave');
            if (saved) {
                const projectData = JSON.parse(saved);
                this.loadProjectData(projectData);
                return true;
            }
        } catch (error) {
            console.error('Auto-load error:', error);
        }
        return false;
    },
    
    clearAutoSave() {
        localStorage.removeItem('tilemap-autosave');
    },
    
    updateHistoryButtons() {
        // Enable/disable undo/redo buttons based on history state
        DOM.elements.undoBtn.disabled = State.historyIndex <= 0;
        DOM.elements.redoBtn.disabled = State.historyIndex >= State.history.length - 1;
        
        // Update button styles
        DOM.elements.undoBtn.style.opacity = DOM.elements.undoBtn.disabled ? '0.5' : '1';
        DOM.elements.redoBtn.style.opacity = DOM.elements.redoBtn.disabled ? '0.5' : '1';
    }
};