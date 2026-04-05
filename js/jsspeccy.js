/**
 * @license JSSpeccy v2.2.1 - http://jsspeccy.zxdemo.org/
 * Copyright 2014 Matt Westcott <matt@west.co.tt> and contributors
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of
 * the GNU General Public License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>.
 */

if (!window.DataView) window.DataView = jDataView;

function JSSpeccy(container, opts) {
	var self = {};

	if (typeof(container) === 'string') {
		container = document.getElementById(container);
	}
	if (!opts) {
		opts = {};
	}

	var originalDocumentTitle = document.title;


	/* == Z80 core == */
	/* define a list of rules to be triggered when the Z80 executes an opcode at a specified address;
		each rule is a tuple of (address, opcode, expression_to_run). If expression_to_run evaluates
		to false, the remainder of the opcode's execution is skipped */
	var z80Traps = [
		[0x056b, 0xc0, 'JSSpeccy.traps.tapeLoad()'],
		[0x0111, 0xc0, 'JSSpeccy.traps.tapeLoad()']
	];

	JSSpeccy.buildZ80({
		traps: z80Traps,
		applyContention: true
	});


	/* == Event mechanism == */
	function Event() {
		var self = {};
		var listeners = [];

		self.bind = function(callback) {
			listeners.push(callback);
		};
		self.unbind = function(callback) {
			for (var i = listeners.length - 1; i >= 0; i--) {
				if (listeners[i] == callback) listeners.splice(i, 1);
			}
		};
		self.trigger = function() {
			var args = arguments;
			/* event is considered 'cancelled' if any handler returned a value of false
				(specifically false, not just a falsy value). Exactly what this means is
				up to the caller - we just return false */
			var cancelled = false;
			for (var i = 0; i < listeners.length; i++) {
				cancelled = cancelled || (listeners[i].apply(null, args) === false);
			}
			return !cancelled;
		};

		return self;
	}

	function Setting(initialValue) {
		var self = {};

		var value = initialValue;

		self.onChange = Event();

		self.get = function() {
			return value;
		};
		self.set = function(newValue) {
			if (newValue == value) return;
			value = newValue;
			self.onChange.trigger(newValue);
		};
		return self;
	}

	self.settings = {
		'checkerboardFilter': Setting(opts.checkerboardFilter || false)
	};

	/* == Execution state == */
	self.isDownloading = false;
	self.isRunning = false;
	self.currentTape = null;
	var currentModel, spectrum;


	/* == Set up viewport == */
	var viewport = JSSpeccy.Viewport({
		container: container,
		scaleFactor: opts.scaleFactor || 2,
		onClickIcon: function() {self.start();}
	});

	if (!('dragToLoad' in opts) || opts['dragToLoad']) {
		/* set up drag event on canvas to load files */
		viewport.canvas.ondragenter = function() {
			// Needed for web browser compatibility
			return false;
		};
		viewport.canvas.ondragover = function () {
			// Needed for web browser compatibility
			return false;
		};
		viewport.canvas.ondrop = function(evt) {
			var files = evt.dataTransfer.files;
			self.loadLocalFile(files[0]);
			return false;
		};
	}

	function updateViewportIcon() {
		if (self.isDownloading) {
			viewport.showIcon('loading');
		} else if (!self.isRunning) {
			viewport.showIcon('play');
		} else {
			viewport.showIcon(null);
		}
	}


	/* == Keyboard control == */
	var keyboard = JSSpeccy.Keyboard();
	self.deactivateKeyboard = function() {
		keyboard.active = false;
	};
	self.activateKeyboard = function() {
		keyboard.active = true;
	};


	/* == Audio == */
	var soundBackend = JSSpeccy.SoundBackend();
	self.onChangeAudioState = Event();
	self.getAudioState = function() {
		return soundBackend.isEnabled;
	};
	self.setAudioState = function(requestedState) {
		var originalState = soundBackend.isEnabled;
		var newState = soundBackend.setAudioState(requestedState);
		if (originalState != newState) self.onChangeAudioState.trigger(newState);
	};

	/* == Snapshot / Tape file handling == */
	self.loadLocalFile = function(file, opts) {
		var reader = new FileReader();
		self.isDownloading = true;
		updateViewportIcon();
		reader.onloadend = function() {
			self.isDownloading = false;
			updateViewportIcon();
			self.loadFile(file.name, this.result, opts);
		};
		reader.readAsArrayBuffer(file);
	};
	self.loadFromUrl = function(url, opts) {
		var request = new XMLHttpRequest();

		request.addEventListener('error', function(e) {
			alert('Error loading from URL:' + url);
		});

		request.addEventListener('load', function(e) {
			self.isDownloading = false;
			updateViewportIcon();
			data = request.response;
			self.loadFile(url, data, opts);
			/* URL is not ideal for passing as the 'filename' argument - e.g. the file
			may be served through a server-side script with a non-indicative file
			extension - but it's better than nothing, and hopefully the heuristics
			in loadFile will figure out what it is either way.
			Ideally we'd look for a header like Content-Disposition for a better clue,
			but XHR (on Chrome at least) doesn't give us access to that. Grr. */
		});

		/* trigger XHR */
		request.open('GET', url, true);
		request.responseType = "arraybuffer";
		self.isDownloading = true;
		updateViewportIcon();
		request.send();
	};

	self.loadFile = function(name, data, opts) {
		if (!opts) opts = {};

		var fileType = 'unknown';
		if (name && name.match(/\.sna(\.zip)?$/i)) {
			fileType = 'sna';
		} else if (name && name.match(/\.tap(\.zip)?$/i)) {
			fileType = 'tap';
		} else if (name && name.match(/\.tzx(\.zip)?$/i)) {
			fileType = 'tzx';
		} else if (name && name.match(/\.z80(\.zip)?$/i)) {
			fileType = 'z80';
		} else {
			var signatureBytes = new Uint8Array(data, 0, 8);
			var signature = String.fromCharCode.apply(null, signatureBytes);
			if (signature == "ZXTape!\x1A") {
				fileType = 'tzx';
			} else if (data.byteLength === 49179 || data.byteLength === 131103 || data.byteLength === 147487) {
				fileType = 'sna';
			} else if (JSSpeccy.TapFile.isValid(data)) {
				fileType = 'tap';
			}
		}

		switch (fileType) {
			case 'sna':
				loadSnapshot(JSSpeccy.SnaFile(data));
				break;
			case 'z80':
				loadSnapshot(JSSpeccy.Z80File(data));
				break;
			case 'tap':
				loadTape(JSSpeccy.TapFile(data), opts);
				break;
			case 'tzx':
				loadTape(JSSpeccy.TzxFile(data), opts);
				break;
		}
	};

	/* Load a snapshot from a snapshot object (i.e. JSSpeccy.SnaFile or JSSpeccy.Z80File) */
	function loadSnapshot(snapshot) {
		self.setModel(snapshot.model);
		self.reset(); /* required for the scenario that setModel does not change the current
			active machine, and current machine state would interfere with the snapshot loading -
			e.g. paging is locked */
		spectrum.loadSnapshot(snapshot);
		if (!self.isRunning) {
			spectrum.drawFullScreen();
		}
	}
	function loadTape(tape, opts) {
		if (!opts) opts = {};
		self.currentTape = tape;
		if (opts.autoload) {
			var snapshotBuffer = JSSpeccy.autoloaders[currentModel.tapeAutoloader].buffer;
			var snapshot = JSSpeccy.Z80File(snapshotBuffer);
			loadSnapshot(snapshot);
		}
	}


	/* == Selecting Spectrum model == */
	self.onChangeModel = Event();
	self.getModel = function() {
		return currentModel;
	};
	self.setModel = function(newModel) {
		if (newModel != currentModel) {
			spectrum = JSSpeccy.Spectrum({
				viewport: viewport,
				keyboard: keyboard,
				model: newModel,
				soundBackend: soundBackend,
				controller: self,
				borderEnabled: ('border' in opts) ? opts.border : true
			});
			currentModel = newModel;
			initReferenceTime();
			self.onChangeModel.trigger(newModel);
		}
	};


	/* == Timing / main execution loop == */
	var msPerFrame;
	var remainingMs = 0; /* number of milliseconds that have passed that have not yet been
	'consumed' by running a frame of emulation */

	function initReferenceTime() {
		msPerFrame = (currentModel.frameLength * 1000) / currentModel.clockSpeed;
		remainingMs = 0;
		lastFrameStamp = performance.now();
	}

	var PERFORMANCE_FRAME_COUNT = 10;  /* average over this many frames when measuring performance */
	var performanceTotalMilliseconds = 0;
	var performanceFrameNum = 0;

	var requestAnimationFrame = (
		window.requestAnimationFrame || window.msRequestAnimationFrame ||
		window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		function(callback) {
			setTimeout(function() {
				callback(performance.now());
			}, 10);
		}
	);

	function tick() {
		if (!self.isRunning) return;

		stampBefore = performance.now();
		var timeElapsed = stampBefore - lastFrameStamp;
		remainingMs += stampBefore - lastFrameStamp;
		if (remainingMs > msPerFrame) {
			/* run a frame of emulation */
			spectrum.runFrame();
			var stampAfter = performance.now();

			if (opts.measurePerformance) {
				performanceTotalMilliseconds += (stampAfter - stampBefore);
				performanceFrameNum = (performanceFrameNum + 1) % PERFORMANCE_FRAME_COUNT;
				if (performanceFrameNum === 0) {
					document.title = originalDocumentTitle + ' ' + (performanceTotalMilliseconds / PERFORMANCE_FRAME_COUNT).toFixed(1) + " ms/frame; elapsed: " + timeElapsed;
					performanceTotalMilliseconds = 0;
				}
			}

			remainingMs -= msPerFrame;

			/* As long as requestAnimationFrame runs more frequently than the Spectrum's frame rate -
			which should normally be the case for a focused browser window (approx 60Hz vs 50Hz) -
			there should be either zero or one emulation frames run per call to tick(). If there's more
			than one emulation frame to run (i.e. remainingMs > msPerFrame at this point), we have
			insufficient performance to run at full speed (either the frame is taking more than 20ms to
			execute, or requestAnimationFrame is being called too infrequently). If so, clear
			remainingMs so that it doesn't grow indefinitely
			*/
			if (remainingMs > msPerFrame) remainingMs = 0;
		}
		lastFrameStamp = stampBefore;

		requestAnimationFrame(tick);
	}

	self.onStart = Event();
	self.start = function() {
		if (self.isRunning) return;
		self.isRunning = true;
		updateViewportIcon();
		self.onStart.trigger();

		initReferenceTime();

		requestAnimationFrame(tick);
	};
	self.onStop = Event();
	self.stop = function() {
		self.isRunning = false;
		updateViewportIcon();
		self.onStop.trigger();
	};
	self.reset = function() {
		spectrum.reset();
	};


	/* == Startup conditions == */
	self.setModel(JSSpeccy.Spectrum.MODEL_128K);

	if (opts.loadFile) {
		self.loadFromUrl(opts.loadFile, {'autoload': opts.autoload});
	}

	if (!('audio' in opts) || opts['audio']) {
		self.setAudioState(true);
	} else {
		self.setAudioState(false);
	}

	if (!('autostart' in opts) || opts['autostart']) {
		self.start();
	} else {
		self.stop();
	}


	return self;
}
JSSpeccy.traps = {};
JSSpeccy.traps.tapeLoad = function() {
	/* will be overridden when a JSSpeccy.Spectrum object is initialised */
};
JSSpeccy.Display = function(opts) {
	var self = {};
	
	var viewport = opts.viewport;
	var memory = opts.memory;
	var model = opts.model || JSSpeccy.Spectrum.MODEL_128K;
	var border = opts.borderEnabled;

	var checkerboardFilterEnabled = opts.settings.checkerboardFilter.get();
	opts.settings.checkerboardFilter.onChange.bind(function(newValue) {
		checkerboardFilterEnabled = newValue;
	});
	
	var palette = new Int32Array([
		/* RGBA dark */
		0x000000ff,
		0x2030c0ff,
		0xc04010ff,
		0xc040c0ff,
		0x40b010ff,
		0x50c0b0ff,
		0xe0c010ff,
		0xc0c0c0ff,
		/* RGBA bright */
		0x000000ff,
		0x3040ffff,
		0xff4030ff,
		0xff70f0ff,
		0x50e010ff,
		0x50e0ffff,
		0xffe850ff,
		0xffffffff
	]);

	var testUint8 = new Uint8Array(new Uint16Array([0x8000]).buffer);
	var isLittleEndian = (testUint8[0] === 0);
	if(isLittleEndian) {
		/* need to reverse the byte ordering of palette */
		for(var i = 0; i < 16; i++) {
			var color = palette[i];
			palette[i] = ((color << 24) & 0xff000000) | ((color << 8) & 0xff0000) | ((color >>> 8) & 0xff00) | ((color >>> 24) & 0xff);
		}
	}


	var LEFT_BORDER_CHARS = 4;
	var RIGHT_BORDER_CHARS = 4;
	var TOP_BORDER_LINES = 24;
	var BOTTOM_BORDER_LINES = 24;
	var TSTATES_PER_CHAR = 4;
	
	var TSTATES_UNTIL_ORIGIN = model.tstatesUntilOrigin;
	var TSTATES_PER_SCANLINE = model.tstatesPerScanline;
	self.frameLength = model.frameLength;
	
	var BEAM_X_MAX = 32 + (border ? RIGHT_BORDER_CHARS : 0);
	var BEAM_Y_MAX = 192 + (border ? BOTTOM_BORDER_LINES : 0);
	
	var CANVAS_WIDTH = 256 + (border ? ((LEFT_BORDER_CHARS + RIGHT_BORDER_CHARS) * 8) : 0);
	var CANVAS_HEIGHT = 192 + (border ? (TOP_BORDER_LINES + BOTTOM_BORDER_LINES) : 0);
	
	viewport.setResolution(CANVAS_WIDTH, CANVAS_HEIGHT);
	var ctx = viewport.canvas.getContext('2d');
	var imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
	var pixels = new Int32Array(imageData.data.buffer);

	/* for post-processing */
	var imageData2 = ctx.createImageData(imageData);
	var pixels2 = new Int32Array(imageData2.data.buffer);
	
	var borderColour = 7;
	self.setBorder = function(val) {
		borderColour = val;
	};
	
	var beamX, beamY; /* X character pos and Y pixel pos of beam at next screen event,
		relative to top left of non-border screen; negative / overlarge values are in the border */
	
	var pixelLineAddress; /* Address (relative to start of memory page) of the first screen byte in the current line */
	var attributeLineAddress; /* Address (relative to start of memory page) of the first attribute byte in the current line */
	var imageDataPos; /* offset into imageData buffer of current draw position */
	var currentLineStartTime;
	
	var flashPhase = 0;
	
	self.startFrame = function() {
		self.nextEventTime = currentLineStartTime = TSTATES_UNTIL_ORIGIN - (TOP_BORDER_LINES * TSTATES_PER_SCANLINE) - (LEFT_BORDER_CHARS * TSTATES_PER_CHAR);
		beamX = (border ? -LEFT_BORDER_CHARS : 0);
		beamY = (border ? -TOP_BORDER_LINES : 0);
		pixelLineAddress = 0x0000;
		attributeLineAddress = 0x1800;
		imageDataPos = 0;
		flashPhase = (flashPhase + 1) & 0x1f; /* FLASH has a period of 32 frames (16 on, 16 off) */
	};
	
	self.doEvent = function() {
		if (beamY < 0 | beamY >= 192 | beamX < 0 | beamX >= 32) {
			/* border */
			var color = palette[borderColour];
			pixels[imageDataPos++] = color;
			pixels[imageDataPos++] = color;
			pixels[imageDataPos++] = color;
			pixels[imageDataPos++] = color;
			pixels[imageDataPos++] = color;
			pixels[imageDataPos++] = color;
			pixels[imageDataPos++] = color;
			pixels[imageDataPos++] = color;
		} else {
			/* main screen area */
			var pixelByte = memory.readScreen( pixelLineAddress | beamX );
			var attributeByte = memory.readScreen( attributeLineAddress | beamX );
			
			var inkColor, paperColor;
			if ( (attributeByte & 0x80) && (flashPhase & 0x10) ) {
				/* FLASH: invert ink / paper */
				inkColor = palette[(attributeByte & 0x78) >> 3];
				paperColor = palette[(attributeByte & 0x07) | ((attributeByte & 0x40) >> 3)];
			} else {
				inkColor = palette[(attributeByte & 0x07) | ((attributeByte & 0x40) >> 3)];
				paperColor = palette[(attributeByte & 0x78) >> 3];
			}
			
			pixels[imageDataPos++] = (pixelByte & 0x80) ? inkColor : paperColor;
			pixels[imageDataPos++] = (pixelByte & 0x40) ? inkColor : paperColor;
			pixels[imageDataPos++] = (pixelByte & 0x20) ? inkColor : paperColor;
			pixels[imageDataPos++] = (pixelByte & 0x10) ? inkColor : paperColor;
			pixels[imageDataPos++] = (pixelByte & 0x08) ? inkColor : paperColor;
			pixels[imageDataPos++] = (pixelByte & 0x04) ? inkColor : paperColor;
			pixels[imageDataPos++] = (pixelByte & 0x02) ? inkColor : paperColor;
			pixels[imageDataPos++] = (pixelByte & 0x01) ? inkColor : paperColor;
		}
		
		/* increment beam / nextEventTime for next event */
		beamX++;
		if (beamX < BEAM_X_MAX) {
			self.nextEventTime += TSTATES_PER_CHAR;
		} else {
			beamX = (border ? -LEFT_BORDER_CHARS : 0);
			beamY++;
			
			if (beamY >= 0 && beamY < 192) {
				/* pixel address = 0 0 0 y7 y6 y2 y1 y0 | y5 y4 y3 x4 x3 x2 x1 x0 */
				pixelLineAddress = ( (beamY & 0xc0) << 5 ) | ( (beamY & 0x07) << 8 ) | ( (beamY & 0x38) << 2 );
				/* attribute address = 0 0 0 1 1 0 y7 y6 | y5 y4 y3 x4 x3 x2 x1 x0 */
				attributeLineAddress = 0x1800 | ( (beamY & 0xf8) << 2 );
			}
			
			if (beamY < BEAM_Y_MAX) {
				currentLineStartTime += TSTATES_PER_SCANLINE;
				self.nextEventTime = currentLineStartTime;
			} else {
				self.nextEventTime = null;
			}
		}
	};
	
	self.endFrame = function() {
		if (checkerboardFilterEnabled) {
			self.postProcess();
		} else {
			ctx.putImageData(imageData, 0, 0);
		}
	};

	self.drawFullScreen = function() {
		self.startFrame();
		while (self.nextEventTime) self.doEvent();
		self.endFrame();
	};

	self.postProcess = function() {
		var pix = pixels;
		pixels2.set(pix);
		var ofs = border ? (TOP_BORDER_LINES * CANVAS_WIDTH) + (LEFT_BORDER_CHARS << 3) : 0;
		var skip = border ? ((LEFT_BORDER_CHARS + RIGHT_BORDER_CHARS) << 3) : 0;
		var width = CANVAS_WIDTH;
		var x = 0, y = 1; /* 1-pixel top/bottom margin */
		var k0 = 0, k1 = 0, k2 = 0, k3 = 0, k4 = 0, k5 = 0, k6 = 0, k7 = 0, k8 = 0;
		var avg0, avg1, avg2;
		while (y++ < 191) {
			while (x++ < 256) {
				k0 = pix[ofs - 1]; k1 = pix[ofs]; k2 = pix[ofs + 1]; ofs += width;
				k3 = pix[ofs - 1]; k4 = pix[ofs]; k5 = pix[ofs + 1]; ofs += width;
				k6 = pix[ofs - 1]; k7 = pix[ofs]; k8 = pix[ofs + 1];
				
				var mixed = ((k4 !== k1 || k4 !== k7) && (k4 !== k3 || k4 !== k5));
				
				if (k4 === k0 && k4 === k2 && k4 !== k1 && k4 !== k3 && k4 !== k5) {
					pixels2[ofs - width] = (((k4 ^ k3) & 0xfefefefe) >> 1) + (k4 & k3);
				}
				else if (k4 === k6 && k4 === k8 && k4 !== k3 && k4 !== k5 && k4 !== k7) {
					pixels2[ofs - width] = (((k4 ^ k3) & 0xfefefefe) >> 1) + (k4 & k3);
				}
				else if (k4 === k0 && k4 === k6 && k4 !== k1 && k4 !== k3 && k4 !== k7) {
					pixels2[ofs - width] = (((k4 ^ k1) & 0xfefefefe) >> 1) + (k4 & k1);
				}
				else if (k4 === k2 && k4 === k8 && k4 !== k1 && k4 !== k5 && k4 !== k7) {
					pixels2[ofs - width] = (((k4 ^ k1) & 0xfefefefe) >> 1) + (k4 & k1);
				}
				else if (mixed) {
					avg0 = (((k3 ^ k5) & 0xfefefefe) >> 1) + (k3 & k5);
					avg1 = (((k1 ^ k7) & 0xfefefefe) >> 1) + (k1 & k7);
					avg2 = (((avg0 ^ avg1) & 0xfefefefe) >> 1) + (avg0 & avg1);
					avg2 = (((k4 ^ avg2) & 0xfefefefe) >> 1) + (k4 & avg2);
					pixels2[ofs - width] = (((k4 ^ avg2) & 0xfefefefe) >> 1) + (k4 & avg2);
				}
				ofs -= (width + width - 1);
			}
			ofs += skip;
			x = 0;
		}
		ctx.putImageData(imageData2, 0, 0);
	};

	return self;
};
JSSpeccy.IOBus = function(opts) {
	var self = {};
	
	var keyboard = opts.keyboard;
	var display = opts.display;
	var memory = opts.memory;
	var sound = opts.sound;
	var contentionTable = opts.contentionTable;
	var contentionTableLength = contentionTable.length;
	
	self.read = function(addr) {
		if ((addr & 0x0001) === 0x0000) {
			return keyboard.poll(addr);
		} else if ((addr & 0xc002) == 0xc000) {
			/* AY chip */
			return sound.readSoundRegister();
		} else if ((addr & 0x00e0) === 0x0000) {
			/* kempston joystick */
			return 0;
		} else {
			return 0xff;
		}
	};
	self.write = function(addr, val, tstates) {
		if (!(addr & 0x01)) {
			display.setBorder(val & 0x07);

			sound.updateBuzzer((val & 16) >> 4, tstates);
		}
		if (!(addr & 0x8002)) {
			memory.setPaging(val);
		}
		
		if ((addr & 0xc002) == 0xc000) {
			/* AY chip - register select */
			sound.selectSoundRegister( val & 0xF );
		}
		
		if ((addr & 0xc002) == 0x8000) {
			/* AY chip - data write */
			sound.writeSoundRegister(val, tstates);
		}
		
	};

	self.isULAPort = function(addr) {
		return ((addr & 0x0001) === 0x0000);
	};
	self.contend = function(addr, tstates) {
		return contentionTable[tstates % contentionTableLength];
	};

	return self;
};
JSSpeccy.Keyboard = function() {
	var self = {};
	self.active = true;
	
	var keyStates = [];
	for (var row = 0; row < 8; row++) {
		keyStates[row] = 0xff;
	}
	
	function keyDown(evt) {
		if (self.active) {
			registerKeyDown(evt.keyCode);
			if (!evt.metaKey) return false;
		}
	}
	function registerKeyDown(keyNum) {
		var keyCode = keyCodes[keyNum];
		if (keyCode == null) return;
		keyStates[keyCode.row] &= ~(keyCode.mask);
		if (keyCode.caps) keyStates[0] &= 0xfe;
	}
	function keyUp(evt) {
		registerKeyUp(evt.keyCode);
		if (self.active && !evt.metaKey) return false;
	}
	function registerKeyUp(keyNum) {
		var keyCode = keyCodes[keyNum];
		if (keyCode == null) return;
		keyStates[keyCode.row] |= keyCode.mask;
		if (keyCode.caps) keyStates[0] |= 0x01;
	}
	function keyPress(evt) {
		if (self.active && !evt.metaKey) return false;
	}
	
	var keyCodes = {
		49: {row: 3, mask: 0x01}, /* 1 */
		50: {row: 3, mask: 0x02}, /* 2 */
		51: {row: 3, mask: 0x04}, /* 3 */
		52: {row: 3, mask: 0x08}, /* 4 */
		53: {row: 3, mask: 0x10}, /* 5 */
		54: {row: 4, mask: 0x10}, /* 6 */
		55: {row: 4, mask: 0x08}, /* 7 */
		56: {row: 4, mask: 0x04}, /* 8 */
		57: {row: 4, mask: 0x02}, /* 9 */
		48: {row: 4, mask: 0x01}, /* 0 */
	
		81: {row: 2, mask: 0x01}, /* Q */
		87: {row: 2, mask: 0x02}, /* W */
		69: {row: 2, mask: 0x04}, /* E */
		82: {row: 2, mask: 0x08}, /* R */
		84: {row: 2, mask: 0x10}, /* T */
		89: {row: 5, mask: 0x10}, /* Y */
		85: {row: 5, mask: 0x08}, /* U */
		73: {row: 5, mask: 0x04}, /* I */
		79: {row: 5, mask: 0x02}, /* O */
		80: {row: 5, mask: 0x01}, /* P */
	
		65: {row: 1, mask: 0x01}, /* A */
		83: {row: 1, mask: 0x02}, /* S */
		68: {row: 1, mask: 0x04}, /* D */
		70: {row: 1, mask: 0x08}, /* F */
		71: {row: 1, mask: 0x10}, /* G */
		72: {row: 6, mask: 0x10}, /* H */
		74: {row: 6, mask: 0x08}, /* J */
		75: {row: 6, mask: 0x04}, /* K */
		76: {row: 6, mask: 0x02}, /* L */
		13: {row: 6, mask: 0x01}, /* enter */
	
		16: {row: 0, mask: 0x01}, /* caps */
		192: {row: 0, mask: 0x01}, /* backtick as caps - because firefox screws up a load of key codes when pressing shift */
		90: {row: 0, mask: 0x02}, /* Z */
		88: {row: 0, mask: 0x04}, /* X */
		67: {row: 0, mask: 0x08}, /* C */
		86: {row: 0, mask: 0x10}, /* V */
		66: {row: 7, mask: 0x10}, /* B */
		78: {row: 7, mask: 0x08}, /* N */
		77: {row: 7, mask: 0x04}, /* M */
		17: {row: 7, mask: 0x02}, /* sym - gah, firefox screws up ctrl+key too */
		32: {row: 7, mask: 0x01}, /* space */
		
		/* shifted combinations */
		8: {row: 4, mask: 0x01, caps: true}, /* backspace => caps + 0 */
		37: {row: 3, mask: 0x10, caps: true}, /* left arrow => caps + 5 */
		38: {row: 4, mask: 0x08, caps: true}, /* up arrow => caps + 7 */
		39: {row: 4, mask: 0x04, caps: true}, /* right arrow => caps + 8 */
		40: {row: 4, mask: 0x10, caps: true}, /* down arrow => caps + 6 */
		
		999: null
	};
	
	self.poll = function(addr) {
		var result = 0xff;
		for (var row = 0; row < 8; row++) {
			if (!(addr & (1 << (row+8)))) { /* bit held low, so scan this row */
				result &= keyStates[row];
			}
		}
		return result;
	}
	
	document.onkeydown = keyDown;
	document.onkeyup = keyUp;
	document.onkeypress = keyPress;
	
	return self;
}
JSSpeccy.Memory = function(opts) {
	var self = {};
	var model = opts.model || JSSpeccy.Spectrum.MODEL_128K;

	var contentionTableLength = model.frameLength;

	var noContentionTable = model.noContentionTable;
	var contentionTable = model.contentionTable;

	function MemoryPage(data, isContended) {
		var self = {};
		self.memory = (data || new Uint8Array(0x4000));
		self.contentionTable = (isContended ? contentionTable : noContentionTable);
		return self;
	}
	
	var ramPages = [];
	for (var i = 0; i < 8; i++) {
		ramPages[i] = MemoryPage(null, i & 0x01); /* for MODEL_128K (and implicitly 48K), odd pages are contended */
	}

	var romPages = {
		'48.rom': MemoryPage(JSSpeccy.roms['48.rom']),
		'128-0.rom': MemoryPage(JSSpeccy.roms['128-0.rom']),
		'128-1.rom': MemoryPage(JSSpeccy.roms['128-1.rom'])
	};

	var scratch = MemoryPage();
	
	var readSlots = [
		model === JSSpeccy.Spectrum.MODEL_48K ? romPages['48.rom'].memory : romPages['128-0.rom'].memory,
		ramPages[5].memory,
		ramPages[2].memory,
		ramPages[0].memory
	];

	var writeSlots = [
		scratch.memory,
		ramPages[5].memory,
		ramPages[2].memory,
		ramPages[0].memory
	];

	var contentionBySlot = [
		noContentionTable,
		contentionTable,
		noContentionTable,
		noContentionTable
	];

	self.isContended = function(addr) {
		return (contentionBySlot[addr >> 14] == contentionTable);
	};

	self.contend = function(addr, tstate) {
		return contentionBySlot[addr >> 14][tstate % contentionTableLength];
	};

	self.read = function(addr) {
		var page = readSlots[addr >> 14];
		return page[addr & 0x3fff];
	};
	self.write = function(addr, val) {
		var page = writeSlots[addr >> 14];
		page[addr & 0x3fff] = val;
	};
	
	var screenPage = ramPages[5].memory;
	self.readScreen = function(addr) {
		return screenPage[addr];
	};

	var pagingIsLocked = false;
	if (model === JSSpeccy.Spectrum.MODEL_128K) {
		self.setPaging = function(val) {
			if (pagingIsLocked) return;
			var highMemoryPage = ramPages[val & 0x07];
			readSlots[3] = writeSlots[3] = highMemoryPage.memory;
			contentionBySlot[3] = highMemoryPage.contentionTable;
			readSlots[0] = (val & 0x10) ? romPages['128-1.rom'].memory : romPages['128-0.rom'].memory;
			screenPage = (val & 0x08) ? ramPages[7].memory : ramPages[5].memory;
			pagingIsLocked = val & 0x20;
		};
	} else {
		self.setPaging = function(val) {
		};
	}
	
	self.loadFromSnapshot = function(snapshotPages) {
		for (var p in snapshotPages) {
			var ramPage = ramPages[p].memory;
			var snapshotPage = snapshotPages[p];
			for (var i = 0; i < 0x4000; i++) {
				ramPage[i] = snapshotPage[i];
			}
		}
	};

	self.reset = function() {
		pagingIsLocked = false;
		self.setPaging(0);
	};

	return self;
};
// Sound routines for jsspeccy
// General sound routines and 48k buzzer emulation written by Darren Coles
// 128k Spectrum sound routines developed from DelphiSpec emulator (credits below).
// (c) 2013 Darren Coles
//
// Credits from DelphiSpec:
//
//  Routines for emulating the 128K Spectrum's AY-3-8912 sound generator
//
//  Author: James Bagg <chipmunk_uk_1@hotmail.com>
//
//   With minor optimisations and mods by
//           Chris Cowley <ccowley@grok.co.uk>
//
//   Translation to Delphi Object Pascal by
//           Jari Korhonen <jarit.korhonen@luukku.com>
//
//   Copyright (C)1999-2000 Grok Developments Ltd  and James Bagg
//   http://www.grok.co.uk/      http://www.chipmunks-corner.co.uk
//   This program is free software; you can redistribute it and/or
//   modify it under the terms of the GNU General Public License
//   as published by the Free Software Foundation; either version 2
//   of the License, or (at your option) any later version.
//   This program is distributed in the hope that it will be useful,
//   but WITHOUT ANY WARRANTY; without even the implied warranty of
//   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//   GNU General Public License for more details.
//
//   You should have received a copy of the GNU General Public License
//   along with this program; if not, write to the Free Software
//   Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
//
// *******************************************************************************/

JSSpeccy.SoundGenerator = function(opts) {
	var self = {};

	var clockSpeed = opts.model.clockSpeed;
	var frameLength = opts.model.frameLength;
	var backend = opts.soundBackend;
	var sampleRate = backend.sampleRate;
	var samplesPerFrame = Math.floor(sampleRate * frameLength / clockSpeed); /* TODO: account for this not being an integer by generating a variable number of samples per frame */

	var oversampleRate = 8;
	var buzzer_val = 0;

	var soundData = new Array();
	var soundDataFrameBytes = 0;

	var lastaudio = 0;

	var frameCount = 0;

	var audio = null;
	var audioContext = null;
	var audioNode = null;

	var WCount = 0;
	var lCounter = 0;

	var aySoundData = new Array;
	var soundDataAyFrameBytes = 0;


	var ayRegSelected = 0;
	var lastAyAudio = 0;

	//ay stuff
	var MAX_OUTPUT = 63;
    var AY_STEP = 32768;
    var MAXVOL  = 31;

	// AY register ID's
	var AY_AFINE = 0;
  	var AY_ACOARSE = 1;
  	var AY_BFINE = 2;
  	var AY_BCOARSE = 3;
  	var AY_CFINE = 4;
  	var AY_CCOARSE = 5;
  	var AY_NOISEPER = 6;
  	var AY_ENABLE = 7;
  	var AY_AVOL = 8;
  	var AY_BVOL = 9;
  	var AY_CVOL = 10;
  	var AY_EFINE = 11;
  	var AY_ECOARSE = 12;
  	var AY_ESHAPE = 13;
  	var AY_PORTA = 14;
  	var AY_PORTB = 15;
	
	var RegArray = new Int32Array(16);
    var VolTableArray 
	
	var AY8912_sampleRate = 0;
    var AY8912_register_latch=0;
    var AY8912_Regs = new Int32Array(16);
    var AY8912_UpdateStep = 0;//Double;
    var AY8912_PeriodA = 0;
    var AY8912_PeriodB = 0;
    var AY8912_PeriodC = 0;
    var AY8912_PeriodN = 0;
    var AY8912_PeriodE = 0;
    var AY8912_CountA = 0;
    var AY8912_CountB = 0;
    var AY8912_CountC = 0;
    var AY8912_CountN = 0;
    var AY8912_CountE = 0;
    var AY8912_VolA = 0;
    var AY8912_VolB = 0;
    var AY8912_VolC = 0;
    var AY8912_VolE = 0;
    var AY8912_EnvelopeA = 0;
    var AY8912_EnvelopeB = 0;
    var AY8912_EnvelopeC = 0;
    var AY8912_OutputA = 0;
    var AY8912_OutputB = 0;
    var AY8912_OutputC = 0;
    var AY8912_OutputN = 0;
    var AY8912_CountEnv = 0;
    var AY8912_Hold = 0;
    var AY8912_Alternate = 0;
    var AY8912_Attack = 0;
    var AY8912_Holding = 0;
    var AY8912_VolTable2 = new Int32Array(64);
	
	var AY_OutNoise = 0;
	AY8912_init(clockSpeed / 2, sampleRate, 8);

	function AY8912_reset() {
		AY8912_register_latch = 0;
		AY8912_OutputA = 0;
		AY8912_OutputB = 0;
		AY8912_OutputC = 0;
		AY8912_OutputN = 0xFF;
		AY8912_PeriodA = 0;
		AY8912_PeriodB = 0;
		AY8912_PeriodC = 0;
		AY8912_PeriodN = 0;
		AY8912_PeriodE = 0;
		AY8912_CountA = 0;
		AY8912_CountB = 0;
		AY8912_CountC = 0;
		AY8912_CountN = 0;
		AY8912_CountE = 0;
		AY8912_VolA = 0;
		AY8912_VolB = 0;
		AY8912_VolC = 0;
		AY8912_VolE = 0;
		AY8912_EnvelopeA = 0;
		AY8912_EnvelopeB = 0;
		AY8912_EnvelopeC = 0;
		AY8912_CountEnv = 0;
		AY8912_Hold = 0;
		AY8912_Alternate = 0;
		AY8912_Holding = 0;
		AY8912_Attack = 0;
		
		for (var i = 0; i<=AY_PORTA; i++) {
			AYWriteReg(i, 0);     //* AYWriteReg() uses the timer system; we cannot
		}                    //* call it at this time because the timer system
                          //* has not been initialized.
	}
	
	function AY8912_set_clock(clock) {
    // the AY_STEP clock for the tone and noise generators is the chip clock    
    //divided by 8; for the envelope generator of the AY-3-8912, it is half 
    // that much (clock/16), but the envelope of the YM2149 goes twice as    
    // fast, therefore again clock/8.                                        
    // Here we calculate the number of AY_STEPs which happen during one sample  
    // at the given sample rate. No. of events = sample rate / (clock/8).    */
    // AY_STEP is a multiplier used to turn the fraction into a fixed point     */
    // number.}
		var t1 = AY_STEP * AY8912_sampleRate * 8.0;
		AY8912_UpdateStep = t1 / clock;
	}

//
// ** set output gain
// **
// ** The gain is expressed in 0.2dB increments, e.g. a gain of 10 is an increase
// ** of 2dB. Note that the gain only affects sounds not playing at full volume,
// ** since the ones at full volume are already played at the maximum intensity
// ** allowed by the sound card.
// ** 0x00 is the default.
// ** 0xff is the maximum allowed value.
// 

	function AY8912_set_volume(volume,gain) {
		var i, out1, out2;	
    
		gain = gain & 0xFF;

		// increase max output basing on gain (0.2 dB per AY_STEP) */
		out1 = MAX_OUTPUT;
		out2 = MAX_OUTPUT;

		while (gain > 0) 
		{
			gain--;
			out1 = out1 * 1.023292992;  ///* = (10 ^ (0.2/20)) */
			out2 = out2 * 1.023292992;
		}

		//  calculate the volume.voltage conversion table 
		//  The AY-3-8912 has 16 levels, in a logarithmic scale (3dB per AY_STEP) 
		//  The YM2149 still has 16 levels for the tone generators, but 32 for 
		//  the envelope generator (1.5dB per AY_STEP).
		for (var i = 31; i>=0; i--) {
			//* limit volume to avoid clipping */
			if (out2 > MAX_OUTPUT) 
				AY8912_VolTable2[i] = MAX_OUTPUT
			else
				AY8912_VolTable2[i] = Math.round(out2);

			out1 = out1 / 1.188502227; // .188502227 '/* = 10 ^ (1.5/20) = 1.5dB */
			out2 = out2 / 1.188502227  // .188502227
		}
		AY8912_VolTable2[63] = MAX_OUTPUT;
	}

	function AYWriteReg(r,v) {
		var old;

		AY8912_Regs[r] = v;

	  //'/* A note about the period of tones, noise and envelope: for speed reasons,*/
	  //'/* we count down from the period to 0, but careful studies of the chip     */
	  //'/* output prove that it instead counts up from 0 until the counter becomes */
	  //'/* greater or equal to the period. This is an important difference when the*/
	  //'/* program is rapidly changing the period to modulate the sound.           */
	  //'/* To compensate for the difference, when the period is changed we adjust  */
	  //'/* our internal counter.                                                   */
	  //'/* Also, note that period = 0 is the same as period = 1. This is mentioned */
	  //'/* in the YM2203 data sheets. However, this does NOT apply to the Envelope */
	  //'/* period. In that case, period = 0 is half as period = 1. 
	  switch (r ) 
	  {
		case AY_AFINE:
		case AY_ACOARSE:
		  
			AY8912_Regs[AY_ACOARSE] = AY8912_Regs[AY_ACOARSE] & 0xF;

			old = AY8912_PeriodA;

			AY8912_PeriodA = Math.round((AY8912_Regs[AY_AFINE] + (256 * AY8912_Regs[AY_ACOARSE]))
			   *AY8912_UpdateStep);

			if (AY8912_PeriodA == 0)
			  AY8912_PeriodA = Math.round(AY8912_UpdateStep);

			AY8912_CountA = AY8912_CountA + (AY8912_PeriodA - old);

			if (AY8912_CountA <= 0) 
			  AY8912_CountA = 1;
		  break;
		case AY_BFINE:
		case AY_BCOARSE:
		  
			AY8912_Regs[AY_BCOARSE] = AY8912_Regs[AY_BCOARSE] & 0xF;

			old = AY8912_PeriodB;

			AY8912_PeriodB = Math.round((AY8912_Regs[AY_BFINE] + (256 * AY8912_Regs[AY_BCOARSE]))
			  * AY8912_UpdateStep);

			if (AY8912_PeriodB == 0) 
			  AY8912_PeriodB = Math.round(AY8912_UpdateStep);

			AY8912_CountB = AY8912_CountB + AY8912_PeriodB - old;

			if (AY8912_CountB <= 0) 
			  AY8912_CountB = 1;
		  break;

		case AY_CFINE:
		case AY_CCOARSE:
		  
			AY8912_Regs[AY_CCOARSE] = AY8912_Regs[AY_CCOARSE] & 0xF;

			old = AY8912_PeriodC;

			AY8912_PeriodC = Math.round((AY8912_Regs[AY_CFINE] + (256 * AY8912_Regs[AY_CCOARSE]))
			  * AY8912_UpdateStep);

			if (AY8912_PeriodC == 0) 
			  AY8912_PeriodC = Math.round(AY8912_UpdateStep);

			AY8912_CountC = AY8912_CountC + (AY8912_PeriodC - old);

			if (AY8912_CountC <= 0) 
			  AY8912_CountC = 1;
		  break;

		case AY_NOISEPER:
		  
			AY8912_Regs[AY_NOISEPER] = AY8912_Regs[AY_NOISEPER] & 0x1F;

			old = AY8912_PeriodN;

			AY8912_PeriodN = Math.round(AY8912_Regs[AY_NOISEPER] * AY8912_UpdateStep);

			if (AY8912_PeriodN == 0) 
			  AY8912_PeriodN = Math.round(AY8912_UpdateStep);

			AY8912_CountN = AY8912_CountN + (AY8912_PeriodN - old);

			if (AY8912_CountN <= 0) 
			  AY8912_CountN = 1;
		  break;

		case AY_AVOL:
		  
			AY8912_Regs[AY_AVOL] = AY8912_Regs[AY_AVOL] & 0x1F;

			AY8912_EnvelopeA = AY8912_Regs[AY_AVOL] & 0x10;

			if (AY8912_EnvelopeA != 0) 
				AY8912_VolA = AY8912_VolE
			else
			{
				if (AY8912_Regs[AY_AVOL] != 0) 
					AY8912_VolA = AY8912_VolTable2[AY8912_Regs[AY_AVOL] * 2 + 1]
				else
					AY8912_VolA = AY8912_VolTable2[0];
			}
		  break;

		case AY_BVOL:
		  
			AY8912_Regs[AY_BVOL] = AY8912_Regs[AY_BVOL] & 0x1F;

			AY8912_EnvelopeB = AY8912_Regs[AY_BVOL] & 0x10;

			if (AY8912_EnvelopeB != 0) 
				AY8912_VolB = AY8912_VolE
			else
			{
				if (AY8912_Regs[AY_BVOL] != 0) 
					AY8912_VolB = AY8912_VolTable2[AY8912_Regs[AY_BVOL] * 2 + 1]
				else
					AY8912_VolB = AY8912_VolTable2[0];
			};
		  break;

		case AY_CVOL:
		  
			AY8912_Regs[AY_CVOL] = AY8912_Regs[AY_CVOL] & 0x1F;

			AY8912_EnvelopeC = AY8912_Regs[AY_CVOL] & 0x10;

			if (AY8912_EnvelopeC != 0) 
				AY8912_VolC = AY8912_VolE
			else
			{
				if (AY8912_Regs[AY_CVOL] != 0) 
					AY8912_VolC = AY8912_VolTable2[AY8912_Regs[AY_CVOL] * 2 + 1]
				else
					AY8912_VolC = AY8912_VolTable2[0];
			};
		  break;

		case AY_EFINE:
		case AY_ECOARSE:
		  
			old = AY8912_PeriodE;

			AY8912_PeriodE = Math.round(((AY8912_Regs[AY_EFINE] + (256 * AY8912_Regs[AY_ECOARSE])))
			  * AY8912_UpdateStep);

			if (AY8912_PeriodE == 0) 
			  AY8912_PeriodE = Math.round(AY8912_UpdateStep / 2);

			AY8912_CountE = AY8912_CountE + (AY8912_PeriodE - old);

			if (AY8912_CountE <= 0) 
			  AY8912_CountE = 1
		  break;

		case AY_ESHAPE:
		  
			//'/* envelope shapes:
			//'C AtAlH
			//'0 0 x x  \___
			//'
			//'0 1 x x  /___
			//'
			//'1 0 0 0  \\\\
			//'
			//'1 0 0 1  \___
			//'
			//'1 0 1 0  \/\/
			//'          ___
			//'1 0 1 1  \
			//'
			//'1 1 0 0  ////
			//'          ___
			//'1 1 0 1  /
			//'
			//'1 1 1 0  /\/\
			//'
			//'1 1 1 1  /___
			//'
			//'The envelope counter on the AY-3-8910 has 16 AY_STEPs. On the YM2149 it
			//'has twice the AY_STEPs, happening twice as fast. Since the end result is
			//'just a smoother curve, we always use the YM2149 behaviour.
			//'*/}
			if (AY8912_Regs[AY_ESHAPE] != 0xFF) 
			{
			  AY8912_Regs[AY_ESHAPE] = AY8912_Regs[AY_ESHAPE] & 0xF;

			  if ((AY8912_Regs[AY_ESHAPE] & 0x4) == 0x4) 
				AY8912_Attack = MAXVOL
			  else
				AY8912_Attack = 0x0;

			  AY8912_Hold = AY8912_Regs[AY_ESHAPE] & 0x1;

			  AY8912_Alternate = AY8912_Regs[AY_ESHAPE] & 0x2;

			  AY8912_CountE = AY8912_PeriodE;

			  AY8912_CountEnv = MAXVOL; // &h1f

			  AY8912_Holding = 0;

			  AY8912_VolE = AY8912_VolTable2[AY8912_CountEnv ^ AY8912_Attack];

			  if (AY8912_EnvelopeA != 0) 
				AY8912_VolA = AY8912_VolE;

			  if (AY8912_EnvelopeB != 0) 
				AY8912_VolB = AY8912_VolE;

			  if (AY8912_EnvelopeC != 0) 
				AY8912_VolC = AY8912_VolE;
			}
		  break;
	  }
	}

	function AYReadReg(r) {
		return AY8912_Regs[r];
	}


	function AY8912_init(clock, sample_rate, sample_bits) {
	  AY8912_sampleRate = sample_rate;
	  AY8912_set_clock(clock);
	  AY8912_set_volume(255, 12);
	  AY8912_reset();
	  return 0;
	}

	function AY8912Update_8() {
		var Buffer_Length = 400;
			
		  //  The 8910 has three outputs, each output is the mix of one of the three 
		  //  tone generators and of the (single) noise generator. The two are mixed 
		  //  BEFORE going into the DAC. The formula to mix each channel is: 
		  //  (ToneOn | ToneDisable) & (NoiseOn | NoiseDisable). 
		  //  Note that this means that if both tone and noise are disabled, the output 
		  //  is 1, not 0, and can be modulated changing the volume. 
		  //  if the channels are disabled, set their output to 1, and increase the 
		  //  counter, if necessary, so they will not be inverted during this update. 
		  //  Setting the output to 1 is necessary because a disabled channel is locked 
		  //  into the ON state (see above); and it has no effect if the volume is 0. 
		  //  if the volume is 0, increase the counter, but don't touch the output. 

		  if ((AY8912_Regs[AY_ENABLE] & 0x1) == 0x1) {
		  
			if (AY8912_CountA <= (Buffer_Length * AY_STEP))
				AY8912_CountA = AY8912_CountA + (Buffer_Length * AY_STEP);

			AY8912_OutputA = 1;
		  }
		  else if (AY8912_Regs[AY_AVOL] == 0) {
		  
			  // note that I do count += Buffer_Length, NOT count = Buffer_Length + 1. You might think
			  // it's the same since the volume is 0, but doing the latter could cause
			  // interferencies when the program is rapidly modulating the volume.
			  if (AY8912_CountA <= (Buffer_Length * AY_STEP))
				AY8912_CountA = AY8912_CountA + (Buffer_Length * AY_STEP);
		  }

		  if ((AY8912_Regs[AY_ENABLE] & 0x2) == 0x2) {
		  
			  if (AY8912_CountB <= (Buffer_Length * AY_STEP)) 
				AY8912_CountB = AY8912_CountB + (Buffer_Length * AY_STEP);

			  AY8912_OutputB = 1;
		  }
		  else if (AY8912_Regs[AY_BVOL] == 0) {
			  if (AY8912_CountB <= (Buffer_Length * AY_STEP) )
				AY8912_CountB = AY8912_CountB + (Buffer_Length * AY_STEP);
		  }

		  if ((AY8912_Regs[AY_ENABLE] & 0x4) == 0x4) {
			  if (AY8912_CountC <= (Buffer_Length * AY_STEP)) 
				AY8912_CountC = AY8912_CountC + (Buffer_Length * AY_STEP);

			  AY8912_OutputC = 1;
		  }
		  else if ((AY8912_Regs[AY_CVOL] ==0 )) {
			  if (AY8912_CountC <= (Buffer_Length * AY_STEP)) 
				AY8912_CountC = AY8912_CountC + (Buffer_Length * AY_STEP);
		  }

		  // for the noise channel we must not touch OutputN - it's also not necessary 
		  // since we use AY_OutNoise. 
		  if ((AY8912_Regs[AY_ENABLE] & 0x38) == 0x38) { // all off 
			  if (AY8912_CountN <= (Buffer_Length * AY_STEP)) 
				AY8912_CountN = AY8912_CountN + (Buffer_Length * AY_STEP);
		  }

		AY_OutNoise = (AY8912_OutputN | AY8912_Regs[AY_ENABLE]);
	}

	function RenderSample() {
		
		var VolA,VolB,VolC,AY_Left,lOut1,lOut2,lOut3,AY_NextEvent;

		VolA = 0; VolB = 0; VolC = 0;

		//vola, volb and volc keep track of how long each square wave stays
		//in the 1 position during the sample period.

		AY_Left = AY_STEP;

		do {
			AY_NextEvent = 0;

			if (AY8912_CountN < AY_Left) 
				AY_NextEvent = AY8912_CountN
			else
				AY_NextEvent = AY_Left;

			if ((AY_OutNoise & 0x8) == 0x8) {
				if (AY8912_OutputA == 1)  VolA = VolA + AY8912_CountA;

				AY8912_CountA = AY8912_CountA - AY_NextEvent;

				//PeriodA is the half period of the square wave. Here, in each
				// loop I add PeriodA twice, so that at the end of the loop the
				// square wave is in the same status (0 or 1) it was at the start.
				// vola is also incremented by PeriodA, since the wave has been 1
				// exactly half of the time, regardless of the initial position.
				// If we exit the loop in the middle, OutputA has to be inverted
				// and vola incremented only if the exit status of the square
				// wave is 1.

				 while (AY8912_CountA <= 0) {
					AY8912_CountA = AY8912_CountA + AY8912_PeriodA;
					if (AY8912_CountA > 0) {
						if ((AY8912_Regs[AY_ENABLE] & 1) == 0)  AY8912_OutputA = AY8912_OutputA ^ 1;
						if (AY8912_OutputA!=0)  VolA = VolA + AY8912_PeriodA;
						break;
					}

					AY8912_CountA = AY8912_CountA + AY8912_PeriodA;
					VolA = VolA + AY8912_PeriodA;
				}
				if (AY8912_OutputA == 1)  VolA = VolA - AY8912_CountA;
			}
			else {
				AY8912_CountA = AY8912_CountA - AY_NextEvent;

				while (AY8912_CountA <= 0) {
					AY8912_CountA = AY8912_CountA + AY8912_PeriodA;
					if (AY8912_CountA > 0) {
						AY8912_OutputA = AY8912_OutputA ^ 1;
						break;
					}
					AY8912_CountA = AY8912_CountA + AY8912_PeriodA;
				}
			}

			if ((AY_OutNoise & 0x10) == 0x10) { 
				if (AY8912_OutputB == 1)  VolB = VolB + AY8912_CountB;
				AY8912_CountB = AY8912_CountB - AY_NextEvent;

				while (AY8912_CountB <= 0) {
					AY8912_CountB = AY8912_CountB + AY8912_PeriodB;
					if (AY8912_CountB > 0) {
						if ((AY8912_Regs[AY_ENABLE] & 2) == 0)  AY8912_OutputB = AY8912_OutputB ^ 1;
						if (AY8912_OutputB!=0)  VolB = VolB + AY8912_PeriodB;
						break;
					}
					AY8912_CountB = AY8912_CountB + AY8912_PeriodB;
					VolB = VolB + AY8912_PeriodB;
				}
				if (AY8912_OutputB == 1)  VolB = VolB - AY8912_CountB;
			}
			else {
				AY8912_CountB = AY8912_CountB - AY_NextEvent;

				while (AY8912_CountB <= 0) {
					AY8912_CountB = AY8912_CountB + AY8912_PeriodB;
					if (AY8912_CountB > 0)  {
						AY8912_OutputB = AY8912_OutputB ^ 1;
						break;
					}
					AY8912_CountB = AY8912_CountB + AY8912_PeriodB;
				}
			}

			if ((AY_OutNoise & 0x20) == 0x20)  {
				if (AY8912_OutputC == 1)  VolC = VolC + AY8912_CountC;
				AY8912_CountC = AY8912_CountC - AY_NextEvent;
				while (AY8912_CountC <= 0) {
					AY8912_CountC = AY8912_CountC + AY8912_PeriodC;
					if (AY8912_CountC > 0) {
						if ((AY8912_Regs[AY_ENABLE] & 4) == 0)  AY8912_OutputC = AY8912_OutputC ^ 1;
						if (AY8912_OutputC!=0)  VolC = VolC + AY8912_PeriodC;
						break;
					}

					AY8912_CountC = AY8912_CountC + AY8912_PeriodC;
					VolC = VolC + AY8912_PeriodC;
				}
				if (AY8912_OutputC == 1)  VolC = VolC - AY8912_CountC;
			}
			else {

				AY8912_CountC = AY8912_CountC - AY_NextEvent;
				while (AY8912_CountC <= 0) {
					AY8912_CountC = AY8912_CountC + AY8912_PeriodC;
					if (AY8912_CountC > 0) {
						AY8912_OutputC = AY8912_OutputC ^ 1;
						break;
					}
					AY8912_CountC = AY8912_CountC + AY8912_PeriodC;
				}
			}

			AY8912_CountN = AY8912_CountN - AY_NextEvent;
			if (AY8912_CountN <= 0) {
				//Is noise output going to change?
				AY8912_OutputN = Math.round(Math.random()*510);
				AY_OutNoise = (AY8912_OutputN | AY8912_Regs[AY_ENABLE]);
				AY8912_CountN = AY8912_CountN + AY8912_PeriodN;
			}

			AY_Left = AY_Left - AY_NextEvent;
		} while (AY_Left > 0);


		if (AY8912_Holding == 0) {
			AY8912_CountE = AY8912_CountE - AY_STEP;
			if (AY8912_CountE <= 0) {
				do {
					AY8912_CountEnv = AY8912_CountEnv - 1;
					AY8912_CountE = AY8912_CountE + AY8912_PeriodE;
				}
				while (AY8912_CountE <= 0);

				//check envelope current position
				if (AY8912_CountEnv < 0) {
					if (AY8912_Hold!=0) {
						if (AY8912_Alternate!=0) {
							AY8912_Attack = AY8912_Attack ^ MAXVOL; //0x1f
						}
						AY8912_Holding = 1;
						AY8912_CountEnv = 0;
					}
					else {
						//if CountEnv has looped an odd number of times (usually 1),
						//invert the output.
						if ((AY8912_Alternate!=0) & ((AY8912_CountEnv & 0x20) == 0x20)) {
							AY8912_Attack = AY8912_Attack ^ MAXVOL; //0x1f
						}

						AY8912_CountEnv = AY8912_CountEnv & MAXVOL;  //0x1f
					}
					
				}

				AY8912_VolE = AY8912_VolTable2[AY8912_CountEnv ^ AY8912_Attack];

				//reload volume
				if (AY8912_EnvelopeA != 0)  AY8912_VolA = AY8912_VolE;
				if (AY8912_EnvelopeB != 0)  AY8912_VolB = AY8912_VolE;
				if (AY8912_EnvelopeC != 0)  AY8912_VolC = AY8912_VolE;
			}
		}
		

		lOut1 = (VolA * AY8912_VolA) / 65535;
		lOut2 = (VolB * AY8912_VolB) / 65535;
		lOut3 = (VolC * AY8912_VolC) / 65535;

		return  (lOut1 + lOut2 + lOut3) / 63;
	}

	
	
	function fillBuffer(buffer) {
		var n = 0;
		
		for (var i=0; i<buffer.length; i++) {
			var avg = 0;
			for (var j=0; j<oversampleRate; j++) {
				avg = avg + soundData[n++];
			}
			avg = avg / oversampleRate;
			avg = avg * 0.7;
			avg = avg + aySoundData[i] / 2;
			
			buffer[i] = avg;
		}
		
		if (n>=soundData.Length) {
			soundData = new Array();
		}
		else {
			soundData.splice(0,n);
		}

		if (buffer.length>=aySoundData.Length) {
			aySoundData = new Array();
		}
		else {
			aySoundData.splice(0,buffer.length);
		}
		
	}
	backend.setSource(fillBuffer);

	function handleAySound(size) {
		if (!backend.isEnabled) return;
		size = Math.floor(size);
		while (size--) {
			WCount++;
			if (WCount==25) {
				AY8912Update_8();
				WCount = 0;
			}
			aySoundData.push(RenderSample());
			soundDataAyFrameBytes++;
		}	
	}
	
	self.updateBuzzer = function(val, currentTstates) {
		if (val==0) val = -1;

		if (buzzer_val!=val) {	
			var sound_size = (currentTstates - lastaudio) * sampleRate * oversampleRate / clockSpeed;
			self.createSoundData(sound_size, buzzer_val);			
			
			buzzer_val = val;			
			lastaudio = currentTstates;
		}
	}
	
	self.createSoundData = function (size, val) {
		if (!backend.isEnabled) return;
		size = Math.floor(size);
		if (size>=1) {
			for (var i=0; i<size; i++) {
				soundData.push(val);
			}
			soundDataFrameBytes+=size;
		}
	}

	self.endFrame = function() {

		var pad_val = 0;
		if (lastaudio) pad_val = buzzer_val;

		self.createSoundData(samplesPerFrame * oversampleRate - soundDataFrameBytes,pad_val);
		handleAySound(samplesPerFrame - soundDataAyFrameBytes);
		lastaudio = 0;
		lastAyAudio = 0;
		soundDataFrameBytes = 0;
		soundDataAyFrameBytes = 0;
		if (frameCount++<2) return;
		if (backend.isEnabled) {
			backend.notifyReady(soundData.length / oversampleRate);
		}

	}
	
	self.selectSoundRegister = function(reg) {
		ayRegSelected = reg;
	}

	self.writeSoundRegister = function(val, currentTstates) {

		var sound_size = (currentTstates - lastAyAudio) * sampleRate / clockSpeed;
		handleAySound(sound_size);
			
		lastAyAudio = currentTstates;

		AYWriteReg(ayRegSelected,val);
	}
	
	self.readSoundRegister = function() {
		return AYReadReg(ayRegSelected);
	}
	
	self.reset = function() {
		AY_OutNoise = 0;
		AY8912_init(clockSpeed / 2, sampleRate, 8);
	}

	return self;
};

JSSpeccy.SoundBackend = function() {
	var self = {};

	/* Regardless of the underlying implementation, an instance of SoundBackend exposes the API:
		sampleRate: sample rate required by this backend
		isEnabled: whether audio is currently enabled
		setSource(fn): specify a function fn to be called whenever we want to receive audio data.
			fn is passed a buffer object to be filled
		setAudioState(state): if state == true, enable audio; if state == false, disable.
			Return new state (may not match the passed in state - e.g. if sound is unavailable,
			will always return false)
		notifyReady(dataLength): tell the backend that there is dataLength samples of audio data
			ready to be received via the callback we set with setSource. Ignored for event-based
			backends (= Web Audio) that trigger the callback whenever they feel like it...
	*/

	var AudioContext = window.AudioContext || window.webkitAudioContext;
	var fillBuffer = null;

	if (AudioContext) {
		/* Use Web Audio API as backend */
		var audioContext = new AudioContext();
		var audioNode = null;
		
		//Web audio Api changed createJavaScriptNode to CreateScriptProcessor - we support both
		if (audioContext.createJavaScriptNode!=null) {
			audioNode = audioContext.createJavaScriptNode(8192, 1, 1);
		} else if (audioContext.createScriptProcessor!=null) {
			audioNode = audioContext.createScriptProcessor(8192, 1, 1);
		}

                if (audioNode!=null) {

			onAudioProcess = function(e) {
				var buffer = e.outputBuffer.getChannelData(0);
				fillBuffer(buffer);
			};

			self.sampleRate = 44100;
			self.isEnabled = false;
			self.setSource = function(fillBufferCallback) {
				fillBuffer = fillBufferCallback;
				if (self.isEnabled) {
					audioNode.onaudioprocess = onAudioProcess;
					audioNode.connect(audioContext.destination);
				};
			}
			self.setAudioState = function(state) {
				if (state) {
					/* enable */
					self.isEnabled = true;
					if (fillBuffer) {
						audioNode.onaudioprocess = onAudioProcess;
						audioNode.connect(audioContext.destination);
					}
					return true;
				} else {
					/* disable */
					self.isEnabled = false;
					audioNode.onaudioprocess = null;
					audioNode.disconnect(0);
					return false;
				}
			}
			self.notifyReady = function(dataLength) {
				/* do nothing */
			}

			return self;
                }
	}

	if (typeof(Audio) != 'undefined') {
		var audio = new Audio();
		if (audio.mozSetup) {
			/* Use Audio Data API as backend */
			self.sampleRate = 44100;
			audio.mozSetup(1, self.sampleRate);

			self.isEnabled = false;
			self.setAudioState = function(state) {
				self.isEnabled = state;
				return state;
			}

			self.setSource = function(fn) {
				fillBuffer = fn;
			}
			self.notifyReady = function(dataLength) {
				var buffer = new Float32Array(dataLength);
				fillBuffer(buffer);
				if (self.isEnabled) {
					var written = audio.mozWriteAudio(buffer);
				}
			}

			return self;
		}
	}

	/* use dummy no-sound backend. We still keep a handle to the callback function and
	call it on demand, so that it's not filling up a buffer indefinitely */
	self.sampleRate = 5500; /* something suitably low */
	self.isEnabled = false;
	self.setAudioState = function(state) {
		return false;
	}
	self.setSource = function(fn) {
		fillBuffer = fn;
	};
	self.notifyReady = function(dataLength) {
		var buffer = new Float32Array(dataLength);
		fillBuffer(buffer);
	}
	return self;

}

