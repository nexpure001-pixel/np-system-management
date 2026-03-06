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
            const parentDir = path.dirname(filePath);

            // Ensure parent directory exists
            if (!fs.existsSync(parentDir)) {
              fs.mkdirSync(parentDir, { recursive: true });
            }

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

          const getFiles = (dirPath, prefix = '') => {
            let results = [];
            const list = fs.readdirSync(dirPath);
            list.forEach(file => {
              const filePath = path.join(dirPath, file);
              const stats = fs.statSync(filePath);
              const relativePath = prefix ? path.join(prefix, file) : file;

              if (stats.isDirectory()) {
                results = results.concat(getFiles(filePath, relativePath));
              } else if (file.endsWith('.html')) {
                results.push({
                  id: relativePath,
                  title: file.replace('.html', ''),
                  file: relativePath,
                  category: prefix || '未分類',
                  date: stats.mtime.toISOString().split('T')[0]
                });
              }
            });
            return results;
          };

          const files = getFiles(dir);

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
