// tile-atlas.js
// Dual-grid tile atlas, starter packs and live neighbour preview.

const TileAtlas = {
    STORAGE_KEY: 'tilemap-atlas-v1',
    MASKS_9: [1, 3, 2, 5, 15, 10, 4, 12, 8],
    MASK_NAMES: {
        0: 'Base fill',
        1: 'Top-left corner',
        2: 'Top-right corner',
        3: 'Top edge',
        4: 'Bottom-left corner',
        5: 'Left edge',
        6: 'Diagonal TR + BL',
        7: 'Inner corner BR',
        8: 'Bottom-right corner',
        9: 'Diagonal TL + BR',
        10: 'Right edge',
        11: 'Inner corner BL',
        12: 'Bottom edge',
        13: 'Inner corner TR',
        14: 'Inner corner TL',
        15: 'Fill'
    },
    MASK_SHORT: {
        0: 'Base', 1: 'TL', 2: 'TR', 3: 'Top', 4: 'BL',
        5: 'Left', 6: 'Diag', 7: 'Inner BR', 8: 'BR', 9: 'Diag',
        10: 'Right', 11: 'Inner BL', 12: 'Bottom', 13: 'Inner TR',
        14: 'Inner TL', 15: 'Fill'
    },

    PACKS: [
        {
            id: 'meadow',
            title: 'Meadow & Wildflowers',
            description: 'Grass over dirt with hand-drawn style edges and tiny flowers.',
            background: '#c99a63',
            fill: ['#6fb63a', '#77c140', '#7dc947', '#69ae36'],
            fillLight: '#9ade58',
            fillDark: '#3f7a1f',
            fillDeep: '#2f5e18',
            base: ['#c99a63', '#d0a36d', '#c4935c', '#d6ac77'],
            baseLight: '#e2bd88',
            baseDark: '#a57645',
            edgeLight: '#a8e63a',
            edgeDark: '#3f7a1f',
            spill: '#e2bd88',
            detail: 'flowers'
        },
        {
            id: 'dungeon',
            title: 'Dungeon Floor & Moss',
            description: 'Cool stone flagstones with a dark void and mossy edges.',
            background: '#17151f',
            fill: ['#5b5d6b', '#66697a', '#525462', '#6e7183'],
            fillLight: '#888c9f',
            fillDark: '#393b47',
            fillDeep: '#252630',
            base: ['#1d1b27', '#23212f', '#191722'],
            baseLight: '#302d3e',
            baseDark: '#100f17',
            edgeLight: '#888c9f',
            edgeDark: '#252630',
            spill: '#4e5f3c',
            detail: 'moss'
        },
        {
            id: 'sand',
            title: 'Sand Dunes & Shells',
            description: 'Warm dune ripples with darker packed sand underneath.',
            background: '#b98a52',
            fill: ['#d8ad63', '#e2ba70', '#ecc985', '#d0a257'],
            fillLight: '#f7e0a4',
            fillDark: '#b88642',
            fillDeep: '#966c36',
            base: ['#b3834d', '#ab7a45', '#bd8d56'],
            baseLight: '#cfa066',
            baseDark: '#8b6137',
            edgeLight: '#e2ba70',
            edgeDark: '#85592b',
            spill: '#e2ba70',
            detail: 'grit'
        },
        {
            id: 'snow',
            title: 'Snowfield & Ice',
            description: 'Soft snow drifts over cold blue rock with icy sparkles.',
            background: '#40566f',
            fill: ['#e7f1fc', '#eff7ff', '#dceaf8', '#f6fbff'],
            fillLight: '#ffffff',
            fillDark: '#b3cce4',
            fillDeep: '#8ca9c4',
            base: ['#49607a', '#40566f', '#536b85'],
            baseLight: '#6e88a2',
            baseDark: '#2f4359',
            edgeLight: '#f4faff',
            edgeDark: '#6d8ba8',
            spill: '#f4faff',
            detail: 'sparkle'
        }
    ],

    ready: false,
    pack: 'meadow',
    mode: 16,
    selectedMask: 15,
    editing: false,
    tiles: [],
    cells: [],
    mapW: 16,
    mapH: 9,
    previewPainting: false,
    previewValue: 1,
    previewFrame: null,

    async init() {
        if (this.ready) return;
        this.bindEvents();
        this.buildPackSelect();

        const saved = this.loadSaved();
        if (saved) {
            await this.fromJSON(saved);
        } else {
            this.pack = this.PACKS[0].id;
            this.generatePack(this.pack);
            this.generateMap();
            this.editing = false;
        }

        this.ready = true;
        this.renderAll();
        console.log('Tile Atlas initialized');
    },

    /* ------------------------------------------------------------
       Helpers
       ------------------------------------------------------------ */

    makeCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        return canvas;
    },

    tileSize() {
        return Math.max(4, Math.round((typeof Config !== 'undefined' && Config.TILE_DIM) || 32));
    },

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    hash(x, y, seed) {
        let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },

    pick(list, index) {
        return list[Math.abs(index) % list.length];
    },

    hexToRgb(hex) {
        let value = String(hex || '').replace('#', '').trim();
        if (value.length === 3) {
            value = value.split('').map(ch => ch + ch).join('');
        }
        if (!/^[0-9a-f]{6}$/i.test(value)) return { r: 0, g: 0, b: 0 };
        const int = parseInt(value, 16);
        return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
    },

    getPack(id) {
        return this.PACKS.find(pack => pack.id === id) || this.PACKS[0];
    },

    quadrantBit(mask, x, y, size) {
        const left = x < size / 2;
        const top = y < size / 2;
        if (top) return left ? 1 : 2;
        return left ? 4 : 8;
    },

    isFilled(mask, x, y, size) {
        return (mask & this.quadrantBit(mask, x, y, size)) !== 0;
    },

    popcount(value) {
        let n = value;
        let count = 0;
        while (n) {
            count += n & 1;
            n >>>= 1;
        }
        return count;
    },

    layoutMasks(mode = this.mode) {
        return mode === 9 ? this.MASKS_9.slice() : Array.from({ length: 16 }, (_, index) => index);
    },

    resolveMask(mask) {
        if (mask === 0) return 0;
        if (this.mode !== 9) return mask;
        if (this.MASKS_9.includes(mask)) return mask;

        let best = 15;
        let bestDistance = 99;
        this.MASKS_9.forEach(candidate => {
            let xor = candidate ^ mask;
            let distance = 0;
            while (xor) {
                distance += xor & 1;
                xor >>>= 1;
            }
            if (distance < bestDistance || (distance === bestDistance && candidate === 15)) {
                bestDistance = distance;
                best = candidate;
            }
        });
        return best;
    },

    /* ------------------------------------------------------------
       Starter pack generation
       ------------------------------------------------------------ */

    generatePack(packId) {
        const pack = this.getPack(packId);
        const size = this.tileSize();
        this.pack = pack.id;
        this.tiles = Array.from({ length: 16 }, () => this.makeCanvas(size, size));

        for (let mask = 0; mask < 16; mask++) {
            const ctx = this.tiles[mask].getContext('2d');
            ctx.imageSmoothingEnabled = false;
            if (mask === 0) {
                this.paintBaseTile(ctx, size, pack);
            } else {
                this.paintOuterTile(ctx, size, mask, pack);
            }
        }

        const shown = this.layoutMasks(this.mode);
        if (!shown.includes(this.selectedMask)) this.selectedMask = 15;
        this.editing = false;
        this.generateMap();
        this.persist();
        if (this.ready) this.renderAll();
    },

    resizeTiles(newSize) {
        newSize = this.clamp(Number(newSize) || 32, 4, 512);
        const resized = this.tiles.map(tile => {
            const canvas = this.makeCanvas(newSize, newSize);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            if (tile) ctx.drawImage(tile, 0, 0, newSize, newSize);
            return canvas;
        });
        this.tiles = resized;
        this.persist();
        if (this.ready) this.renderAll();
    },

    paintBaseTile(ctx, size, pack) {
        const image = ctx.createImageData(size, size);
        const data = image.data;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const h = this.hash(x, y, 911);
                let color = this.pick(pack.base, Math.floor(h * pack.base.length));
                if (h > 0.945) color = pack.baseLight;
                else if (h < 0.05) color = pack.baseDark;
                const rgb = this.hexToRgb(color);
                const p = (y * size + x) * 4;
                data[p] = rgb.r;
                data[p + 1] = rgb.g;
                data[p + 2] = rgb.b;
                data[p + 3] = 255;
            }
        }
        ctx.putImageData(image, 0, 0);
    },

    paintOuterTile(ctx, size, mask, pack) {
        const image = ctx.createImageData(size, size);
        const data = image.data;
        const filled = new Uint8Array(size * size);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                filled[y * size + x] = this.isFilled(mask, x, y, size) ? 1 : 0;
            }
        }

        // Round the concave inner corner of three-corner masks so the
        // auto-tiled edges read as terrain instead of a hard notch.
        if (this.popcount(mask) === 3) {
            const radius = Math.max(2, size / 8);
            const cx = size / 2;
            const cy = size / 2;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = x + 0.5 - cx;
                    const dy = y + 0.5 - cy;
                    if (dx * dx + dy * dy <= radius * radius) filled[y * size + x] = 0;
                }
            }
        }

        const at = (x, y) => (x >= 0 && y >= 0 && x < size && y < size ? filled[y * size + x] : -1);
        const has = (x, y, value) => at(x, y) === value;
        const near = (x, y, distance, value) => {
            for (let d = 1; d <= distance; d++) {
                if (has(x - d, y, value) || has(x + d, y, value) ||
                    has(x, y - d, value) || has(x, y + d, value)) return true;
            }
            return false;
        };

        const il = Math.floor(size / 2);
        const ir = size - il;
        const it = il;
        const ib = ir;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const index = y * size + x;
                const terrain = filled[index] === 1;
                const h = this.hash(x, y, 419 + mask * 31);
                let color;

                if (terrain) {
                    color = this.pick(pack.fill, Math.floor(h * pack.fill.length));
                    if (near(x, y, 1, 0)) {
                        color = h > 0.58 ? pack.edgeDark : pack.fillDeep;
                    } else if (near(x, y, 2, 0)) {
                        color = h > 0.45 ? pack.edgeLight : pack.fillLight;
                    } else if (h > 0.95) {
                        color = pack.fillLight;
                    } else if (h < 0.035) {
                        color = pack.fillDark;
                    }

                    // Soft rounded outer corners.
                    if ((x < it || x >= ir || y < it || y >= ib) && h > 0.8) {
                        color = pack.edgeLight;
                    }
                } else {
                    color = this.pick(pack.base, Math.floor(h * pack.base.length));
                    if (near(x, y, 1, 1) && h > 0.38) {
                        color = h > 0.72 ? pack.spill : pack.baseDark;
                    } else if (near(x, y, 2, 1)) {
                        color = h > 0.5 ? pack.baseLight : pack.base[0];
                    } else if (h > 0.955) {
                        color = pack.baseLight;
                    } else if (h < 0.05) {
                        color = pack.baseDark;
                    }
                }

                const rgb = this.hexToRgb(color);
                const p = index * 4;
                data[p] = rgb.r;
                data[p + 1] = rgb.g;
                data[p + 2] = rgb.b;
                data[p + 3] = 255;
            }
        }

        ctx.putImageData(image, 0, 0);
        this.paintDetail(ctx, size, mask, pack, filled);
    },

    paintDetail(ctx, size, mask, pack, filled) {
        if (pack.detail === 'flowers') {
            const clusters = Math.max(2, Math.round(size / 11));
            for (let i = 0; i < clusters; i++) {
                const x = Math.floor(this.hash(i + 5, mask, 733) * size);
                const y = Math.floor(this.hash(i + 17, mask, 741) * size);
                if (!filled[y * size + x]) continue;
                const colors = ['#ffd15c', '#ff90b3', '#fff1a8', '#d7a1ff', '#ffb45e'];
                ctx.fillStyle = colors[Math.floor(this.hash(i, mask, 751) * colors.length)];
                ctx.fillRect(x, y, 1, 1);
                if (size >= 24) ctx.fillRect(x + 1, y + 1, 1, 1);
            }
        } else if (pack.detail === 'moss') {
            const patches = Math.max(3, Math.round(size / 8));
            for (let i = 0; i < patches; i++) {
                const x = Math.floor(this.hash(i + 3, mask, 811) * size);
                const y = Math.floor(this.hash(i + 13, mask, 821) * size);
                const index = y * size + x;
                if (!filled[index]) continue;
                const h = this.hash(x, y, 829);
                ctx.fillStyle = h > 0.6 ? '#76994b' : '#5f7d3d';
                ctx.fillRect(x, y, 1, 1);
            }
        } else if (pack.detail === 'grit') {
            const specks = Math.max(4, Math.round(size * size / 180));
            for (let i = 0; i < specks; i++) {
                const x = Math.floor(this.hash(i + 3, mask, 877) * size);
                const y = Math.floor(this.hash(i + 11, mask, 887) * size);
                if (!filled[y * size + x]) continue;
                const h = this.hash(x, y, 899);
                ctx.fillStyle = h > 0.5 ? pack.fillDark : pack.fillLight;
                ctx.fillRect(x, y, 1, 1);
            }
        } else if (pack.detail === 'sparkle') {
            const specks = Math.max(3, Math.round(size / 7));
            for (let i = 0; i < specks; i++) {
                const x = Math.floor(this.hash(i + 5, mask, 941) * size);
                const y = Math.floor(this.hash(i + 19, mask, 947) * size);
                if (!filled[y * size + x]) continue;
                ctx.fillStyle = this.hash(x, y, 953) > 0.5 ? '#ffffff' : '#bcecff';
                ctx.fillRect(x, y, 1, 1);
            }
        }
    },

    generateMap() {
        const width = this.mapW;
        const height = this.mapH;
        const cells = new Uint8Array(width * height);
        const seed = Math.floor(Math.random() * 1000);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const nx = x / Math.max(1, width - 1);
                const ny = y / Math.max(1, height - 1);
                const value =
                    Math.sin((nx * 3.4 + seed * 0.013) * 6.2) +
                    Math.cos((ny * 2.8 - seed * 0.017) * 5.1) +
                    Math.sin((nx + ny) * 4.6 + seed * 0.01) * 0.8 +
                    Math.cos((nx - ny) * 3.8 - seed * 0.008) * 0.7;
                cells[y * width + x] = value > 0.55 ? 1 : 0;
            }
        }
        if (!cells.some(Boolean)) {
            const cx = Math.floor(width / 2);
            const cy = Math.floor(height / 2);
            for (let y = cy - 2; y <= cy + 2; y++) {
                for (let x = cx - 4; x <= cx + 4; x++) {
                    if (x >= 0 && y >= 0 && x < width && y < height) cells[y * width + x] = 1;
                }
            }
        }
        this.cells = cells;
    },

    /* ------------------------------------------------------------
       Editor <-> atlas
       ------------------------------------------------------------ */

    selectMask(mask) {
        mask = this.clamp(Number(mask) || 0, 0, 15);
        if (!this.layoutMasks().includes(mask)) mask = 15;
        if (this.editing) this.onEditorCommit();
        this.loadIntoEditor(mask);
    },

    loadIntoEditor(mask) {
        if (typeof State === 'undefined' || typeof DOM === 'undefined') return;
        mask = this.clamp(Number(mask) || 0, 0, 15);
        this.selectedMask = mask;
        this.editing = true;

        const tile = this.ensureTile(mask);
        if (!tile) return;

        if (!State.layers.length) State.addLayer('Layer 1');

        State.layers.forEach(layer => {
            const ctx = layer.canvas.getContext('2d');
            ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        });

        const target = State.layers[State.activeLayerIndex] || State.layers[0];
        const ctx = target.canvas.getContext('2d');
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
        ctx.drawImage(tile, 0, 0, target.canvas.width, target.canvas.height);
        ctx.restore();

        if (typeof LayerManager !== 'undefined') LayerManager.renderLayers();
        if (typeof TilemapCore !== 'undefined') TilemapCore.updatePreviews();
        State.markUnsaved();
        if (typeof State.saveState === 'function') State.saveState();

        this.renderAll();
        this.persist();

        if (typeof Notifications !== 'undefined') {
            new Notifications().info(`Mask #${mask} loaded into the editor`);
        }
    },

    ensureTile(mask) {
        if (!this.tiles[mask]) {
            const size = this.tileSize();
            this.tiles[mask] = this.makeCanvas(size, size);
        }
        return this.tiles[mask];
    },

    syncTileFromEditor() {
        if (!this.editing || typeof DOM === 'undefined' || !DOM.editorCanvas) return false;
        const tile = this.ensureTile(this.selectedMask);
        if (!tile) return false;
        const ctx = tile.getContext('2d');
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, tile.width, tile.height);
        ctx.drawImage(DOM.editorCanvas, 0, 0, tile.width, tile.height);
        ctx.restore();
        return true;
    },

    onEditorCommit() {
        if (!this.ready || !this.editing) return;
        if (!this.syncTileFromEditor()) return;
        this.renderAtlas();
        this.refreshPreview();
        this.persist();
    },

    saveCurrentToMask() {
        if (typeof DOM === 'undefined' || !DOM.editorCanvas) return;
        this.editing = true;
        if (!this.syncTileFromEditor()) return;
        this.renderAtlas();
        this.refreshPreview();
        this.persist();
        if (typeof Notifications !== 'undefined') {
            new Notifications().success(`Current tile saved to mask #${this.selectedMask}`);
        }
    },

    /* ------------------------------------------------------------
       Rendering
       ------------------------------------------------------------ */

    renderAll() {
        this.buildPackSelect();
        this.renderModeButtons();
        this.renderAtlas();
        this.refreshPreview();
        this.updateBadges();
    },

    renderModeButtons() {
        document.querySelectorAll('[data-atlas-mode]').forEach(button => {
            button.classList.toggle('active', Number(button.dataset.atlasMode) === this.mode);
        });
    },

    renderAtlas() {
        const grid = document.getElementById('atlas-grid');
        if (!grid) return;
        const masks = this.layoutMasks();
        grid.classList.toggle('mode-9', this.mode === 9);
        grid.innerHTML = '';

        masks.forEach(mask => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'atlas-tile' + (mask === this.selectedMask ? ' active' : '');
            button.dataset.mask = mask;
            button.title = `#${mask} · ${this.MASK_NAMES[mask] || 'Tile'}${this.mode === 9 && this.resolveMask(mask) !== mask ? ' (fallback)' : ''}`;

            const canvas = this.makeCanvas(56, 56);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            const tile = this.ensureTile(this.resolveMask(mask));
            if (tile) ctx.drawImage(tile, 0, 0, 56, 56);
            button.appendChild(canvas);

            const label = document.createElement('span');
            label.className = 'atlas-tile-label';
            const strong = document.createElement('strong');
            strong.textContent = `#${mask}`;
            const short = document.createElement('span');
            short.textContent = this.MASK_SHORT[mask] || 'Tile';
            label.appendChild(strong);
            label.appendChild(short);
            button.appendChild(label);

            grid.appendChild(button);
        });
    },

    refreshPreview() {
        if (!this.ready) return;
        if (this.editing) this.syncTileFromEditor();
        if (this.previewFrame) return;
        this.previewFrame = requestAnimationFrame(() => {
            this.previewFrame = null;
            this.renderPreview();
        });
    },

    renderPreview() {
        const canvas = document.getElementById('neighbour-preview');
        if (!canvas) return;
        const size = this.tileSize();
        const width = this.mapW * size;
        const height = this.mapH * size;
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const pack = this.getPack(this.pack);
        ctx.fillStyle = pack.background || '#0d1020';
        ctx.fillRect(0, 0, width, height);

        const valueAt = (x, y) => {
            if (x < 0 || y < 0 || x >= this.mapW || y >= this.mapH) return 0;
            return this.cells[y * this.mapW + x] || 0;
        };

        for (let y = 0; y <= this.mapH; y++) {
            for (let x = 0; x <= this.mapW; x++) {
                const mask =
                    (valueAt(x - 1, y - 1) ? 1 : 0) |
                    (valueAt(x, y - 1) ? 2 : 0) |
                    (valueAt(x - 1, y) ? 4 : 0) |
                    (valueAt(x, y) ? 8 : 0);
                const resolved = this.resolveMask(mask);
                const tile = this.ensureTile(resolved);
                if (!tile) continue;
                ctx.drawImage(tile, x * size - size / 2, y * size - size / 2, size, size);
            }
        }
    },

    updateBadges() {
        const modeBadge = document.getElementById('neighbourModeBadge');
        if (modeBadge) modeBadge.textContent = `${this.mode === 9 ? 9 : 16} masks`;
        const mapBadge = document.getElementById('neighbourMapBadge');
        if (mapBadge) mapBadge.textContent = `${this.mapW} × ${this.mapH} map`;
    },

    buildPackSelect() {
        const select = document.getElementById('atlasPackSelect');
        if (!select) return;
        const current = this.pack;
        select.innerHTML = '';
        this.PACKS.forEach(pack => {
            const option = document.createElement('option');
            option.value = pack.id;
            option.textContent = pack.title;
            select.appendChild(option);
        });
        select.value = current;
    },

    /* ------------------------------------------------------------
       Persistence
       ------------------------------------------------------------ */

    persist() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.toJSON()));
        } catch (error) {
            console.warn('Could not save tile atlas:', error);
        }
    },

    toJSON() {
        return {
            version: 1,
            pack: this.pack,
            mode: this.mode,
            selectedMask: this.selectedMask,
            editing: this.editing,
            mapW: this.mapW,
            mapH: this.mapH,
            cells: Array.from(this.cells),
            tiles: this.tiles.map(tile => tile ? tile.toDataURL('image/png') : null)
        };
    },

    loadSaved() {
        try {
            const parsed = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null');
            if (parsed && Array.isArray(parsed.tiles) && parsed.tiles.length === 16) return parsed;
        } catch (error) {
            console.warn('Could not load tile atlas:', error);
        }
        return null;
    },

    async fromJSON(data) {
        if (!data || !Array.isArray(data.tiles) || data.tiles.length !== 16) return false;
        const size = this.tileSize();
        this.pack = this.getPack(data.pack).id;
        this.mode = data.mode === 9 ? 9 : 16;
        this.selectedMask = this.clamp(Number(data.selectedMask) || 0, 0, 15);
        if (!this.layoutMasks().includes(this.selectedMask)) this.selectedMask = 15;
        this.editing = !!data.editing;
        this.mapW = this.clamp(Number(data.mapW) || 16, 4, 32);
        this.mapH = this.clamp(Number(data.mapH) || 9, 4, 32);

        const total = this.mapW * this.mapH;
        this.cells = new Uint8Array(total);
        if (Array.isArray(data.cells) && data.cells.length === total) {
            for (let i = 0; i < total; i++) this.cells[i] = data.cells[i] ? 1 : 0;
        } else {
            this.generateMap();
        }

        const loads = data.tiles.map((dataUrl, index) => new Promise(resolve => {
            const canvas = this.makeCanvas(size, size);
            if (!dataUrl) {
                resolve(canvas);
                return;
            }
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, size, size);
                ctx.drawImage(img, 0, 0, size, size);
                resolve(canvas);
            };
            img.onerror = () => resolve(canvas);
            img.src = dataUrl;
        }));

        this.tiles = await Promise.all(loads);
        if (!this.tiles.some(tile => this.tileHasPixels(tile))) {
            this.generatePack(this.pack);
        }
        this.buildPackSelect();
        return true;
    },

    tileHasPixels(canvas) {
        try {
            const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i]) return true;
            }
        } catch (error) {
            return false;
        }
        return false;
    },

    /* ------------------------------------------------------------
       Export
       ------------------------------------------------------------ */

    exportAtlas() {
        const masks = this.layoutMasks();
        const cols = this.mode === 9 ? 3 : 4;
        const rows = this.mode === 9 ? 3 : 4;
        const size = this.tileSize();
        const canvas = this.makeCanvas(cols * size, rows * size);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        masks.forEach((mask, index) => {
            const x = (index % cols) * size;
            const y = Math.floor(index / cols) * size;
            const tile = this.ensureTile(this.resolveMask(mask));
            if (tile) ctx.drawImage(tile, x, y, size, size);
        });

        const dataUrl = canvas.toDataURL('image/png');
        if (typeof FileManager !== 'undefined') {
            FileManager.downloadDataURL(dataUrl, `tile-atlas-${this.mode === 9 ? '3x3' : '4x4'}.png`);
        }
        if (typeof Notifications !== 'undefined') {
            new Notifications().success('Atlas exported as PNG');
        }
    },

    exportPreview() {
        const canvas = document.getElementById('neighbour-preview');
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        if (typeof FileManager !== 'undefined') {
            FileManager.downloadDataURL(dataUrl, 'neighbour-preview.png');
        }
    },

    /* ------------------------------------------------------------
       Events
       ------------------------------------------------------------ */

    bindEvents() {
        const packSelect = document.getElementById('atlasPackSelect');
        if (packSelect) {
            packSelect.addEventListener('change', () => {
                this.pack = packSelect.value;
            });
        }

        const loadPackBtn = document.getElementById('atlasLoadPackBtn');
        if (loadPackBtn) {
            loadPackBtn.addEventListener('click', () => {
                const select = document.getElementById('atlasPackSelect');
                this.generatePack(select ? select.value : this.pack);
                if (typeof Notifications !== 'undefined') {
                    new Notifications().success(`${this.getPack(this.pack).title} loaded into the atlas`);
                }
            });
        }

        const modeToggle = document.getElementById('atlasModeToggle');
        if (modeToggle) {
            modeToggle.addEventListener('click', (event) => {
                const button = event.target.closest('[data-atlas-mode]');
                if (!button) return;
                this.mode = Number(button.dataset.atlasMode) === 9 ? 9 : 16;
                if (!this.layoutMasks().includes(this.selectedMask)) this.selectedMask = 15;
                this.renderModeButtons();
                this.renderAtlas();
                this.updateBadges();
                this.persist();
            });
        }

        const grid = document.getElementById('atlas-grid');
        if (grid) {
            grid.addEventListener('click', (event) => {
                const button = event.target.closest('[data-mask]');
                if (!button) return;
                this.selectMask(Number(button.dataset.mask));
            });
        }

        const editSelectedBtn = document.getElementById('atlasEditSelectedBtn');
        if (editSelectedBtn) {
            editSelectedBtn.addEventListener('click', () => this.selectMask(this.selectedMask));
        }

        const saveCurrentBtn = document.getElementById('atlasSaveCurrentBtn');
        if (saveCurrentBtn) {
            saveCurrentBtn.addEventListener('click', () => this.saveCurrentToMask());
        }

        const resetBtn = document.getElementById('atlasResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (!confirm(`Reset the ${this.getPack(this.pack).title} starter pack? Atlas edits for this pack will be lost.`)) return;
                this.generatePack(this.pack);
                if (typeof Notifications !== 'undefined') new Notifications().info('Starter pack reset');
            });
        }

        const exportBtn = document.getElementById('atlasExportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportAtlas());
        }

        this.bindPreviewEvents();

        const creditsBtn = document.getElementById('creditsBtn');
        if (creditsBtn) {
            creditsBtn.addEventListener('click', () => this.openCredits());
        }
        const creditsClose = document.getElementById('credits-close');
        if (creditsClose) {
            creditsClose.addEventListener('click', () => this.closeCredits());
        }
        const creditsModal = document.getElementById('credits-modal');
        if (creditsModal) {
            creditsModal.addEventListener('click', (event) => {
                if (event.target === creditsModal) this.closeCredits();
            });
        }
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && creditsModal && creditsModal.classList.contains('open')) {
                this.closeCredits();
            }
        });
    },

    bindPreviewEvents() {
        const canvas = document.getElementById('neighbour-preview');
        if (canvas) {
            const paint = (event, value) => {
                const rect = canvas.getBoundingClientRect();
                const x = Math.floor((event.clientX - rect.left) / rect.width * this.mapW);
                const y = Math.floor((event.clientY - rect.top) / rect.height * this.mapH);
                if (x < 0 || y < 0 || x >= this.mapW || y >= this.mapH) return;
                const index = y * this.mapW + x;
                if (this.cells[index] === value) return;
                this.cells[index] = value;
                this.refreshPreview();
            };

            canvas.addEventListener('pointerdown', (event) => {
                if (event.button !== 0 && event.button !== 2) return;
                event.preventDefault();
                this.previewPainting = true;
                this.previewValue = event.button === 2 ? 0 : 1;
                const index = this.indexFromEvent(event, canvas);
                if (index >= 0) this.previewValue = this.cells[index] ? 0 : 1;
                paint(event, this.previewValue);
                try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
            });

            canvas.addEventListener('pointermove', (event) => {
                if (!this.previewPainting) return;
                paint(event, this.previewValue);
            });

            const stop = () => {
                if (!this.previewPainting) return;
                this.previewPainting = false;
                this.persist();
            };
            canvas.addEventListener('pointerup', stop);
            canvas.addEventListener('pointercancel', stop);
            canvas.addEventListener('pointerleave', () => {
                if (this.previewPainting) {
                    this.previewPainting = false;
                    this.persist();
                }
            });

            canvas.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                paint(event, 0);
                this.persist();
            });
        }

        const randomBtn = document.getElementById('neighbourRandomBtn');
        if (randomBtn) {
            randomBtn.addEventListener('click', () => {
                this.generateMap();
                this.refreshPreview();
                this.persist();
            });
        }

        const clearBtn = document.getElementById('neighbourClearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.cells.fill(0);
                this.refreshPreview();
                this.persist();
            });
        }

        const fillBtn = document.getElementById('neighbourFillBtn');
        if (fillBtn) {
            fillBtn.addEventListener('click', () => {
                this.cells.fill(1);
                this.refreshPreview();
                this.persist();
            });
        }

        const atlasBtn = document.getElementById('neighbourAtlasBtn');
        if (atlasBtn) {
            atlasBtn.addEventListener('click', () => {
                if (typeof UIManager !== 'undefined') {
                    UIManager.showPanelSections(['panel-atlas']);
                    UIManager.setActiveSidebarButton('atlasBtn');
                }
            });
        }

        const exportBtn = document.getElementById('neighbourExportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportPreview());
        }
    },

    indexFromEvent(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / rect.width * this.mapW);
        const y = Math.floor((event.clientY - rect.top) / rect.height * this.mapH);
        if (x < 0 || y < 0 || x >= this.mapW || y >= this.mapH) return -1;
        return y * this.mapW + x;
    },

    /* ------------------------------------------------------------
       Credits
       ------------------------------------------------------------ */

    openCredits() {
        const modal = document.getElementById('credits-modal');
        const content = document.getElementById('credits-content');
        if (!modal || !content) return;

        const packs = this.PACKS.map(pack => `
            <li>
                <strong>${pack.title}</strong>
                ${pack.description} All starter art is generated procedurally in the app.
            </li>
        `).join('');

        content.innerHTML = `
            <div class="credits-group">
                <h3><i class="fas fa-table-cells"></i> Starter tilesets</h3>
                <ul class="credits-list">
                    ${packs}
                    <li>
                        <strong>Terrain interaction sample</strong>
                        Inspired by the OpenGameArt <a href="https://opengameart.org/content/tile-map-pack" target="_blank" rel="noopener noreferrer">Tile Map Pack</a>.
                    </li>
                </ul>
            </div>
            <div class="credits-group">
                <h3><i class="fas fa-diagram-project"></i> Techniques &amp; references</h3>
                <ul class="credits-list">
                    <li>
                        <strong>Dual-grid auto-tiling</strong>
                        The 4-bit corner-mask atlas and neighbour preview follow the technique popularised by the
                        <a href="https://kaffemedbulla.itch.io/hand-drawn-dual-grid-tileset" target="_blank" rel="noopener noreferrer">Hand-drawn Dual Grid Tileset by Kaffe Medbulla</a>.
                        No external tileset artwork is bundled.
                    </li>
                    <li>
                        <strong>Kenney-style starter packs</strong>
                        If you want to add a Kenney pack later, use the Atlas export/import workflow in this editor;
                        Kenney's CC0 packs are available at <a href="https://kenney.nl/assets" target="_blank" rel="noopener noreferrer">kenney.nl/assets</a>.
                    </li>
                </ul>
            </div>
            <div class="credits-group">
                <h3><i class="fas fa-code"></i> Technology</h3>
                <div class="credits-tech">
                    <span>HTML5 Canvas 2D</span>
                    <span>Vanilla JavaScript</span>
                    <span>CSS custom properties</span>
                    <span>Font Awesome 6</span>
                    <span>Inter</span>
                    <span>Press Start 2P</span>
                </div>
            </div>
        `;

        modal.classList.add('open');
    },

    closeCredits() {
        const modal = document.getElementById('credits-modal');
        if (modal) modal.classList.remove('open');
    }
};
