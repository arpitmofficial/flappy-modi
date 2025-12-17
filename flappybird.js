(() => {
	const canvas = document.getElementById('gameCanvas');
	const ctx = canvas.getContext('2d');

	const startBtn = document.getElementById('startBtn');
	const restartBtn = document.getElementById('restartBtn');
	const overlay = document.getElementById('overlay');
	const overlayHint = document.getElementById('overlayHint');
	const scoreEl = document.getElementById('score');
	const bestEl = document.getElementById('best');
	let overlayTimer;

	// Assets
	const bgImg = new Image();
	bgImg.src = 'img/background.png';

	const modiImg = new Image();
	modiImg.src = 'img/modi.png';

	const pipeTopImg = new Image();
	pipeTopImg.src = 'img/rahul_top.png';

	const pipeBottomImg = new Image();
	pipeBottomImg.src = 'img/rahul_bottom.png';

	const flapSound = new Audio("sounds/modi's_song.mp3");
	const crashSound = new Audio('sounds/crash.mp3');
	const bgMusic = new Audio("sounds/modi's_song.mp3");
	bgMusic.loop = true;
	bgMusic.volume = 0.5;
	flapSound.volume = 0.8;
	crashSound.volume = 0.9;
	flapSound.preload = 'auto';
	crashSound.preload = 'auto';
	bgMusic.preload = 'auto';

	let audioPrimed = false;

	// Game state
	const G = { gravity: 0.315, flap: -7.2, pipeGap: 150, pipeFreq: 1300, pipeSpeed: 2.38 };
	const PIPE_FACE_MIN = 140; // ensure faces stay visible for both top and bottom
	const bird = { x: 80, y: canvas.height / 2, r: 22, vel: 0, width: 46, height: 32, hitboxPadding: 6 };
	let pipes = [];
	let score = 0;
	let best = Number(localStorage.getItem('flappy-modi-best') || 0);
	let running = false;
	let gameOver = false;
	let loopId;

	bestEl.textContent = best;

	function reset() {
		pipes = [];
		bird.y = canvas.height / 2;
		bird.vel = 0;
		score = 0;
		gameOver = false;
		scoreEl.textContent = score;
		overlayHint.textContent = 'Tap, click, or press space to flap.';
		restartBtn.classList.add('hidden');
	}

	function flap() {
		if (gameOver) return;
		bird.vel = G.flap;
		try { flapSound.currentTime = 0; flapSound.play(); } catch (e) { /* ignore */ }
	}

	function spawnPipe() {
		const minTop = PIPE_FACE_MIN;
		const maxTop = canvas.height - G.pipeGap - PIPE_FACE_MIN;
		const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
		pipes.push({ x: canvas.width + 20, top: topHeight, passed: false });
	}

	function update(delta) {
		// Bird physics
		bird.vel += G.gravity;
		bird.y += bird.vel;

		// Ground / ceiling collision with hitbox padding
		const birdHitboxTop = bird.y - bird.height / 2 + bird.hitboxPadding;
		const birdHitboxBottom = bird.y + bird.height / 2 - bird.hitboxPadding;

		if (birdHitboxBottom >= canvas.height || birdHitboxTop <= 0) {
			return triggerGameOver();
		}

		// Pipes movement
		pipes.forEach(p => p.x -= G.pipeSpeed);
		pipes = pipes.filter(p => p.x > -80);

		// Scoring and collision with hitbox padding
		for (const p of pipes) {
			const pipeWidth = 70;
			const bottomY = p.top + G.pipeGap;
			
			// Bird hitbox dimensions
			const birdLeft = bird.x - bird.width / 2 + bird.hitboxPadding;
			const birdRight = bird.x + bird.width / 2 - bird.hitboxPadding;
			
			// Pipe collision zones
			const inX = birdRight > p.x && birdLeft < p.x + pipeWidth;
			const hitTop = birdHitboxTop < p.top;
			const hitBottom = birdHitboxBottom > bottomY;
			
			if (inX && (hitTop || hitBottom)) {
				return triggerGameOver();
			}
			if (!p.passed && p.x + pipeWidth < bird.x) {
				p.passed = true;
				score += 1;
				scoreEl.textContent = score;
			}
		}
	}

	function draw() {
		// Background - fill canvas with image scaled to fit
		if (bgImg.complete && bgImg.width > 0) {
			ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
		} else {
			// Fallback: clear canvas (transparent)
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}

		// Pipes
		pipes.forEach(p => {
			const pipeWidth = 70;
			if (pipeTopImg.complete) {
				ctx.drawImage(pipeTopImg, p.x, p.top - pipeTopImg.height, pipeWidth, pipeTopImg.height);
			} else {
				ctx.fillStyle = '#274064';
				ctx.fillRect(p.x, 0, pipeWidth, p.top);
			}

			const bottomY = p.top + G.pipeGap;
			const bottomHeight = canvas.height - bottomY;
			if (pipeBottomImg.complete) {
				ctx.drawImage(pipeBottomImg, p.x, bottomY, pipeWidth, pipeBottomImg.height);
			} else {
				ctx.fillStyle = '#274064';
				ctx.fillRect(p.x, bottomY, pipeWidth, bottomHeight);
			}
		});

		// Bird (Modi)
		const drawX = bird.x - bird.width / 2;
		const drawY = bird.y - bird.height / 2;
		if (modiImg.complete) {
			ctx.save();
			ctx.translate(drawX + bird.width / 2, drawY + bird.height / 2);
			ctx.rotate(Math.min(Math.max(bird.vel / 10, -0.35), 0.5));
			ctx.drawImage(modiImg, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
			ctx.restore();
		} else {
			ctx.fillStyle = '#ffb703';
			ctx.beginPath();
			ctx.arc(drawX + bird.width / 2, drawY + bird.height / 2, bird.r, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	let lastSpawn = 0;
	let lastTime = 0;
	function loop(timestamp) {
		if (!running) return;
		const delta = timestamp - lastTime;
		lastTime = timestamp;

		if (timestamp - lastSpawn > G.pipeFreq) {
			spawnPipe();
			lastSpawn = timestamp;
		}

		update(delta);
		draw();

		loopId = requestAnimationFrame(loop);
	}

	function startGame() {
		clearTimeout(overlayTimer);
		reset();
		running = true;
		overlay.classList.remove('visible');
		lastTime = performance.now();
		lastSpawn = lastTime;
		try { bgMusic.currentTime = 0; bgMusic.play(); } catch (e) { /* ignore */ }
		loopId = requestAnimationFrame(loop);
	}

	function triggerGameOver() {
		running = false;
		gameOver = true;
		cancelAnimationFrame(loopId);
		try { bgMusic.pause(); } catch (e) { /* ignore */ }
		try { crashSound.currentTime = 0; crashSound.play(); } catch (e) { /* ignore */ }
		if (score > best) {
			best = score;
			localStorage.setItem('flappy-modi-best', best);
			bestEl.textContent = best;
		}
		overlayHint.textContent = `Game over! Score: ${score}`;
		startBtn.classList.add('hidden');
		restartBtn.classList.remove('hidden');
		clearTimeout(overlayTimer);
		overlayTimer = setTimeout(() => overlay.classList.add('visible'), 400);
	}

	function onUserFlap() {
		if (!running) {
			startGame();
		} else {
			flap();
		}
	}

	function primeAudio() {
		if (audioPrimed) return;
		audioPrimed = true;
		const sounds = [bgMusic, flapSound, crashSound];
		sounds.forEach(snd => {
			snd.volume = snd.volume; // no-op touch to ensure property applied
			try {
				snd.play().then(() => snd.pause()).catch(() => {});
			} catch (e) {
				/* ignore */
			}
		});
		document.removeEventListener('pointerdown', primeAudio);
		document.removeEventListener('keydown', primeAudio);
	}

	// Input bindings
	window.addEventListener('keydown', e => {
		if (e.code === 'Space' || e.code === 'ArrowUp') {
			e.preventDefault();
			onUserFlap();
		}
		if (gameOver && e.code === 'Enter') {
			startGame();
		}
	});

	canvas.addEventListener('pointerdown', onUserFlap);
	startBtn.addEventListener('click', startGame);
	restartBtn.addEventListener('click', startGame);
	document.addEventListener('pointerdown', primeAudio);
	document.addEventListener('keydown', primeAudio);

	// Initial draw
	draw();
	overlayTimer = setTimeout(() => overlay.classList.add('visible'), 1000);
})();
