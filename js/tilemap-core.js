// tilemap-core.js
// Core tilemap functionality - seamless drawing across 3x3 canvas grid

const TilemapCore = {
    sprayTimer: null,
    sprayPoint: null,

    init() {
        this.setupEventListeners();
        // Initialize layer system if it exists
        if (typeof LayerManager !== 'undefined') {
            LayerManager.init();
        }
        this.updatePreviews();
        console.log('Tilemap Core initialized');
    },
    
    setupEventListeners() {
        // Apply local listeners to ALL 9 canvases to handle drawing
        DOM.allCanvases.forEach(canvas => {
            this.setupCanvasListeners(canvas);
        });
        
        // Apply global listeners to stop drawing reliably outside the grid area
        document.body.addEventListener('mouseup', this.stopDrawing.bind(this));
        document.body.addEventListener('touchend', this.stopDrawing.bind(this));
        document.body.addEventListener('touchcancel', this.stopDrawing.bind(this));
    },
    
    setupCanvasListeners(canvas) {
        // Attach mousedown/touchstart to initiate drawing
        canvas.addEventListener('mousedown', this.handleDrawing.bind(this));
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleDrawing(e);
        });
        
        // Attach mousemove/touchmove for continuous drawing
        canvas.addEventListener('mousemove', (e) => {
            if (State.isDrawing && (e.buttons === 1 || e.buttons === 2)) {
                this.handleDrawing(e);
            }
        });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (State.isDrawing) {
                this.handleDrawing(e);
            }
        });
        
        // Handle context menu to allow right-click erase
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleDrawing(e);
            this.stopDrawing(); // Immediately stop after single click erase
        });
    },
    
 handleDrawing(e) {
        const targetCanvas = e.target;
        
        // Check if we have a valid canvas with grid position
        if (typeof targetCanvas.gridC !== 'number') {
            return;
        }
        
        // Determine the brush type based on tool, mouse button, or event type
        if (State.currentTool === 'eraser') {
            // Eraser tool always uses erase color regardless of mouse button
            State.setBrush(Config.ERASE_COLOR);
            State.setDrawing(true);
        } else if (e.type === 'contextmenu') {
            e.preventDefault();
            State.setBrush(Config.ERASE_COLOR);
            State.setDrawing(true);
        } else if (e.buttons === 1 || e.type.startsWith('touch')) {
            State.setBrush(State.currentColor.startsWith('#') ? State.hexToRgb(State.currentColor) : State.currentColor);
            State.setDrawing(true);
        } else if (e.buttons === 2) {
            State.setBrush(Config.ERASE_COLOR);
            State.setDrawing(true);
        }
        
        if (!State.isDrawing) return;
        
        const rect = targetCanvas.getBoundingClientRect();
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;
        
        if (!clientX || !clientY) return;
        
        // Map screen coordinates to canvas buffer coordinates.
        // This accounts for CSS display scaling (responsive sizes) and zoom transforms.
        let x = ((clientX - rect.left) / rect.width) * targetCanvas.width;
        let y = ((clientY - rect.top) / rect.height) * targetCanvas.height;

        // Colour picker: sample the clicked canvas instead of painting.
        if (State.currentTool === 'eyedropper') {
            const pickX = Math.max(0, Math.min(targetCanvas.width - 1, Math.floor(x)));
            const pickY = Math.max(0, Math.min(targetCanvas.height - 1, Math.floor(y)));
            try {
                const pixel = targetCanvas.getContext('2d').getImageData(pickX, pickY, 1, 1).data;
                if (pixel[3] > 0) {
                    const hex = '#' + [pixel[0], pixel[1], pixel[2]]
                        .map(channel => channel.toString(16).padStart(2, '0')).join('');
                    if (typeof PaletteManager !== 'undefined') {
                        PaletteManager.setCurrentColor(hex);
                    } else {
                        State.setColor(hex);
                    }
                }
            } catch (error) {
                console.warn('Could not sample colour:', error);
            }
            State.setDrawing(false);
            return;
        }
        
        // Calculate the logical tile coordinate (0 to 31) within the clicked canvas
        const tileX = Math.floor(x / Config.PIXEL_SIZE);
        const tileY = Math.floor(y / Config.PIXEL_SIZE);
        
        // Safety check for bounds
        if (tileX < 0 || tileX >= Config.TILE_DIM || tileY < 0 || tileY >= Config.TILE_DIM) return;
        
        // Calculate the offset from the central tile (1, 1)
        const deltaX = (targetCanvas.gridC - 1) * Config.TILE_DIM;
        const deltaY = (targetCanvas.gridR - 1) * Config.TILE_DIM;
        
        // Calculate the absolute tile coordinate in the conceptual infinite grid
        const absTileX = tileX + deltaX;
        const absTileY = tileY + deltaY;
        
        // Spray can: emit a random dither stamp and keep spraying while held.
        if (State.currentTool === 'spray') {
            this.sprayPoint = { x: absTileX, y: absTileY };
            if (e.type === 'mousedown' || e.type === 'touchstart' || e.type === 'contextmenu') {
                this.sprayAt(absTileX, absTileY);
                this.startSpray();
                this.updatePreviews();
                State.markUnsaved();
            }
            return;
        }

        // Use the actual brush size for both pencil and brush tools
        // Pencil tool will still maintain hard edges but respect the size setting
        const drawR = State.brushSize;
        
        // Draw brush stroke with wrapping logic
        for (let dx = -drawR; dx <= drawR; dx++) {
            for (let dy = -drawR; dy <= drawR; dy++) {
                const brushAbsX = absTileX + dx;
                const brushAbsY = absTileY + dy;
                
                // Wrap the final location back to the central tile's data [0, 31]
                let drawX = (brushAbsX % Config.TILE_DIM + Config.TILE_DIM) % Config.TILE_DIM;
                let drawY = (brushAbsY % Config.TILE_DIM + Config.TILE_DIM) % Config.TILE_DIM;
                
                // Calculate distance from center for alpha blending
                const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
                
                // Draw on the active layer's canvas (if layers exist), otherwise use editor context
                const activeLayer = State.layers[State.activeLayerIndex];
                const targetCtx = activeLayer ? activeLayer.canvas.getContext('2d') : DOM.editorCtx;
                this.drawPixel(targetCtx, drawX, drawY, State.currentBrush, State.opacity, distanceFromCenter, drawR);
            }
        }
        
        // Update all 8 surrounding preview canvases to show the seamless result
        this.updatePreviews();
        
        // Mark state as needing save
        State.markUnsaved();
    },
    
    drawPixel(ctx, tileX, tileY, color, opacity = 1.0, distanceFromCenter = 0, brushRadius = 0) {
        // Convert logical tile coordinates (0-31) to screen pixel coordinates (0-511)
        const screenX = tileX * Config.PIXEL_SIZE;
        const screenY = tileY * Config.PIXEL_SIZE;
        
        ctx.save();
        
        // For brush tool, apply alpha gradient based on distance from center
        if (State.currentTool === 'brush' && brushRadius > 0) {
            const maxDistance = brushRadius + 1;
            const normalizedDistance = distanceFromCenter / maxDistance;
            const edgeAlpha = Math.max(0.1, 1.0 - (normalizedDistance * 0.8)); // Fade to 20% at edges
            ctx.globalAlpha = opacity * edgeAlpha;
        } else {
            // For pencil tool and single-pixel brush, use full opacity (harsh edges)
            ctx.globalAlpha = opacity;
        }
        
        if (color === 'transparent') {
            ctx.clearRect(screenX, screenY, Config.PIXEL_SIZE, Config.PIXEL_SIZE);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(screenX, screenY, Config.PIXEL_SIZE, Config.PIXEL_SIZE);
        }
        ctx.restore();
    },
    
    startSpray() {
        if (this.sprayTimer) return;
        this.sprayTimer = setInterval(() => {
            if (!State.isDrawing || State.currentTool !== 'spray' || !this.sprayPoint) return;
            this.sprayAt(this.sprayPoint.x, this.sprayPoint.y);
            this.updatePreviews();
            State.markUnsaved();
        }, 80);
    },

    stopSpray() {
        if (this.sprayTimer) {
            clearInterval(this.sprayTimer);
            this.sprayTimer = null;
        }
    },

    sprayAt(absTileX, absTileY) {
        const activeLayer = State.layers[State.activeLayerIndex];
        const ctx = activeLayer ? activeLayer.canvas.getContext('2d') : DOM.editorCtx;
        const radius = Math.max(1, Math.round(State.brushSize));
        const density = Math.max(0.01, Math.min(1, (State.sprayDensity ?? 50) / 100));
        const variation = Math.max(0, Math.min(1, State.sprayOpacityVariation));
        const erasing = State.currentBrush === Config.ERASE_COLOR;

        let colors;
        if (erasing) {
            colors = ['transparent'];
        } else if (State.sprayUsePalette && Array.isArray(State.paletteColors) && State.paletteColors.length) {
            // Include the current colour so the spray always stays related to
            // the active swatch while dithering through the palette.
            colors = [State.currentColor, ...State.paletteColors];
        } else {
            colors = [State.currentColor];
        }

        // Build the logical-pixel cells in the spray circle. Each cell is a
        // real tile pixel (16×16 screen pixels), never a sub-pixel repeat.
        const cells = [];
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > radius + 0.5) continue;
                // Centre cells are much more likely to be selected than edges.
                const weight = Math.max(0.08, 1 - distance / (radius + 1.5));
                cells.push({ dx, dy, distance, weight });
            }
        }

        // At the 3×3 minimum, paint 3–6 of the 9 cells per stamp. Larger
        // brushes scale the count with the area and the density setting.
        let count;
        if (radius === 1) {
            if (density >= 0.95) {
                count = 9;
            } else {
                const base = 3 + density * 3;
                count = Math.round(base + (Math.random() * 2 - 1) * 1.5);
                count = Math.max(3, Math.min(6, count));
            }
        } else {
            const base = cells.length * density;
            const jitter = Math.max(1, Math.round(base * 0.25));
            count = Math.round(base + (Math.random() * 2 - 1) * jitter);
            count = Math.max(1, Math.min(cells.length, count));
        }

        // Weighted sampling without replacement: pick distinct cells, with
        // centre cells favoured over edge cells.
        const chosen = cells
            .map((cell) => ({ cell, rank: Math.pow(Math.random(), 1 / cell.weight) }))
            .sort((a, b) => b.rank - a.rank)
            .slice(0, count);

        for (const { cell } of chosen) {
            const brushAbsX = absTileX + cell.dx;
            const brushAbsY = absTileY + cell.dy;
            const drawX = (brushAbsX % Config.TILE_DIM + Config.TILE_DIM) % Config.TILE_DIM;
            const drawY = (brushAbsY % Config.TILE_DIM + Config.TILE_DIM) % Config.TILE_DIM;

            // Centre particles are more opaque; edges fade out. Each particle
            // also gets a random opacity variation for a soft dither.
            const radialAlpha = 1 - Math.min(0.55, (cell.distance / (radius + 1)) * 0.55);
            const alpha = State.opacity * radialAlpha * (1 - variation * Math.random());
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.drawPixel(ctx, drawX, drawY, color, alpha);
        }
    },

    stopDrawing() {
        this.stopSpray();
        if (!State.isDrawing) return;
        State.setDrawing(false);
        // TilemapCore owns the stroke lifecycle, so this is where a completed
        // paint stroke becomes an undoable history entry.
        State.saveState();
    },
    
    updatePreviews() {
        console.log(`Updating previews - ${State.layers.length} layers available`);

        // Clear the main editor canvas first
        DOM.editorCtx.clearRect(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);

        // Composite all visible layers onto the main editor canvas
        // Draw in normal order so bottom layers in UI appear on bottom in canvas
        State.layers.forEach((layer, index) => {
            if (layer.visible) {
                console.log(`Compositing layer ${index}: ${layer.name} (opacity: ${layer.opacity})`);
                DOM.editorCtx.globalAlpha = layer.opacity;
                DOM.editorCtx.drawImage(layer.canvas, 0, 0);
            }
        });

        // Reset alpha
        DOM.editorCtx.globalAlpha = 1.0;

        // Copy the composited result to all 8 preview canvases
        const imageData = DOM.editorCtx.getImageData(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);
        DOM.previewContexts.forEach((ctx, index) => {
            ctx.putImageData(imageData, 0, 0);
        });

        console.log('Preview update completed successfully');
    },
    
    clearCanvas() {
        // Clear all canvases to transparent
        DOM.editorCtx.clearRect(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);

        DOM.previewContexts.forEach(ctx => {
            ctx.clearRect(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);
        });
        
        State.markUnsaved();
    },
    
    // Get current canvas data as image data
    getCanvasData() {
        return DOM.editorCtx.getImageData(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);
    },
    
    // Load canvas data from image data
    setCanvasData(imageData) {
        DOM.editorCtx.putImageData(imageData, 0, 0);
        this.updatePreviews();
    },
    
    // Export current canvas as data URL
    exportCanvas(format = 'image/png', quality = 1.0) {
        return DOM.editorCanvas.toDataURL(format, quality);
    },
    
    // Import canvas from data URL
    importCanvas(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // Clear current canvas
                this.clearCanvas();
                
                // Draw the imported image
                DOM.editorCtx.drawImage(img, 0, 0);
                this.updatePreviews();
                resolve();
            };
            img.onerror = reject;
            img.src = dataURL;
        });
    }
};