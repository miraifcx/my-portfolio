import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const profile = JSON.parse(read('content/profile.json'));
const projects = JSON.parse(read('content/projects.json'));
if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
  throw new Error('profile.json must contain an object');
}
// Check the real file before adopting this shape check.
// It permits either an array or the common {projects: [...]} wrapper.
const entries = Array.isArray(projects) ? projects : projects?.projects;
if (!Array.isArray(entries)) throw new Error('Expected a projects array');
for (const item of entries) {
  if (!item || typeof item.title !== 'string' || !item.title.trim()) {
    throw new Error('Each project needs a non-empty title');
  }
}
const config = YAML.parse(read('admin/config.yml'));
if (config?.backend?.repo !== 'miraifcx/my-portfolio') {
  throw new Error('Unexpected CMS repository');
}
if (config?.backend?.branch !== 'main') throw new Error('Expected main branch');
if (config?.backend?.name !== 'github') throw new Error('Expected GitHub backend');
if (!Array.isArray(config.collections)) throw new Error('Missing CMS collections');

// Only this script-owned output directory is cleared; source is never deleted.
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'portfolio/content'), { recursive: true });
fs.mkdirSync(path.join(out, 'toolbox'), { recursive: true });
const copy = (source, destination) => fs.copyFileSync(
  path.join(root, source), path.join(out, destination)
);
for (const name of ['index.html', 'styles.css', 'app.js']) {
  copy(name, `portfolio/${name}`);
}
for (const name of ['profile.json', 'projects.json']) {
  copy(`content/${name}`, `portfolio/content/${name}`);
}
copy('admin/index.html', 'toolbox/index.html');
const productionConfig = structuredClone(config);
delete productionConfig.local_backend;
fs.writeFileSync(path.join(out, 'toolbox/config.yml'), YAML.stringify(productionConfig));
const sha = process.env.GITHUB_SHA || execFileSync(
  'git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }
).trim();
for (const site of ['portfolio', 'toolbox']) {
  fs.writeFileSync(path.join(out, site, 'version.json'), JSON.stringify({ commit: sha }));
}
console.log(`Packaged commit ${sha}`);