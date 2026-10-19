import app from './index.js';
import { initializeDatabase } from './db.js';

const PORT = process.env.PORT || 8080;

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🏥 MedCore HMS API Server listening on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  app.listen(PORT, () => {
    console.log(`🏥 MedCore HMS API Server listening with fallback on http://localhost:${PORT}`);
  });
});
