import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Custom plugin to handle local file saving for the manual tool
const localManualSaver = () => ({
  name: 'local-manual-saver',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/api/save-manual' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const { filename, content } = JSON.parse(body);
            const dir = path.resolve(process.cwd(), 'public/manual');

            // Ensure directory exists
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            const filePath = path.join(dir, filename);
            fs.writeFileSync(filePath, content);

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, path: filePath }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      } else if (req.url === '/api/list-manuals' && req.method === 'GET') {
        try {
          const dir = path.resolve(process.cwd(), 'public/manual');
          if (!fs.existsSync(dir)) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, files: [] }));
            return;
          }

          const files = fs.readdirSync(dir)
            .filter(f => f.endsWith('.html'))
            .map(f => {
              const stats = fs.statSync(path.join(dir, f));
              return {
                id: f,
                title: f.replace('.html', ''),
                file: f,
                date: stats.mtime.toISOString().split('T')[0]
              };
            });

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, files }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localManualSaver(),
  ],
})
