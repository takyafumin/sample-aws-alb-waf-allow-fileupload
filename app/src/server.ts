import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';

// Environment
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const APP_MAX_FILE_SIZE_MB = Number(process.env.APP_MAX_FILE_SIZE_MB ?? 50);
const MAX_BYTES = APP_MAX_FILE_SIZE_MB * 1024 * 1024;

// Multer: memory storage is sufficient for demo purposes.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

const app = express();

// Basic middleware
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static assets (Task B)
app.use(express.static('public'));

// Healthcheck
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Root route: static middleware will serve public/index.html if present.
// Keeping a JSON fallback only when index.html is missing.
app.get('/', (_req: Request, res: Response) => {
  // If static file exists, let express.static handle it (no-op here).
  // This handler serves as a fallback for environments without public/.
  res.status(200).json({
    message: 'ALB+WAF file upload demo app',
    hints: 'Place public/index.html to enable the HTML form.',
    routes: {
      upload: { method: 'POST', path: '/upload', field: 'file' },
      profile: { method: 'POST', path: '/profile', field: 'file' },
      health: { method: 'GET', path: '/health' },
    },
  });
});

// POST /upload — allowed path
app.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file field is required' });
  }
  const { originalname, mimetype, size } = req.file;
  res.status(200).json({
    path: '/upload',
    message: 'received',
    file: { originalname, mimetype, size },
  });
});

// POST /profile — will be blocked by WAF later, but app responds 200 locally
app.post('/profile', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file field is required' });
  }
  const { originalname, mimetype, size } = req.file;
  res.status(200).json({
    path: '/profile',
    message: 'received',
    note: 'In production behind WAF, this path is expected to be blocked.',
    file: { originalname, mimetype, size },
  });
});

// Multer error handler (e.g., file too large)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'file too large',
      limitMb: APP_MAX_FILE_SIZE_MB,
    });
  }
  if (err) {
    return res.status(500).json({ error: 'internal error', detail: String(err?.message ?? err) });
  }
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://${HOST}:${PORT} (limit=${APP_MAX_FILE_SIZE_MB}MB)`);
});
