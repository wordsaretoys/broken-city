/**
 * map generating worker thread
 */
(function() {

	// map generation buffer parameters
	var BufferSize = 65536;
	var MinBlockSize = 512;
	var BlockSizeRange = 1024;

	// map source layers
	var layers;

	// create and populate a buffer
	// with blocks of random numbers in range [0..1]
	// transitions between number blocks are smooth
	function createSpringBuffer() {
		var buffer = new Float32Array(BufferSize);
		var j = 0, y = 0, t = 0;
		for (var i = 0; i < BufferSize; i++, j--) {
			if (j == 0) {
				j = MinBlockSize + (BlockSizeRange * Math.random()) | 0;
				t = Math.random();
			}
			buffer[i] = y;
			y += (t - y) * 0.02;
		}
		return buffer;
	}

	// block noise generator
	function createNoiseFunction() {
		var fx = createSpringBuffer();
		var fy = createSpringBuffer();
		var ff = createSpringBuffer();
		return function(x, y) {
			var rx = fx[ (x * 0xffff) & 0xffff ];
			var ry = fy[ (y * 0xffff) & 0xffff ];
			return ff[ ( (rx + ry) * 0xffff) & 0xffff ];
		};
	}

	// map layer generator
	function createMapLayers() {
		layers = [];
		for (var l = 0; l < 9; l++) {
			layers[l] = createNoiseFunction();
		}
	}

	// handle a chunk generation request from the ui
	function getChunk(xoff, yoff, width, height) {
		var buffer = new Uint8Array(width * height * 4);
		var index = 0;
		var lylen = layers.length;
		var x, y, l;
		var xx, yy;
		var freq, acc, col;
		for (y = 0; y < height; y++) {
			yy = (y + yoff) * 0.001;
			for (x = 0; x < width; x++) {
				xx = (x + xoff) * 0.001;

				acc = 1;
				freq = 0.05;
				for (l = 0; l < lylen; l++) {
					acc *= layers[l](xx * freq, yy * freq);
					freq *= 1.93;
				}
				col = (Math.pow(acc, 2 / lylen) * 255) & 0xff;

				buffer[index++] = col;
				buffer[index++] = col * 0.9;
				buffer[index++] = col * 0.7;
				buffer[index++] = 255;
			}
		}
		return buffer;
	}

	addEventListener("message", function(e) {
		switch(e.data.cmd) {
		case "getChunk":
			postMessage({
				cmd: "setChunk",
				x: e.data.x,
				y: e.data.y,
				buffer: getChunk(
					e.data.x, e.data.y, 
					e.data.width, e.data.height
				)
			});
			break;
		}
	}, false);

	createMapLayers();

})();
