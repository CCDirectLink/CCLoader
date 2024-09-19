let _canvas;
/** @returns {CanvasRenderingContext2D} */
function _getTmpContext(width, height) {
    if (!_canvas) {
        _canvas = document.createElement('canvas');
    }
    _canvas.width = width;
    _canvas.height = height;

    const context = _canvas.getContext('2d', { willReadFrequently: true });
    context.clearRect(0, 0, width, height);
    return context;
}

export function fixPatterns() {
    ig.ImagePattern.inject({
        // Only the draw calls and the assignment to this.image1 and this.image2 are changed. (usePatternDraw was removed because it is unused)
        initBuffer() {
            const scale = ig.system.scale;
            this.sourceX = this.sourceX ? this.sourceX * scale : 0;
            this.sourceY = this.sourceY ? this.sourceY * scale : 0;
            this.width = (this.width ? this.width : this.sourceImage.width) * scale;
            this.height = (this.height ? this.height : this.sourceImage.height) * scale;
            const opt = ig.ImagePattern.OPT;
            const widthFactor = Math.ceil((this.optMode == opt.NONE || this.optMode == opt.REPEAT_Y ? 1 : 256) / this.width);
            const heightFactor = Math.ceil((this.optMode == opt.NONE || this.optMode == opt.REPEAT_X ? 1 : 256) / this.height);
            const scaledWidth = widthFactor * this.width;
            const scaledHeight = heightFactor * this.height;
            const context = _getTmpContext(scaledWidth, this.optMode == opt.REPEAT_X_OR_Y ? this.height : scaledHeight);
            for (let y = 0; y < (this.optMode == opt.REPEAT_X_OR_Y ? 1 : heightFactor); ++y) {
                for (let x = 0; x < widthFactor; x++) {
                    context.drawImage(this.sourceImage.data, this.sourceX, this.sourceY, this.width, this.height, x * this.width, y * this.height, this.width, this.height);
                    ig.Image.drawCount++;
                }
            }
            this.image1 = document.createElement('img');
            this.image1.src = context.canvas.toDataURL();

            if (this.optMode == opt.REPEAT_X_OR_Y) {
                const context2 = _getTmpContext(this.width, scaledHeight);
                for (let y = 0; y < heightFactor; ++y) {
                    context.drawImage(this.sourceImage.data, this.sourceX, this.sourceY, this.width, this.height, 0, y * this.height, this.width, this.height);
                    ig.Image.drawCount++;
                }
                this.image2 = document.createElement('img');
                this.image2.src = context2.canvas.toDataURL();
            }
            this.totalWidth = scaledWidth;
            this.totalHeight = scaledHeight;
        },
        clearCached() {
            if (this.image1) {
                this.image1 = null;
            }
            if (this.image2) {
                this.image2 = null;
            }
        },
    });
    ig.ImagePattern.OPT = {
        NONE: 0,
        REPEAT_X: 1,
        REPEAT_Y: 2,
        REPEAT_X_OR_Y: 3,
        REPEAT_X_AND_Y: 4
    };
}