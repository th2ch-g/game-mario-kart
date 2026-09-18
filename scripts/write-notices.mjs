import fs from 'node:fs/promises';
import path from 'node:path';

const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'));
const sections = ['KARTLINE — Third-party licenses and notices'];
for (const [directory, dependency] of Object.entries(lock.packages).sort()) {
  if (!directory.startsWith('node_modules/') || dependency.dev) continue;
  let names;
  try {
    names = await fs.readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT' && dependency.optional) continue;
    throw error;
  }
  const manifest = JSON.parse(
    await fs.readFile(path.join(directory, 'package.json'), 'utf8'),
  );
  const licenses = names
    .filter((name) => /^(licen[cs]e|copying|notice)([._-]|$)/i.test(name))
    .sort();
  if (!licenses.length)
    throw new Error(`Missing license text for ${manifest.name}`);
  sections.push(
    `\n${'='.repeat(72)}\n${manifest.name} ${manifest.version}\n${'='.repeat(72)}`,
  );
  for (const filename of licenses) {
    const file = path.join(directory, filename);
    if ((await fs.stat(file)).isFile())
      sections.push(await fs.readFile(file, 'utf8'));
  }
}
await fs.mkdir('dist', { recursive: true });
await fs.writeFile(
  'dist/third-party-notices.txt',
  `${sections.join('\n\n')}\n`,
);
console.log('Wrote third-party licenses to dist/third-party-notices.txt');
