const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const lines=source.split('\n');
function world(){
  const c=vm.createContext({player:{radius:.42},colliders:[]});
  for(const name of ['arenaBounds','arenaCovers','waveSets'])vm.runInContext(lines.find(l=>l.startsWith(`const ${name}=`)).replace('const ','var '),c);
  // addCover adds a cap wider by .08 and a trim deeper by .1.
  c.colliders=c.arenaCovers.map(([x,z,w,h,d])=>({min:{x:x-w/2-.04,z:z-d/2-.05},max:{x:x+w/2+.04,z:z+d/2+.05}}));
  for(const name of ['canStand','walkSegment','findPath','moveEnemy','advanceEnemy'])vm.runInContext(lines.find(l=>l.startsWith(`function ${name}(`)),c);
  return c;
}
test('all wave spawns and extraction are clear of collision',()=>{
  const c=world();assert.ok(c.canStand(0,20));assert.ok(c.canStand(0,-25));
  for(const wave of c.waveSets)for(const[type,x,z]of wave)assert.ok(c.canStand(x,z,type==='charger'?.55:.42),`${type} spawn ${x},${z} is blocked`);
});
test('main route and flank route both connect spawn to extraction',()=>{
  const c=world();
  for(const target of [{x:1,z:18},{x:-12,z:18},{x:-12,z:-25},{x:0,z:-25}]){
    const start={x:0,z:20},route=c.findPath(start,target,.42);
    assert.ok(route.length>0,`unreachable ${JSON.stringify(target)}`);
    let previous=start;for(const p of route){assert.ok(c.walkSegment(previous,p,.42));previous=p;}
    assert.ok(c.walkSegment(previous,target,.42));
  }
});
test('partition blocks crossing except at the connection openings',()=>{
  const c=world();
  for(const z of [10,-7,-21])assert.equal(c.walkSegment({x:-11,z},{x:1,z},.42),false);
  for(const z of [19,1,-15.5,-25.5])assert.equal(c.walkSegment({x:-11,z},{x:1,z},.42),true);
  assert.equal(c.canStand(12,0),false);
});
test('charger goes around a cover and does not pass through it',()=>{
  const c=world(),target={x:-3,z:15},e={type:'charger',group:{position:{x:-3,z:9}}};
  assert.equal(c.walkSegment(e.group.position,target,.55),false);
  for(let frame=0;frame<60*15;frame++){
    c.advanceEnemy(e,target,3.05,1/60,frame*1000/60);
    assert.ok(c.canStand(e.group.position.x,e.group.position.z,.55));
  }
  assert.ok(Math.hypot(e.group.position.x-target.x,e.group.position.z-target.z)<.2,JSON.stringify(e.group.position));
});
test('every spawn has an obstacle-safe path to the player',()=>{
  const c=world(),target={x:0,z:20};
  for(const wave of c.waveSets)for(const[type,x,z]of wave){
    const r=type==='charger'?.55:.42,route=c.findPath({x,z},target,r);
    assert.ok(route.length>0,`no path for ${type} at ${x},${z}`);
    let previous={x,z};for(const p of route){assert.ok(c.walkSegment(previous,p,r));previous=p;}
  }
});
test('fractional enemy positions connect safely to grid; targets beside walls remain approachable',()=>{
  const c=world();
  for(const from of [{x:-3.3,z:9.4},{x:1.3,z:6.5},{x:-11.8,z:-13.3}]){
    const target={x:8.55,z:20},route=c.findPath(from,target,.55);
    assert.ok(route.length>0);let previous=from;
    for(const p of route){assert.ok(c.walkSegment(previous,p,.55));previous=p;}
    assert.ok(Math.hypot(previous.x-target.x,previous.z-target.z)<1.15);
  }
});
