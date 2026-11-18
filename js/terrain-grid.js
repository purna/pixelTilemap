// terrain-grid.js
// Interactive 3x3 terrain sample with automatic edge transitions.

const TerrainGrid = {
    TILE: 64,
    STORAGE_KEY: 'tilemap-terrain-grid',
    cells: [
        [1, 1, 1],
        [1, 0, 1],
        [1, 1, 1]
    ],
    canvases: [],

    init() {
        const grid = document.getElementById('terrain-grid');
        if (!grid) return;

        this.load();
        this.buildGrid();
        this.bindControls();
        this.render();
        console.log('Terrain Grid initialized');
    },

    buildGrid() {
        const grid = document.getElementById('terrain-grid');
        if (!grid) return;
        grid.innerHTML = '';
        this.canvases = [];

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'terrain-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.title = `Toggle terrain at ${col + 1}, ${row + 1}`;

                const canvas = document.createElement('canvas');
                canvas.width = this.TILE;
                canvas.height = this.TILE;
                canvas.setAttribute('aria-hidden', 'true');
                cell.appendChild(canvas);

                const name = document.createElement('span');
                name.className = 'terrain-cell-label';
                name.textContent = this.cells[row][col] ? 'Grass' : 'Dirt';
                cell.appendChild(name);

                cell.addEventListener('click', () => this.toggle(row, col));
                cell.addEventListener('contextmenu', (event) => {
                    event.preventDefault();
                    this.toggle(row, col);
                });

                grid.appendChild(cell);
                this.canvases.push(canvas);
            }
        }
    },

    bindControls() {
        const sampleBtn = document.getElementById('terrain-sample-btn');
        if (sampleBtn) {
            sampleBtn.addEventListener('click', () => {
                this.cells = [
                    [1, 1, 1],
                    [1, 0, 1],
                    [1, 1, 1]
                ];
                this.render();
                this.save();
                if (typeof Notifications !== 'undefined') {
                    new Notifications().info('Terrain sample restored');
                }
            });
        }

        const invertBtn = document.getElementById('terrain-invert-btn');
        if (invertBtn) {
            invertBtn.addEventListener('click', () => {
                this.cells = this.cells.map(row => row.map(value => value ? 0 : 1));
                this.render();
                this.save();
            });
        }

        const grassBtn = document.getElementById('terrain-grass-btn');
        if (grassBtn) {
            grassBtn.addEventListener('click', () => {
                this.cells = [
                    [1, 1, 1],
                    [1, 1, 1],
                    [1, 1, 1]
                ];
                this.render();
                this.save();
            });
        }

        const clearBtn = document.getElementById('terrain-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.cells = [
                    [0, 0, 0],
                    [0, 0, 0],
                    [0, 0, 0]
                ];
                this.render();
                this.save();
            });
        }

        const applyBtn = document.getElementById('terrain-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyToCanvas());
        }
    },

    applyToCanvas() {
        if (typeof State === 'undefined' || typeof DOM === 'undefined') return;
        if (!confirm('Replace the current canvas with this 3×3 terrain sample?')) return;

        const composite = document.createElement('canvas');
        composite.width = this.TILE * 3;
        composite.height = this.TILE * 3;
        const compositeCtx = composite.getContext('2d');

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const tileCanvas = document.createElement('canvas');
                tileCanvas.width = this.TILE;
                tileCanvas.height = this.TILE;
                this.drawTile(tileCanvas.getContext('2d'), row, col);
                compositeCtx.drawImage(tileCanvas, col * this.TILE, row * this.TILE);
            }
        }

        // Clear every layer so the sample is shown by itself, then paint it
        // on the active layer.
        State.layers.forEach(layer => {
            layer.canvas.getContext('2d').clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        });

        if (State.layers.length === 0) {
            State.addLayer('Layer 1');
        }

        const targetLayer = State.layers[State.activeLayerIndex] || State.layers[0];
        const targetCtx = targetLayer.canvas.getContext('2d');
        targetCtx.save();
        targetCtx.imageSmoothingEnabled = false;
        targetCtx.clearRect(0, 0, targetLayer.canvas.width, targetLayer.canvas.height);
        targetCtx.drawImage(composite, 0, 0, targetLayer.canvas.width, targetLayer.canvas.height);
        targetCtx.restore();

        if (typeof LayerManager !== 'undefined') LayerManager.renderLayers();
        if (typeof TilemapCore !== 'undefined') TilemapCore.updatePreviews();
        State.markUnsaved();
        if (typeof State.saveState === 'function') State.saveState();

        if (typeof Notifications !== 'undefined') {
            new Notifications().success('Terrain sample loaded into the canvas');
        }
    },

    toggle(row, col) {
        this.cells[row][col] = this.cells[row][col] ? 0 : 1;
        this.render();
        this.save();
    },

    render() {
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const canvas = this.canvases[row * 3 + col];
                if (!canvas) continue;
                this.drawTile(canvas.getContext('2d'), row, col);
            }
        }

        document.querySelectorAll('#terrain-grid .terrain-cell').forEach(cell => {
            const row = parseInt(cell.dataset.row, 10);
            const col = parseInt(cell.dataset.col, 10);
            const label = cell.querySelector('.terrain-cell-label');
            if (label) label.textContent = this.cells[row][col] ? 'Grass' : 'Dirt';
        });
    },

    drawTile(ctx, row, col) {
        const size = this.TILE;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);

        const grass = this.cells[row][col] === 1;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const worldX = col * size + x;
                const worldY = row * size + y;
                let color;

                if (grass) {
                    const band = this.getDirtBand(row, col, x, y, worldX, worldY);
                    if (band > 0) {
                        color = this.bandColor(worldX, worldY, band);
                    } else {
                        color = this.grassColor(worldX, worldY);
                    }
                } else {
                    color = this.dirtColor(worldX, worldY);
                }

                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    },

    getDirtBand(row, col, x, y, worldX, worldY) {
        const size = this.TILE;
        let band = 0;
        const neighbours = [
            { dr: -1, dc: 0, distance: y, axis: worldX },
            { dr: 1, dc: 0, distance: size - 1 - y, axis: worldX },
            { dr: 0, dc: -1, distance: x, axis: worldY },
            { dr: 0, dc: 1, distance: size - 1 - x, axis: worldY }
        ];

        neighbours.forEach(neighbour => {
            const neighbourRow = row + neighbour.dr;
            const neighbourCol = col + neighbour.dc;
            const neighbourIsDirt = this.inBounds(neighbourRow, neighbourCol)
                ? this.cells[neighbourRow][neighbourCol] === 0
                : false;

            if (!neighbourIsDirt) return;

            const wobble = Math.sin(neighbour.axis * 0.34 + row * 5.1 + col * 7.3) * 2
                + this.hash(worldX, worldY) * 3;
            const edge = 9 + wobble;
            if (neighbour.distance < edge) {
                band = Math.max(band, edge - neighbour.distance);
            }
        });

        // Round the inside corners a little so transitions read as terrain,
        // rather than as four separate straight strips.
        const topDirt = this.isDirt(row - 1, col);
        const bottomDirt = this.isDirt(row + 1, col);
        const leftDirt = this.isDirt(row, col - 1);
        const rightDirt = this.isDirt(row, col + 1);

        if (topDirt && leftDirt) {
            const d = Math.sqrt(x * x + y * y);
            if (d < 15 + this.hash(worldX, worldY) * 3) band = Math.max(band, 16 - d);
        }
        if (topDirt && rightDirt) {
            const d = Math.sqrt((size - 1 - x) ** 2 + y * y);
            if (d < 15 + this.hash(worldX + 3, worldY) * 3) band = Math.max(band, 16 - d);
        }
        if (bottomDirt && leftDirt) {
            const d = Math.sqrt(x * x + (size - 1 - y) ** 2);
            if (d < 15 + this.hash(worldX, worldY + 3) * 3) band = Math.max(band, 16 - d);
        }
        if (bottomDirt && rightDirt) {
            const d = Math.sqrt((size - 1 - x) ** 2 + (size - 1 - y) ** 2);
            if (d < 15 + this.hash(worldX + 3, worldY + 3) * 3) band = Math.max(band, 16 - d);
        }

        // Diagonal dirt neighbours create the small inner corner wedges.
        // This is what makes a grass tile surrounded by grass but touching
        // dirt diagonally show dirt in its four corners.
        const diagonals = [
            { dr: -1, dc: -1, cx: 0, cy: 0 },
            { dr: -1, dc: 1, cx: size - 1, cy: 0 },
            { dr: 1, dc: -1, cx: 0, cy: size - 1 },
            { dr: 1, dc: 1, cx: size - 1, cy: size - 1 }
        ];
        diagonals.forEach(diagonal => {
            if (!this.isDirt(row + diagonal.dr, col + diagonal.dc)) return;
            const d = Math.sqrt((x - diagonal.cx) ** 2 + (y - diagonal.cy) ** 2);
            const cornerEdge = 11 + this.hash(worldX + diagonal.dc, worldY + diagonal.dr) * 3;
            if (d < cornerEdge) band = Math.max(band, cornerEdge - d);
        });

        return band;
    },

    inBounds(row, col) {
        return row >= 0 && row < 3 && col >= 0 && col < 3;
    },

    isDirt(row, col) {
        return this.inBounds(row, col) && this.cells[row][col] === 0;
    },

    bandColor(worldX, worldY, band) {
        const noise = this.hash(worldX * 0.7, worldY * 0.7);
        if (band < 2.2) return noise > 0.55 ? '#a8e63a' : '#8bcf2e';
        if (band < 4.2) return noise > 0.6 ? '#93613f' : '#7d4e33';
        if (noise > 0.82) return '#8c5a39';
        if (noise < 0.1) return '#5f3924';
        return '#71442d';
    },

    grassColor(worldX, worldY) {
        const noise = this.hash(worldX, worldY);
        if (noise > 0.965) return '#4c8f1c';
        if (noise > 0.86) return '#8ad42c';
        if (noise < 0.035) return '#b6e84a';
        if (noise < 0.09) return '#5ba421';
        return '#6fbd27';
    },

    dirtColor(worldX, worldY) {
        const noise = this.hash(worldX * 0.5, worldY * 0.5);
        if (noise > 0.965) return '#a86b3f';
        if (noise > 0.86) return '#d29a5f';
        if (noise < 0.035) return '#e0ab70';
        if (noise < 0.09) return '#b07845';
        return '#c68b52';
    },

    hash(x, y) {
        let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
    },

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cells));
        } catch (error) {
            console.warn('Could not save terrain grid:', error);
        }
    },

    load() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null');
            if (Array.isArray(saved) && saved.length === 3 && saved.every(row => Array.isArray(row) && row.length === 3)) {
                this.cells = saved.map(row => row.map(value => value ? 1 : 0));
            }
        } catch (error) {
            console.warn('Could not load terrain grid:', error);
        }
    }
};
