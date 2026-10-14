// Bundles src/head.html + src/*.js into one artifact page, and a standalone index.html.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'src');
const head = fs.readFileSync(path.join(dir, 'head.html'), 'utf8');
const js = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => `// ==== ${f} ====\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'bundle.js'), js);
const page = `${head}\n<script>\n${js}\n</script>\n`;
fs.writeFileSync(path.join(__dirname, 'dist', 'mukseon.html'), page);
// standalone version (own doctype/head) for hosting anywhere, e.g. GitHub Pages
const standalone = `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n<meta name="theme-color" content="#1b1a17">\n<meta name="apple-mobile-web-app-capable" content="yes">\n</head>\n<body style="margin:0">\n${page}</body>\n</html>\n`;
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), standalone);
fs.writeFileSync(path.join(__dirname, 'index.html'), standalone);
console.log('built', (page.length / 1024).toFixed(1) + ' KB');
