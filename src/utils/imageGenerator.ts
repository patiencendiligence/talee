export function generatePlaceholderImage(text: string, status: string = "반짝이는 상상 중..."): string {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, '#EDE9FE'); // Violet 100
  gradient.addColorStop(1, '#DBEAFE'); // Blue 100
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // Decorative patterns
  ctx.strokeStyle = 'rgba(109, 40, 217, 0.05)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 512; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Text overlay
  ctx.fillStyle = '#6D28D9'; // Violet 700
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const displayContext = text.length > 20 ? text.substring(0, 17) + "..." : text;
  ctx.fillText(displayContext, 256, 220);

  // Status indicator area
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.roundRect?.(100, 280, 312, 80, 20); // Modern browsers
  if (!ctx.roundRect) ctx.rect(100, 280, 312, 80);
  ctx.fill();

  ctx.font = '700 24px sans-serif';
  ctx.fillStyle = '#7C3AED'; // Violet 600
  ctx.fillText(status, 256, 320);

  return canvas.toDataURL('image/jpeg', 0.6);
}
