import app from './app.js';

const PORT = process.env.PORT || 3001;

// Only start a local server when not running on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
