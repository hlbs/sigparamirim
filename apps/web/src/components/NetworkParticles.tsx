import { useEffect, useRef } from 'react';

type NetworkParticlesProps = {
  className?: string;
  density?: number;
  speed?: number;
};

/** Rede de pontos e conexões sem interação com o ponteiro, usada em superfícies de destaque. */
export function NetworkParticles({ className = '', density = 62, speed = .28 }: NetworkParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const canvas = document.createElement('canvas');
    canvas.className = 'network-particles-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);
    const context = canvas.getContext('2d');
    if (!context) return () => canvas.remove();

    type Node = { x: number; y: number; vx: number; vy: number; radius: number };
    const nodes: Node[] = [];
    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let seed = 9127;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(container.clientWidth, 1);
      height = Math.max(container.clientHeight, 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (nodes.length > 0) return;
      for (let index = 0; index < density; index += 1) {
        nodes.push({ x: random() * width, y: random() * height, vx: (random() - .5) * speed, vy: (random() - .5) * speed, radius: 1.1 + random() * 1.8 });
      }
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      const maxDistance = Math.min(190, Math.max(120, width * .24));
      const maxDistanceSquared = maxDistance * maxDistance;
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < -10 || node.x > width + 10) node.vx *= -1;
        if (node.y < -10 || node.y > height + 10) node.vy *= -1;
      }
      const darkTheme = document.documentElement.dataset.theme === 'dark';
      const lineColor = darkTheme ? '215,231,122' : '90,94,11';
      for (let first = 0; first < nodes.length; first += 1) {
        const node = nodes[first];
        if (!node) continue;
        for (let second = first + 1; second < nodes.length; second += 1) {
          const other = nodes[second];
          if (!other) continue;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > maxDistanceSquared) continue;
          const alpha = (1 - Math.sqrt(distanceSquared) / maxDistance) * .24;
          context.strokeStyle = `rgba(${lineColor},${alpha.toFixed(3)})`;
          context.lineWidth = .7;
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }
      }
      for (const node of nodes) {
        context.fillStyle = darkTheme ? 'rgba(224,239,154,.78)' : 'rgba(90,94,11,.62)';
        context.shadowColor = darkTheme ? 'rgba(215,231,122,.52)' : 'rgba(90,94,11,.28)';
        context.shadowBlur = 9;
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.shadowBlur = 0;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) animationFrame = window.requestAnimationFrame(draw);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    draw();
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      canvas.remove();
    };
  }, [density, speed]);

  return <div ref={containerRef} className={`network-particles ${className}`} aria-hidden="true" />;
}
