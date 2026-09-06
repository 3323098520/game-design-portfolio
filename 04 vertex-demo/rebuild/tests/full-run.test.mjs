import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game} from '../game.mjs';
import {distance,direction,route,canOccupy} from '../rules.mjs';
const data=Object.fromEntries(await Promise.all(['player','weapons','enemies','levels'].map(async name=>[name,JSON.parse(await readFile(new URL(`../../../01 PORTFOLIO_VERTEX/data/${name}.json`,import.meta.url),'utf8'))])));

// Deterministic simulation agent uses normal movement/fire/reload APIs. It does not
// edit HP, kills, ammo, room progression or result state. This is not human playtesting.
for(let index=0;index<5;index++)test(`complete original level 1-${index+1} through combat, gates and result`,()=>{
  const g=new Game(data,()=>.5);g.start(index);g.resume();if(index>0)g.select(1);
  let path=[],nextPath=0,lastGoal='',reloads=0;
  for(let frame=0;frame<60*240&&g.state==='playing';frame++){
    const enemies=g.enemies.filter(e=>!e.dead&&e.room===g.room).sort((a,b)=>distance(g.p,a)-distance(g.p,b));
    const e=enemies[0];let goal,pressed=false;
    if(e){
      const dx=e.x-g.p.x,dz=e.z-g.p.z;g.p.yaw=Math.atan2(-dx,-dz);g.p.pitch=Math.atan2(e.y+(e.type==='drone'?0:1.70)-1.65,Math.hypot(dx,dz));
      const hit=g.trace(g.eye(),direction(g.p.yaw,g.p.pitch+g.p.recoil));pressed=hit.enemy===e;
      goal={x:e.x,z:e.z+4};if(!canOccupy(goal,.34,g.solids))goal={x:e.x,z:e.z};
      if(pressed&&distance(g.p,e)<17)goal={x:g.p.x,z:g.p.z};
    }else goal=g.extractionUntil?g.map.extract:{x:0,z:-g.room*23-20};
    const key=`${Math.round(goal.x)},${Math.round(goal.z)}`;
    if(g.time>=nextPath||key!==lastGoal){path=route(g.p,goal,.34,g.solids);nextPath=g.time+.6;lastGoal=key;}
    while(path.length&&distance(g.p,path[0])<.12)path.shift();
    const dest=path[0]||goal,dx=dest.x-g.p.x,dz=dest.z-g.p.z,n=Math.hypot(dx,dz);let forward=0,right=0;
    if(n>.12){forward=(-Math.sin(g.p.yaw)*dx-Math.cos(g.p.yaw)*dz)/n;right=(Math.cos(g.p.yaw)*dx-Math.sin(g.p.yaw)*dz)/n;}
    const ammo=g.p.ammo[g.p.weapon];if(!ammo.mag&&!g.p.reload){g.reload();reloads++;}
    g.step(1/60,{forward,right,pressed:pressed&&!g.p.reload,ads:pressed});
  }
  assert.equal(g.state,'result',`stuck: room=${g.room}, pos=${JSON.stringify(g.p)}, kills=${g.stats.kills}`);
  assert.equal(g.result.success,true,`failed at ${g.time.toFixed(1)} seconds, ${g.stats.kills}/${g.total}, reason=${g.result.reason}`);
  assert.equal(g.stats.kills,g.total);assert.ok(g.stats.shots>0);assert.ok(g.stats.hits<=g.stats.shots);
  if(index===4)assert.ok(distance(g.p,g.map.extract)<1.7);
  console.log(`1-${index+1}: ${g.time.toFixed(1)}s, kills=${g.stats.kills}, shots=${g.stats.shots}, hitsTaken=${g.stats.taken}, reloads=${reloads}, grade=${g.result.grade}`);
});
