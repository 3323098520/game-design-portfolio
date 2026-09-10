const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const demoRoot=path.resolve(__dirname,'..');

test('public entry loads the rebuilt application instead of the retired monolith',()=>{
  const html=fs.readFileSync(path.join(demoRoot,'index.html'),'utf8');
  assert.match(html,/rebuild\/app\.mjs\?v=/);
  assert.match(html,/rebuild\/style\.css\?v=/);
  assert.doesNotMatch(html,/cdn\.jsdelivr\.net/);
});

test('combat rules and original data adapters remain present',()=>{
  for(const file of ['app.mjs','game.mjs','rules.mjs','view.mjs','audio.mjs']){
    assert.ok(fs.statSync(path.join(demoRoot,'rebuild',file)).size>0,file);
  }
  const app=fs.readFileSync(path.join(demoRoot,'rebuild','app.mjs'),'utf8');
  assert.match(app,/01%20PORTFOLIO_VERTEX\/data/);
});
