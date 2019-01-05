#!/usr/bin/env node
const execSh = require('exec-sh').promise;
const zxcvbn = require('zxcvbn');

const generateCmd= (args) => {
  let cmd = 'bw';
  for (const c of args) {
    cmd += ' ' + '"' + c.replace(/(["$])/g, '\\$1') + '"';
  }
  return cmd;
};

const bw = (...args) => {
  return execSh(generateCmd(args), {
    stdio: ['inherit', 'pipe', 'inherit'],
  }).then((r) => r.stdout.trim()).catch((r) => r.stdout.trim());
};

const duplicatesReport = (passwords) => {
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
};

const weakPasswordsReport = (passwords) => {
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
};

const run = async () => {
  const session = await bw('unlock', '--raw');
  console.log();
  if (session === 'You are not logged in.') {
    console.log(session);
    console.log('Please login to bitwarden first.');
    console.log('$ bw login');
    return;
  }
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
};

run();
