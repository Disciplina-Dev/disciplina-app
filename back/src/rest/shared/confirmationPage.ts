export function confirmationPage(message: string, success: boolean): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DISCIPLINA</title>
<style>
  body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
  .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .logo { color: #60207E; font-weight: 800; font-size: 22px; margin-bottom: 24px; }
  .icon { font-size: 48px; margin-bottom: 20px; }
  p { color: #374151; line-height: 1.6; font-size: 16px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">DISCIPLINA</div>
    <div class="icon">${success ? '✅' : '❌'}</div>
    <p>${message}</p>
    <p style="color:#9ca3af;font-size:13px;margin-top:24px">Vous pouvez fermer cette page.</p>
  </div>
</body>
</html>`;
}
