const { spawn } = require('child_process');
const path = require('path');

async function testStdinInput() {
  console.log('Testing stdin input...');
  
  // Path to the STM binary
  const stmBin = path.resolve(__dirname, 'bin/stm');
  
  // First, init the repo
  console.log('Initializing repo...');
  const initChild = spawn('node', [stmBin, 'init'], { stdio: 'inherit' });
  await new Promise((resolve, reject) => {
    initChild.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Init failed with code ${code}`));
    });
  });
  
  // Add a task
  console.log('Adding task...');
  const addChild = spawn('node', [stmBin, 'add', 'Test task', '-'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let addStdout = '';
  let addStderr = '';
  
  addChild.stdout.on('data', (data) => {
    addStdout += data.toString();
  });
  
  addChild.stderr.on('data', (data) => {
    addStderr += data.toString();
  });
  
  // Send stdin input
  addChild.stdin.write('Test task content');
  addChild.stdin.end();
  
  await new Promise((resolve, _reject) => {
    addChild.on('close', (code) => {
      console.log('Add command result:');
      console.log('Exit code:', code);
      console.log('Stdout:', addStdout);
      console.log('Stderr:', addStderr);
      resolve();
    });
  });
  
  // Update task via stdin
  console.log('Updating task...');
  const updateChild = spawn('node', [stmBin, 'update', '1', '--description', '-'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let updateStdout = '';
  let updateStderr = '';
  
  updateChild.stdout.on('data', (data) => {
    updateStdout += data.toString();
  });
  
  updateChild.stderr.on('data', (data) => {
    updateStderr += data.toString();
  });
  
  // Send stdin input
  updateChild.stdin.write('Updated description from stdin');
  updateChild.stdin.end();
  
  await new Promise((resolve, _reject) => {
    updateChild.on('close', (code) => {
      console.log('Update command result:');
      console.log('Exit code:', code);
      console.log('Stdout:', updateStdout);
      console.log('Stderr:', updateStderr);
      resolve();
    });
  });
}

testStdinInput().catch(console.error);