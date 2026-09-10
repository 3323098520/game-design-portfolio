const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const demoRoot=path.resolve(__dirname,'..');

test('public entry keeps every DOM hook required by the rebuilt controller',()=>{
  const html=fs.readFileSync(path.join(demoRoot,'index.html'),'utf8');
  const required=['viewport','continue','levels','hud','reticle','pause','window-mode','settings','result'];
  for(const id of required)assert.match(html,new RegExp(`id=["']${id}["']`),id);
});

test('menu artwork and vendored renderer are shipped with the demo',()=>{
  const files=[
    ['rebuild','assets','vertex-training-campus.png'],
    ['rebuild','vendor','three.module.js'],
    ['rebuild','vendor','three.core.js']
  ];
  for(const parts of files)assert.ok(fs.statSync(path.join(demoRoot,...parts)).size>0,parts.join('/'));
});
