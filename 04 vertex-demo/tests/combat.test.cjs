const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function context(names,globals={}) {
  const ctx=vm.createContext(globals);
  for(const name of names){
    const line=html.split('\n').find(l=>l.startsWith(`function ${name}(`));
    assert.ok(line,`Missing function ${name}`);
    vm.runInContext(line,ctx);
  }
  return ctx;
}
const panel=()=>({classList:{add(){},remove(){}}});
test('pause freezes simulation time and clears held input; resume has no stale input',()=>{
  const c=context(['gameNow','tickGameClock','clearCombatInput','pauseGame','resume'],{
    gameTime:0,state:'playing',keys:new Set(['KeyW']),mouseDown:true,
    hud:panel(),crosshair:panel(),pauseScreen:panel(),lockMouse(){}
  });
  c.tickGameClock(.5);c.pauseGame();
  for(let i=0;i<600;i++)c.tickGameClock(1/60);
  assert.equal(c.gameNow(),500);assert.equal(c.keys.size,0);assert.equal(c.mouseDown,false);
  c.resume();c.tickGameClock(.5);assert.equal(c.gameNow(),1000);
});
test('reload deadline keeps remaining time across pause',()=>{
  const c=context(['gameNow','tickGameClock','reload'],{
    gameTime:100,state:'playing',player:{weapon:0,ammo:[1],reloading:false},
    CFG:{weapons:[{magazine:12,reload:1.1}]},sound(){},toast(){}
  });
  c.reload();c.tickGameClock(.4);c.state='paused';c.tickGameClock(30);
  assert.equal(c.player.reloadUntil-c.gameNow(),700);
  c.state='playing';c.tickGameClock(.7);assert.equal(c.gameNow(),c.player.reloadUntil);
});
for(const fps of [30,60,144])test(`rifle accumulates during burst and recovers after release at ${fps} FPS`,()=>{
  const c=context(['recoverRecoil','weaponProfile']);const p=c.weaponProfile(1);
  let value=0,next=0,first=0;
  for(let frame=0;frame<fps;frame++){
    if(frame/fps+1e-9>=next){value=Math.min(.42,value+p.recoil);next+=.1;if(!first)first=value;}
    value=c.recoverRecoil(value,1/fps,p.recover);
  }
  assert.ok(value>first*3,`burst recoil ${value} must exceed single shot ${first}`);
  for(let frame=0;frame<fps*3;frame++)value=c.recoverRecoil(value,1/fps,p.recover);
  assert.equal(value,0);
});
test('pistol recovers before next shot; shotgun has stronger single-shot recoil',()=>{
  const c=context(['recoverRecoil','weaponProfile']);const p=c.weaponProfile(0),s=c.weaponProfile(2);
  assert.equal(c.recoverRecoil(p.recoil,1/4.2,p.recover),0);
  assert.ok(s.recoil>p.recoil*2);
});
test('fallback weapon profiles have independent finite pose and recoil values',()=>{
  const c=context(['weaponProfile','initializeWeapon']);
  for(let i=0;i<3;i++){
    const position={clone:()=>({x:.3,y:-.3,z:-.6})},rotation={clone:()=>({x:0,y:0,z:0})};
    const holder={position,rotation,userData:{}};c.initializeWeapon(holder,i);
    assert.ok(Number.isFinite(holder.userData.recoil));assert.ok(Number.isFinite(holder.userData.recover));
    assert.notEqual(holder.userData.basePos,position);assert.equal(holder.userData.basePos.z,-.6);
  }
});
test('switch cancels reload, muzzle flash, pump and previous weapon recoil',()=>{
  const models=Array.from({length:3},()=>({visible:true,userData:{pumpUntil:200,flash:{visible:true}}}));
  const c=context(['selectWeapon'],{CFG:{weapons:[{},{},{}]},player:{weapon:0,reloading:true},weaponModels:models,
    recoil:.3,recoilSide:.1,weaponRoot:{rotation:{set(){}}},updateWeaponUI(){}});
  c.selectWeapon(2);assert.equal(c.player.weapon,2);assert.equal(c.player.reloading,false);
  assert.equal(c.recoil,0);assert.equal(c.recoilSide,0);
  assert.deepEqual(models.map(m=>m.visible),[false,false,true]);
  assert.ok(models.every(m=>!m.userData.flash.visible&&m.userData.pumpUntil===0));
  c.selectWeapon(99);assert.equal(c.player.weapon,2);
});
test('expired effects dispose geometry and each material once',()=>{
  let geometry=0,materials=0,removed=0;
  const object={traverse(fn){fn({geometry:{dispose(){geometry++}},material:[{dispose(){materials++}},{dispose(){materials++}}]})}};
  const c=context(['disposeEffect','updateEffects'],{scene:{remove(){removed++}},effects:[{object,until:100}]});
  c.updateEffects(99,0);assert.equal(removed,0);
  c.updateEffects(101,0);c.updateEffects(102,0);
  assert.equal(c.effects.length,0);assert.equal(removed,1);assert.equal(geometry,1);assert.equal(materials,2);
});
test('entire module parses and simulation timers do not use wall clock',()=>{
  const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  new (Object.getPrototypeOf(async function(){}).constructor)(source.replace(/^import .*;$/gm,''));
  assert.equal((source.match(/performance\.now\(\)/g)||[]).length,1);
});
test('real fire function consumes ammo, counts pellets, respects cooldown and pause',()=>{
  class Vector {
    constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
    clone(){return new Vector(this.x,this.y,this.z);}
    normalize(){const n=Math.hypot(this.x,this.y,this.z)||1;return this.multiplyScalar(1/n);}
    multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
    add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  }
  for(let i=0;i<3;i++){
    let shells=0,tracers=0;
    const c=context(['gameNow','weaponProfile','flashMuzzle','fire'],{
      gameTime:100,state:'playing',recoil:0,recoilSide:0,
      player:{weapon:i,ammo:[12,30,6],nextShot:0,shots:0,hits:0,reloading:false},
      CFG:{weapons:[{fireRate:4.2,pellets:1,spread:.002},{fireRate:10,pellets:1,spread:.012},{fireRate:1.05,pellets:8,spread:.07}]},
      weaponModels:[{userData:{}},{userData:{}},{userData:{}}],
      THREE:{Vector3:Vector,Raycaster:class{intersectObjects(){return [];}}},
      camera:{getWorldPosition:()=>new Vector(),getWorldDirection:()=>new Vector(0,0,-1)},
      coverMeshes:[],enemies:[],sound(){},ejectShell(){shells++;},tracer(){tracers++;},updateHUD(){},reload(){}
    });
    c.weaponModels[i].userData=c.weaponProfile(i);
    const initial=c.player.ammo[i];c.fire();
    assert.equal(c.player.ammo[i],initial-1);assert.equal(c.player.shots,i===2?8:1);
    assert.equal(tracers,c.player.shots);assert.equal(shells,1);assert.ok(Number.isFinite(c.recoil));
    c.fire();assert.equal(c.player.ammo[i],initial-1);
    c.gameTime+=2000;c.state='paused';c.fire();assert.equal(c.player.ammo[i],initial-1);
    c.state='playing';c.fire();assert.equal(c.player.ammo[i],initial-2);
  }
});
