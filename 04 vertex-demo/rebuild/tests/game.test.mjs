import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../game.mjs';
import * as R from '../rules.mjs';
import * as T from '../vendor/three.module.js';
const data=Object.fromEntries(await Promise.all(['player','weapons','enemies','levels'].map(async name=>[name,JSON.parse(await readFile(new URL(`../../../01 PORTFOLIO_VERTEX/data/${name}.json`,import.meta.url),'utf8'))])));
function game(level=0){const g=new Game(data,()=>.5);g.start(level);g.resume();return g;}
function advance(g,seconds,input={}){for(let i=0;i<Math.ceil(seconds*120);i++)g.step(1/120,input);}
test('five layouts reproduce original enemy counts and ammunition-box counts',()=>{
  for(let i=0;i<5;i++){const g=game(i),counts={};g.enemies.forEach(e=>counts[e.type]=(counts[e.type]||0)+1);assert.deepEqual(counts,data.levels.levels[i].enemies);assert.equal(g.map.ammo.length,g.level.ammo_boxes);assert.equal(g.available,i===0?1:i<3?2:3);}
});
test('scoring matches all four GDD sensitivity examples',()=>{
  for(const [time,hits,taken,total,grade] of [[210,90,0,97,'S'],[180,60,3,82,'A'],[250,95,0,78.5,'A'],[240,80,5,69,'B']]){
    const result=R.scoreRun(data.levels.levels[0],data.levels.scoring,{time,shots:100,hits,taken});assert.equal(result.total,total);assert.equal(result.grade,grade);
  }
  assert.equal(R.scoreRun(data.levels.levels[0],data.levels.scoring,{time:0,shots:0,hits:0,taken:0}).accuracy,0);
});
test('damage and shotgun falloff follow original JSON exactly',()=>{
  assert.equal(R.damageAt(data.weapons.pistol,5),25);assert.equal(R.damageAt(data.weapons.pistol,5,true),37.5);
  assert.equal(R.damageAt(data.weapons.shotgun,8),8);assert.ok(Math.abs(R.damageAt(data.weapons.shotgun,20)-1.6)<1e-8);
  assert.equal(data.weapons.shotgun.pellet_count,10);
});
test('movement and renderer look direction agree in all quadrants including pitch',()=>{
  const camera=new T.PerspectiveCamera();camera.rotation.order='YXZ';
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const pitch of [-.5,0,.5]){
    const d=R.direction(yaw,pitch);camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld();const forward=camera.getWorldDirection(new T.Vector3());
    for(const k of ['x','y','z'])assert.ok(Math.abs(forward[k]-d[k])<1e-7);
    const m=R.movement(yaw,0,1);assert.ok(m.x*d.x+m.z*d.z>0);
  }
  assert.ok(Math.abs(Math.hypot(...Object.values(R.movement(.8,1,1)))-1)<1e-7);
});
test('95 degree horizontal FOV is converted rather than used as vertical FOV',()=>{const v=R.verticalFov(95,16/9);assert.ok(v>62&&v<64);assert.ok(Math.abs(2*Math.atan(Math.tan(R.rad(v)/2)*16/9)*180/Math.PI-95)<1e-9);});
test('pause freezes every gameplay clock and rejects firing',()=>{
  const g=game();g.shoot();g.reload();g.pause();const before=JSON.stringify({time:g.time,p:g.p,enemies:g.enemies});advance(g,30,{fire:true,pressed:true,forward:1});assert.equal(JSON.stringify({time:g.time,p:g.p,enemies:g.enemies}),before);assert.equal(g.shoot(),false);
});
test('semi-auto and pump require new presses; rifle repeats at configured rate',()=>{
  const g=game(3);g.step(1/120,{pressed:true,fire:true});advance(g,1,{fire:true});assert.equal(g.stats.shots,1);
  g.select(1);advance(g,.2);const before=g.stats.shots;advance(g,1,{fire:true});assert.ok(g.stats.shots-before>=9&&g.stats.shots-before<=10);
  g.select(2);advance(g,.2);g.step(1/120,{pressed:true});const shots=g.stats.shots;advance(g,1.5,{fire:true});assert.equal(g.stats.shots,shots);
});
test('reload transfers finite reserves and switching cancels without gaining ammo',()=>{
  const g=game(1);g.shoot();g.reload();const a=g.p.ammo[0];g.select(1);advance(g,2);assert.equal(a.mag,11);assert.equal(a.reserve,96);
  g.select(0);g.reload();advance(g,1.3);assert.equal(a.mag,12);assert.equal(a.reserve,95);
  assert.deepEqual(R.reloadAmmo(1,2,12),{mag:3,reserve:0});
  g.shoot();g.reload();assert.ok(g.p.reload);g.shoot();assert.equal(g.p.reload,null);assert.equal(g.p.ammo[0].mag,11);
});
test('aim down sights applies the per-weapon movement coefficient',()=>{
  const a=game(),b=game();a.step(.05,{forward:1});b.step(.05,{forward:1,ads:true});assert.ok(Math.abs((12-b.p.z)/(12-a.p.z)-.6)<1e-6);
});
test('sprint exhausts in three seconds then cools down; jump returns to floor',()=>{
  const g=game();advance(g,3.1,{right:1,sprint:true});assert.ok(g.p.sprintCooldown>4.8);assert.equal(g.p.sprinting,false);advance(g,5.1);assert.ok(g.p.sprintLeft>2.9);
  g.step(1/120,{jump:true});assert.ok(g.p.y>0);advance(g,1);assert.equal(g.p.y,0);
});
test('all spawns are outside collision, and every room is navigable with gates open',()=>{
  for(let i=0;i<5;i++){const g=game(i);g.map.gates.forEach(x=>x.open=true);
    for(const e of g.enemies){const r=e.type==='elite'?.58:.4;assert.ok(R.canOccupy(e,r,g.solids),`${i} ${e.type} ${e.x},${e.z}`);const path=R.route(e,{x:0,z:12},r,g.solids);assert.ok(path.length>0);let previous=e;for(const p of path){assert.ok(R.clearSegment(previous,p,r,g.solids));previous=p;}}
    assert.ok(R.route(g.p,g.map.extract,.34,g.solids).length>0);
  }
});
test('gate blocks bullets and player consistently until opened',()=>{
  const g=game(),gate=g.map.gates[0];assert.equal(R.canOccupy({x:0,z:gate.z},.34,g.solids),false);
  assert.ok(g.trace({x:0,y:1.6,z:-15},{x:0,y:0,z:-1},5,false).box);gate.open=true;
  assert.equal(R.canOccupy({x:0,z:gate.z},.34,g.solids),true);assert.equal(g.trace({x:0,y:1.6,z:-15},{x:0,y:0,z:-1},5,false).box,undefined);
});
test('headshot, stun, elite burst interruption and shotgun accuracy count a shot once',()=>{
  const g=game(4);g.room=1;const e=g.enemies.find(e=>e.type==='elite');g.p.x=e.x;g.p.z=e.z+3;g.p.pitch=Math.atan2(e.y+1.7-1.65,3);g.p.yaw=0;e.burstLeft=3;e.telegraph={until:100,target:{x:0,y:1,z:0}};
  assert.ok(g.shoot());assert.ok(e.hp<300);assert.equal(e.burstLeft,0);assert.equal(e.telegraph,null);assert.ok(e.stunUntil>g.time);
  const h=game(3);h.p.weapon=2;const target=h.enemies[0];h.p.x=target.x;h.p.z=target.z+3;h.p.pitch=-.12;h.shoot();assert.equal(h.stats.shots,1);assert.equal(h.stats.hits,1);
});
test('restart resets combat state, ammunition and gates without loading fake save scores',()=>{
  const g=game();g.p.hp=0;g.finish(false);g.start(0);assert.equal(g.p.hp,100);assert.equal(g.p.ammo[0].mag,12);assert.equal(g.stats.shots,0);assert.equal(g.time,0);assert.equal(g.state,'ready');assert.ok(g.map.gates.every(x=>!x.open));assert.deepEqual(R.emptySave().levels,{});
});
test('patrol perception faces the entry and does not detect a player behind its FOV',()=>{
  const g=game(),e=g.enemies[0];g.prepare=0;g.p.x=e.x;g.p.z=e.z+4;g.step(.01);assert.equal(e.phase,'alert');assert.ok(e.alertAt>g.time);
  const h=game(),other=h.enemies[0];h.prepare=0;h.p.x=other.x;h.p.z=other.z-4;h.step(.01);assert.equal(other.phase,'patrol');
});
test('final-stage transition cannot reset the 90 second extraction deadline',()=>{
  const g=game(4);g.room=2;g.enemies.forEach(e=>e.dead=true);g.stats.kills=g.total;g.step(.01);const deadline=g.extractionUntil;assert.equal(deadline,g.time+90);
  g.p.z=-66;g.step(.01);g.step(.01);assert.equal(g.room,3);assert.equal(g.extractionUntil,deadline);advance(g,91);assert.equal(g.result.success,false);assert.equal(g.result.reason,'撤离超时');
});
