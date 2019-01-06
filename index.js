#!/usr/bin/env node
/* eslint-disable require-jsdoc */
const execSh = require('exec-sh').promise;
const zxcvbn = require('zxcvbn');

const generateCmd= (args) => {
  let cmd = 'bw';
  for (const c of args) {
    cmd += ' ' + '"' + c.replace(/(["$])/g, '\\$1') + '"';
  }
  return cmd;
};

async function bw(...args) {
  return execSh(generateCmd(args), {
    stdio: ['inherit', 'pipe', 'inherit'],
  }).then((r) => r.stdout.trim());
}

function duplicatesReport(passwords) {
  console.log('Duplicate Passwords:');
  const result = {};
  const duplicatePasswords = new Set();
  passwords.forEach(([name, password]) => {
    if (!result.hasOwnProperty(password)) {
      result[password] = [];
    }
    result[password].push(name);
    if (result[password].length > 1) {
      duplicatePasswords.add(password);
    }
  });
  if (duplicatePasswords.size === 0) {
    console.log('  All goods !');
    return;
  }

  duplicatePasswords.forEach((d) => {
    console.log('    *', result[d].join(', '));
  });
}

function weakPasswordsReport(passwords) {
  console.log('Weak Passwords:');
  const resultType = ['Very weak', 'Weak', 'Normal', 'Safe', 'Strong'];
  const result = [[], [], [], [], []];
  passwords.forEach(([name, password]) => {
    const score = zxcvbn(password).score;
    result[score].push(name);
  });
  for (let i = 0; i < resultType.length; i++) {
    console.log('    *', resultType[i], '(', result[i].length, ')');
    if (i === resultType.length - 1) {
      console.log('       - The rest !');
      continue;
    }
    result[i].sort((a, b) => {
      const sA = a.toLowerCase();
      const sB = b.toLowerCase();
      return sA < sB ? -1 : sA > sB ? 1 : 0;
    }).forEach((name) => {
      console.log('       -', name);
    });
  }
}

async function run(login) {
  let session;
  if (login) {
    try {
      session = await bw('login', login, '--raw');
    } catch (e) {
      if (!e.stdout.startsWith('You are already logged')) {
        console.log(e.stdout);
        return;
      }
      if (e.stdout.trim() !== 'You are already logged in as '+login+'.') {
        await bw('logout');
        try {
          session = await bw('login', login, '--raw');
        } catch (e) {
          console.log(e.stdout);
          return;
        }
      }
    }
  }

  if (!session) {
    try {
      session = await bw('unlock', '--raw');
    } catch (e) {
      console.log(e.stdout);
      return;
    }
  }
  console.log();
  const isSync = await bw('sync', '--session', session);
  if (isSync != 'Syncing complete.') {
    console.log(isSync);
    return;
  }
  const data = await bw('list', 'items', '--session', session).then(JSON.parse);
  const passwords = data.filter((d) => d.login && d.login.password).map((d) => {
    return [d.name, d.login.password];
  });
  duplicatesReport(passwords);
  console.log();
  weakPasswordsReport(passwords);
  console.log();
}

run(process.argv[2]);
