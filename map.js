/**
 * map of the broken city
 * ui module
 */
(function() {

	// length of a map chunk
	var ChunkSize = 256;

	// chunk discard distance
	var DiscardAt = ChunkSize * 16;

	// drawing canvas
	var canvas;
	
	// 2D context for canvas
	var context;

	// worker thread reference
	var worker;

	// virtual viewport
	var viewport = {
		x: 0, 
		y: 0,
		width: 0, 
		height: 0
	};

	// hash table of available map chunks
	var chunks = {};

	// mouse drag state
	var mouse = {
		down: false,
		x: 0,
		y: 0
	};

	// "empty" image block
	var empty;

	// get value to nearest chunk size
	function nearestChunk(x) {
		return ChunkSize * Math.floor(x / ChunkSize);
	}

	// create ui elements and worker thread
	function onInit() {
		canvas = document.createElement("canvas");
		document.body.appendChild(canvas);
		context = canvas.getContext("2d");

		empty = context.createImageData(ChunkSize, ChunkSize);
		for (var i = 0, il = ChunkSize * ChunkSize * 4; i < il; i++) {
			empty.data[i] = 127;
		}

		worker = new Worker("worker.js");
		worker.onerror = function(event) {
			console.log("worker thread error: " + 
				event.message + " at line " + event.lineno);
		};

		window.addEventListener("resize", onResize);

		canvas.addEventListener("mousedown", function(event) {
			onDown(event.clientX, event.clientY);
		});
		window.addEventListener("mouseup", function(event) {
			onUp();
		});
		canvas.addEventListener("mousemove", function(event) {
			onMove(event.clientX, event.clientY);
		});

		canvas.addEventListener("touchstart", function(event) {
			event.preventDefault();
			onDown(event.touches[0].clientX, event.touches[0].clientY);
		});
		window.addEventListener("touchend", function(event) {
			event.preventDefault();
			onUp();
		});
		canvas.addEventListener("touchmove", function(event) {
			event.preventDefault();
			onMove(event.touches[0].clientX, event.touches[0].clientY);
		});

		worker.addEventListener("message", onChunk);

		onResize();

	}

	// handle generic down event
	function onDown(x, y) {
		mouse.down = true;
		mouse.x = x;
		mouse.y = y;
	}

	// handle generic pointer move event
	function onMove(x, y) {
		if (mouse.down) {
			viewport.x += mouse.x - x;
			viewport.y += mouse.y - y;
			mouse.x = x;
			mouse.y = y;
			onDraw();
		}
	}

	// handle generic up event
	function onUp() {
		mouse.down = false;
	}

	// handle window resize event
	function onResize() {
		viewport.width = 
			canvas.width = document.body.clientWidth;
		viewport.height = 
			canvas.height = document.body.clientHeight;
		onDraw();
	}		

	// handle new chunk data event
	function onChunk(event) {
		var data = event.data;
		if (data.cmd == "setChunk") {
			var x = data.x;
			var y = data.y;
			var buffer = data.buffer;
			var image = context.createImageData(ChunkSize, ChunkSize);
			var length = image.width * image.height * 4;
			for (var i = 0; i < length; i++) {
				image.data[i] = buffer[i];
			}
			var key = x + "." + y;
			chunks[key] = {
				x: x,
				y: y,
				image: image
			};
			onDraw();
		}

		// discard distant chunks
		var keys = Object.keys(chunks);
		var dx, dy, ch;
		for (var i = 0, il = keys.length; i < il; i++) {
			ch = chunks[keys[i]];
			dx = ch.x - viewport.x;
			dy = ch.y - viewport.y;
			if (Math.sqrt(dx * dx + dy * dy) >= DiscardAt) {
				delete chunks[keys[i]];
			}
		}
	}

	// handle draw event
	function onDraw() {
		var cx0 = nearestChunk(viewport.x);
		var cy0 = nearestChunk(viewport.y);
		var cx1 = nearestChunk(viewport.x + viewport.width);
		var cy1 = nearestChunk(viewport.y + viewport.height);
		var cx, cy, ch, x, y, key;

		for (cx = cx0; cx <= cx1; cx += ChunkSize) {
			for (cy = cy0; cy <= cy1; cy += ChunkSize) {
				x = cx - viewport.x;
				y = cy - viewport.y;
				key = cx + "." + cy;
				ch = chunks[key];
				if (!ch) {
					// send away for missing chunk
					worker.postMessage({
						cmd: "getChunk",
						x: cx,
						y: cy,
						width: ChunkSize,
						height: ChunkSize
					});
					// display empty chunk instead
					ch = chunks[key] = {
						x: cx, 
						y: cy,
						image: empty
					};
				}
				context.putImageData(ch.image, x, y);
			}
		}
	}

	window.addEventListener("load", onInit);

})();
