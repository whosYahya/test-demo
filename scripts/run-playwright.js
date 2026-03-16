#!/usr/bin/env node

const { spawnSync } = require('child_process');

const suite = process.argv[2] || 'mutation';
const extraArgs = process.argv.slice(3);

const suiteTargets = {
  smoke: ['tests/smoke'],
  doctypes: ['tests/doctypes'],
  mutation: ['tests/doctypes', 'tests/cross_module'],
  'cross-module': ['tests/cross_module'],
  permissions: ['tests/cross_module'],
};

const targets = suiteTargets[suite] || extraArgs.filter((arg) => !arg.startsWith('-'));
const forwardedArgs = suiteTargets[suite] ? extraArgs : [];
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['playwright', 'test', ...targets, ...forwardedArgs];

const result = spawnSync(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    PW_SUITE: suite,
  },
  shell: process.platform === 'win32',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status === null ? 1 : result.status);
