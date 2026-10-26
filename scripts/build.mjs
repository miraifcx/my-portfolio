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

function resolveResumeAsset(rawResume) {
  if (rawResume === undefined || rawResume === null) {
    return null;
  }
  if (typeof rawResume !== 'string') {
    throw new Error('contact.resume must be a string when provided');
  }
  const trimmed = rawResume.trim();
  if (!trimmed) {
    return null;
  }
  if (
    trimmed.includes('\\') ||
    /[?#\0]/.test(trimmed) ||
    /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
  ) {
    throw new Error(`Invalid resume path "${rawResume}": must be a clean path under /assets/`);
  }

  const normalized = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const segments = normalized.split('/');
  if (segments[0] !== 'assets' || segments.length < 2) {
    throw new Error(`Invalid resume path "${rawResume}": path must stay inside the assets directory`);
  }
  if (segments.some(seg => !seg || seg === '.' || seg === '..')) {
    throw new Error(`Invalid resume path "${rawResume}": path traversal is not allowed`);
  }

  const assetsRoot = path.resolve(root, 'assets');
  const relativeFromAssets = segments.slice(1).join('/');
  const sourcePath = path.resolve(assetsRoot, relativeFromAssets);
  const relativeCheck = path.relative(assetsRoot, sourcePath);
  if (
    !relativeCheck ||
    relativeCheck.startsWith('..') ||
    path.isAbsolute(relativeCheck)
  ) {
    throw new Error(`Invalid resume path "${rawResume}": path escapes the assets directory`);
  }
  if (path.extname(sourcePath).toLowerCase() !== '.pdf') {
    throw new Error(`Invalid resume path "${rawResume}": file must be a .pdf`);
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Configured resume PDF does not exist: "${rawResume}"`);
  }
  const stat = fs.statSync(sourcePath);
  if (!stat.isFile()) {
    throw new Error(`Configured resume path is not a regular file: "${rawResume}"`);
  }
  const realAssetsRoot = fs.realpathSync(assetsRoot);
  const realSourcePath = fs.realpathSync(sourcePath);
  const realRelative = path.relative(realAssetsRoot, realSourcePath);
  if (
    !realRelative ||
    realRelative.startsWith('..') ||
    path.isAbsolute(realRelative)
  ) {
    throw new Error(`Invalid resume path "${rawResume}": resolved file escapes the assets directory`);
  }

  return {
    sourcePath,
    destRelative: path.join('portfolio', 'assets', relativeCheck)
  };
}

const resumeAsset = resolveResumeAsset(profile?.contact?.resume);

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
if (config?.media_folder !== 'content/images' || config?.public_folder !== '/content/images') {
  throw new Error('Expected preserved top-level image upload configuration');
}
const siteContent = config.collections.find(col => col?.name === 'site_content');
const profileFileConfig = siteContent?.files?.find(file => file?.name === 'profile');
const contactConfig = profileFileConfig?.fields?.find(field => field?.name === 'contact');
const resumeFieldConfig = contactConfig?.fields?.find(field => field?.name === 'resume');
if (
  !resumeFieldConfig ||
  resumeFieldConfig.widget !== 'file' ||
  resumeFieldConfig.required !== false ||
  resumeFieldConfig.media_folder !== '/assets' ||
  resumeFieldConfig.public_folder !== '/assets'
) {
  throw new Error('Expected optional Resume PDF file widget configured for /assets');
}

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
if (resumeAsset) {
  const destPath = path.join(out, resumeAsset.destRelative);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(resumeAsset.sourcePath, destPath);
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
