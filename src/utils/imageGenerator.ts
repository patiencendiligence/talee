export function generatePlaceholderImage(text: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
  gradient.addColorStop(0, '#DDD6FE'); // Violet 200
  gradient.addColorStop(0.5, '#F5D0FE'); // Fuchsia 200
  gradient.addColorStop(1, '#DBEAFE'); // Blue 100
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1024);

  // Decorative blobs
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(200, 200, 300, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = 'rgba(192, 132, 252, 0.1)';
  ctx.beginPath();
  ctx.arc(800, 800, 400, 0, Math.PI * 2);
  ctx.fill();

  // Text overlay
  ctx.fillStyle = '#6D28D9'; // Violet 700
  ctx.font = 'bold 50px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const displayContext = text.length > 25 ? text.substring(0, 22) + "..." : text;
  ctx.fillText(displayContext, 512, 512);

  // Fallback indicator
  ctx.font = '30px sans-serif';
  ctx.fillStyle = 'rgba(109, 40, 217, 0.4)';
  ctx.fillText("반짝이는 상상 중...", 512, 600);

  return canvas.toDataURL('image/jpeg', 0.8);
}
