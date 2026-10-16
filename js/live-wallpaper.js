(function() {
    function initLiveWallpaper() {
        if (document.getElementById("live-wallpaper-canvas")) return;

        const canvas = document.createElement("canvas");
        canvas.id = "live-wallpaper-canvas";
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.position = "fixed";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.zIndex = "-1";
        canvas.style.pointerEvents = "none";
        document.body.prepend(canvas);

        const ctx = canvas.getContext("2d");
        let width = 0;
        let height = 0;
        let particles = [];
        let mouse = { x: -1000, y: -1000, radius: 140 };

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
            createParticles();
        }

        const symbols = ["✦", "◆", "▲", "•", "★", "∑", "π", "∞"];

        function createParticles() {
            particles = [];
            const count = Math.min(Math.floor((width * height) / 16000), 75);
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.45,
                    vy: (Math.random() - 0.5) * 0.45,
                    radius: Math.random() * 2.2 + 1.2,
                    alpha: Math.random() * 0.6 + 0.25,
                    symbol: Math.random() > 0.65 ? symbols[Math.floor(Math.random() * symbols.length)] : null,
                    symbolSize: Math.floor(Math.random() * 6 + 10),
                    color: Math.random() > 0.4 ? "56, 189, 248" : (Math.random() > 0.5 ? "168, 85, 247" : "251, 146, 60"),
                    phase: Math.random() * Math.PI * 2
                });
            }
        }

        window.addEventListener("resize", resize, { passive: true });
        window.addEventListener("mousemove", (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        }, { passive: true });
        window.addEventListener("touchmove", (e) => {
            if (e.touches && e.touches.length) {
                mouse.x = e.touches[0].clientX;
                mouse.y = e.touches[0].clientY;
            }
        }, { passive: true });
        window.addEventListener("touchend", () => {
            mouse.x = -1000;
            mouse.y = -1000;
        }, { passive: true });

        resize();

        let lastTime = performance.now();
        function animate(now) {
            const dt = Math.min((now - lastTime) / 1000, 0.1);
            lastTime = now;

            // Deep cosmic academic gradient background
            const bgGrad = ctx.createLinearGradient(0, 0, width, height);
            bgGrad.addColorStop(0, "#090d16");
            bgGrad.addColorStop(0.4, "#0f172a");
            bgGrad.addColorStop(0.75, "#172554");
            bgGrad.addColorStop(1, "#1e1b4b");
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);

            // Subtle glowing ambient nebula circles
            const orb1 = ctx.createRadialGradient(width * 0.25, height * 0.3, 10, width * 0.25, height * 0.3, width * 0.4);
            orb1.addColorStop(0, "rgba(56, 189, 248, 0.09)");
            orb1.addColorStop(1, "rgba(56, 189, 248, 0)");
            ctx.fillStyle = orb1;
            ctx.fillRect(0, 0, width, height);

            const orb2 = ctx.createRadialGradient(width * 0.8, height * 0.7, 10, width * 0.8, height * 0.7, width * 0.45);
            orb2.addColorStop(0, "rgba(168, 85, 247, 0.08)");
            orb2.addColorStop(1, "rgba(168, 85, 247, 0)");
            ctx.fillStyle = orb2;
            ctx.fillRect(0, 0, width, height);

            // Update & draw particles
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx * (dt * 60);
                p.y += p.vy * (dt * 60);
                p.phase += dt * 1.5;

                // Screen bounce/wrap
                if (p.x < -20) p.x = width + 20;
                else if (p.x > width + 20) p.x = -20;
                if (p.y < -20) p.y = height + 20;
                else if (p.y > height + 20) p.y = -20;

                // Mouse interaction
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.hypot(dx, dy);
                if (dist < mouse.radius && dist > 0) {
                    const force = (1 - dist / mouse.radius) * 1.8;
                    p.x += (dx / dist) * force;
                    p.y += (dy / dist) * force;
                }

                // Render particle node
                const currentAlpha = p.alpha * (0.8 + 0.2 * Math.sin(p.phase));
                if (p.symbol) {
                    ctx.font = `${p.symbolSize}px "Vazirmatn", sans-serif`;
                    ctx.fillStyle = `rgba(${p.color}, ${currentAlpha * 0.9})`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(p.symbol, p.x, p.y);
                } else {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${p.color}, ${currentAlpha})`;
                    ctx.fill();
                }

                // Connect nearby nodes with constellation lines
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dist2 = Math.hypot(p.x - p2.x, p.y - p2.y);
                    if (dist2 < 115) {
                        const lineAlpha = (1 - dist2 / 115) * 0.22;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(148, 163, 184, ${lineAlpha})`;
                        ctx.lineWidth = 0.85;
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initLiveWallpaper);
    } else {
        initLiveWallpaper();
    }
})();