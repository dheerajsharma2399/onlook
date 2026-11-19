import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builderReleaseArgs, releaseOptions } from './release-channel.js';
import { commitCount, stamp } from './version.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'apps/studio');
const release = join(root, 'release');
const args = process.argv.slice(2);
const dirOnly = args.includes('--dir');
const { channel, version: requestedVersion } = releaseOptions(args, true);

if (process.platform !== 'linux') throw new Error('Build Linux artifacts on Linux');
const arch = process.arch;
if (arch !== 'x64' && arch !== 'arm64') throw new Error(`Unsupported Linux architecture: ${arch}`);
if (process.env['STUDIO_CLOUD_BUILD'] === '1') throw new Error('Linux is a source build only; unset STUDIO_CLOUD_BUILD');

const manifest = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8')) as { version: string };
const version = requestedVersion ?? (channel === undefined ? manifest.version : stamp(manifest.version, commitCount(root), channel));
const debArch = arch === 'x64' ? 'amd64' : 'arm64';
const appImageArch = arch === 'x64' ? 'x86_64' : 'arm64';
const debName = `Onlook-Source-${version}-${debArch}.deb`;
const appImageName = `Onlook-Source-${version}-${appImageArch}.AppImage`;

const sdkRequire = createRequire(createRequire(join(app, 'package.json')).resolve('@anthropic-ai/claude-agent-sdk'));
sdkRequire.resolve(`@anthropic-ai/claude-agent-sdk-linux-${arch}/claude`);

function run(argv: string[]): void {
  const result = spawnSync(process.execPath, argv, {
    cwd: app,
    stdio: 'inherit',
    env: { ...process.env, STUDIO_CLOUD_BUILD: '0' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Linux cut failed (${String(result.status)})`);
}

run(['run', 'build']);
run([
  'x', '--no-install', 'electron-builder',
  '--linux', `--${arch}`, '--config', 'electron-builder.yml',
  ...builderReleaseArgs(channel, version, false),
  '--publish', 'never',
  ...(dirOnly ? ['--dir'] : []),
]);

const unpacked = join(release, arch === 'x64' ? 'linux-unpacked' : `linux-${arch}-unpacked`);
const required = [
  join(unpacked, 'onlook-source'),
  join(unpacked, 'resources/app.asar'),
  join(unpacked, `resources/app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk-linux-${arch}/claude`),
  join(unpacked, 'resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node'),
];
for (const path of required) {
  if (!existsSync(path)) throw new Error(`Missing from the packaged app: ${path}`);
}

if (!dirOnly) {
  for (const name of [debName, appImageName]) {
    if (!existsSync(join(release, name))) throw new Error(`Missing Linux payload: ${name}`);
  }
  writeFileSync(join(release, 'signing-linux.txt'), 'unsigned\n');
}

console.log(`\nLinux cut complete: ${unpacked}`);
if (!dirOnly) {
  console.log(`  ${join(release, debName)}`);
  console.log(`  ${join(release, appImageName)}`);
  console.log(`\nInstall the deb: sudo apt install '${join(release, debName)}'`);
  console.log(`Run the AppImage: '${join(release, appImageName)}'`);
  console.log('Nothing was uploaded or published.');
}
