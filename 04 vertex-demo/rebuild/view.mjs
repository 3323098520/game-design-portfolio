import * as T from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {clamp,verticalFov} from './rules.mjs?v=20260906-1';

const palette={white:0xf2f4f7,blue:0x438eb0,orange:0xff9f43,green:0x8fbc8f,navy:0x24384a,metal:0x6c8593,skin:0xd3a57e};
const mat=color=>new T.MeshStandardMaterial({color,roughness:.68,metalness:.08});
const materials=Object.fromEntries(Object.entries(palette).map(([k,v])=>[k,mat(v)]));
const cube=new T.BoxGeometry(1,1,1),sphere=new T.SphereGeometry(1,10,7),tube=new T.CylinderGeometry(1,1,1,10);
const bevelCube=new RoundedBoxGeometry(1,1,1,1,.065);
function mesh(parent,geometry,material,pos=[0,0,0],scale=[1,1,1]){const m=new T.Mesh(geometry,material);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,pos,size,color='white'){let node=parent,rounded=false;while(node){if(node.userData.beveled){rounded=true;break;}node=node.parent;}return mesh(parent,rounded?bevelCube:cube,materials[color]||color,pos,size);}
function ball(parent,pos,size,color='navy'){return mesh(parent,sphere,materials[color]||color,pos,size);}
function link(parent,a,b,r1,r2,color='navy'){const midpoint=a.map((v,i)=>(v+b[i])/2),length=Math.hypot(...a.map((v,i)=>v-b[i]));const m=mesh(parent,tube,materials[color],midpoint,[r1,length,r2]);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...b).sub(new T.Vector3(...a)).normalize());return m;}
function cylinder(parent,pos,r,length,color='navy'){const m=mesh(parent,tube,materials[color],pos,[r,length,r]);m.rotation.x=Math.PI/2;return m;}
function label(parent,text,pos,width=4,color='#245774'){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#f2f4f7';ctx.fillRect(0,0,512,128);ctx.fillStyle=color;ctx.font='700 55px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,86);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(width,width/4),new T.MeshBasicMaterial({map:texture}));m.position.set(...pos);parent.add(m);return m;}
function hand(parent,pos,side,support=false){
  const g=new T.Group();g.position.set(...pos);parent.add(g);
  ball(g,[0,0,0],[.071,.092,.045],'navy');box(g,[0,.02,.041],[.1,.085,.016],'metal');
  for(let i=0;i<4;i++){
    const y=.053-i*.033;
    link(g,[side*.045,y,.012],[side*.078,y,-.033],.015,.015,'navy');
    link(g,[side*.078,y,-.033],[side*.035,y,-.066],.014,.014,'navy');
    ball(g,[side*.035,y,-.066],[.017,.014,.015],'metal');
  }
  link(g,[-side*.055,.038,.02],[-side*.075,.071,-.025],.025,.022,'navy');
  link(g,[-side*.075,.071,-.025],[-side*.024,.063,-.043],.022,.018,'navy');
  if(support)g.rotation.z=-Math.PI/2;
  return g;
}
function arm(parent,handPos,side){
  const g=new T.Group();parent.add(g);g.userData.wrist=handPos;g.userData.side=side;
  const elbow=[side*.28,-.42,.48],wrist=[handPos[0],handPos[1]-.075,handPos[2]+.045];
  link(g,elbow,wrist,.075,.067,'blue');ball(g,wrist,[.078,.055,.073],'navy');
  const guard=link(g,[elbow[0],elbow[1]+.035,elbow[2]-.03],[wrist[0],wrist[1]-.06,wrist[2]+.08],.079,.075,'white');guard.scale.x*=.9;
  return g;
}
function createGun(index){
  const root=new T.Group(),gun=new T.Group(),support=new T.Group();root.userData.beveled=true;root.add(gun,support);
  let muzzle,mag,pump=null,bolt;
  const accent=index===0?'blue':index===1?'orange':'green';
  if(index===0){
    box(gun,[0,.07,-.17],[.125,.12,.43],'navy');box(gun,[0,.10,-.18],[.135,.075,.34],accent);
    cylinder(gun,[0,.056,-.405],.035,.085,'metal');cylinder(gun,[0,.056,-.451],.022,.008,'navy');
    const grip=box(gun,[0,-.092,.005],[.10,.23,.12],'navy');grip.rotation.x=-.2;
    box(gun,[0,.145,-.18],[.10,.025,.33],'navy');box(gun,[0,.17,-.315],[.014,.025,.033],'orange');box(gun,[0,.17,-.04],[.087,.025,.017],'navy');
    for(const x of [-.036,.036])box(gun,[x,.188,-.04],[.008,.008,.01],'white');
    bolt=box(gun,[0,.10,-.06],[.13,.07,.13],accent);muzzle=[0,.056,-.458];
    mag=box(gun,[0,-.15,.01],[.088,.17,.1],'metal');
  }else{
    box(gun,[0,.052,-.19],[.145,.16,.38],'navy');box(gun,[0,.115,-.24],[.155,.065,.42],accent);
    link(gun,[0,.025,.04],[.28,-.08,.75],.045,.038,'navy');box(gun,[.29,-.08,.8],[.13,.22,.08],accent);
    const grip=box(gun,[0,-.10,.04],[.10,.23,.115],'navy');grip.rotation.x=-.25;
    cylinder(gun,[0,.075,-.6],index===2?.033:.022,.51,'metal');cylinder(gun,[0,.075,-.87],index===2?.045:.035,.07,'navy');
    box(gun,[0,.163,-.06],[.065,.055,.065],'navy');box(gun,[0,.19,-.06],[.065,.022,.065],'navy');
    box(gun,[-.035,.213,-.065],[.018,.05,.035],'navy');box(gun,[.035,.213,-.065],[.018,.05,.035],'navy');
    box(gun,[0,.139,-.65],[.032,.10,.035],'navy');box(gun,[0,.207,-.65],[.014,.044,.025],'orange');
    if(index===1){box(gun,[0,.035,-.51],[.16,.12,.3],accent);for(let i=0;i<5;i++)box(gun,[.082,.04,-.4-i*.045],[.008,.04,.026],'navy');}
    else{cylinder(gun,[0,.005,-.48],.032,.59,'navy');pump=box(gun,[0,-.012,-.48],[.17,.13,.22],accent);for(let i=0;i<5;i++)box(pump,[0,0,(i-2)*.17],[1.025,1.02,.055],'navy');}
    mag=box(gun,[0,-.15,-.15],[.11,index===1?.24:.065,.135],'metal');if(index===1)mag.rotation.x=.12;
    bolt=box(gun,[.082,.065,-.12],[.027,.045,.12],'metal');muzzle=[0,.075,-.91];
  }
  const rightPos=[.012,-.105,index===0?.025:.065],leftPos=index===0?[-.09,-.10,.00]:[-.015,-.07,index===1?-.48:-.48];
  hand(root,rightPos,1);arm(root,rightPos,1);
  const left=hand(support,leftPos,-1,index!==0),leftArm=arm(support,leftPos,-1);
  const flash=new T.Group();flash.position.set(...muzzle);gun.add(flash);
  const flashMat=new T.MeshBasicMaterial({color:0xffe8a6,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending});
  const flame=mesh(flash,new T.ConeGeometry(.055,.27,6),flashMat,[0,0,-.11]);flame.rotation.x=-Math.PI/2;
  for(let i=0;i<3;i++){const spike=mesh(flash,new T.ConeGeometry(.032,.17,4),flashMat,[Math.cos(i*2.1)*.036,Math.sin(i*2.1)*.036,-.08]);spike.rotation.x=-Math.PI/2;}
  flash.visible=false;
  root.scale.setScalar(.72);root.userData={beveled:true,gun,support,left,leftArm,mag,magBase:mag.position.clone(),pump,bolt,boltBase:bolt.position.clone(),flash,muzzle:new T.Vector3(...muzzle),index};
  root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
  return root;
}
function robot(type){
  const root=new T.Group(),body=new T.Group();root.userData.beveled=true;root.add(body);const color=type==='rusher'?'orange':type==='elite'?'navy':'blue';
  let legs=[],arms=[];
  if(type==='drone'){
    ball(body,[0,0,0],[.4,.24,.32],'white');ball(body,[0,0,.29],[.19,.1,.05],'orange');
    for(const x of [-.48,.48])for(const z of [-.35,.35]){link(body,[0,0,0],[x,0,z],.045,.045,'metal');const rotor=mesh(body,tube,materials.navy,[x,.04,z],[.25,.028,.25]);arms.push(rotor);}
  }else{
    const elite=type==='elite',w=elite?.94:.62;
    box(body,[0,1.10,0],[w,.6,.42],color);box(body,[0,1.13,.23],[w*.8,.39,.08],'white');
    box(body,[0,1.12,.28],[w*.48,.07,.018],'orange');ball(body,[0,1.7,0],[.28,.27,.26],'white');
    box(body,[0,1.73,.24],[.39,.115,.053],'navy');box(body,[0,1.73,.273],[.24,.026,.01],'orange');
    for(const side of [-1,1]){
      const leg=new T.Group();leg.position.set(side*.19,.79,0);body.add(leg);ball(leg,[0,0,0],[.115,.12,.12],'metal');link(leg,[0,0,0],[0,-.33,0],.1,.09,'navy');ball(leg,[0,-.34,0],[.12,.12,.115],'white');link(leg,[0,-.36,0],[0,-.66,.035],.085,.085,'metal');box(leg,[0,-.72,.075],[.23,.14,.35],color);legs.push(leg);
      const armGroup=new T.Group();armGroup.position.set(side*(w/2+.1),1.35,0);body.add(armGroup);ball(armGroup,[0,0,0],[.16,.16,.16],'white');link(armGroup,[0,0,0],[0,-.28,.08],.09,.085,color);link(armGroup,[0,-.28,.08],[-side*.12,-.25,.32],.08,.08,'metal');ball(armGroup,[-side*.12,-.25,.32],[.10,.09,.1],'navy');arms.push(armGroup);
    }
    const blaster=box(body,[.28,1.10,.47],[.12,.12,.4],'navy');cylinder(body,[.28,1.10,.7],.055,.065,'orange');
  }
  const ring=new T.Mesh(new T.RingGeometry(.5,.56,24),new T.MeshBasicMaterial({color:palette[color],side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=type==='drone'?-2.45:.018;root.add(ring);
  const beamGeometry=new T.BufferGeometry();beamGeometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(6),3));
  const warning=new T.Line(beamGeometry,new T.LineBasicMaterial({color:0xff5f2d,transparent:true,opacity:.7,depthWrite:false}));warning.frustumCulled=false;root.add(warning);warning.visible=false;
  root.userData={body,legs,arms,ring,warning};return root;
}

export class View {
  constructor(canvas){
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;this.renderer.info.autoReset=false;
    this.scene=new T.Scene();this.scene.background=new T.Color(0x7ec8e3);this.scene.fog=new T.Fog(0xa9d9e6,38,110);
    this.camera=new T.PerspectiveCamera(95,1,.06,150);this.camera.rotation.order='YXZ';
    this.scene.add(new T.HemisphereLight(0xffffff,0x8faaa0,2.6));const sun=new T.DirectionalLight(0xfff4dc,3.1);sun.position.set(-12,28,14);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-22,right:22,top:26,bottom:-26,near:1,far:100});sun.shadow.bias=-.001;this.scene.add(sun);this.sun=sun;this.scene.add(sun.target);
    this.world=new T.Group();this.scene.add(this.world);this.actors=new Map();this.gates=[];this.pickups=[];
    this.weaponScene=new T.Scene();this.weaponScene.add(new T.HemisphereLight(0xffffff,0x80959e,3));const wl=new T.DirectionalLight(0xffeed8,3);wl.position.set(-2,4,3);this.weaponScene.add(wl);
    this.weaponCamera=new T.PerspectiveCamera(62,1,.02,10);this.weaponCamera.rotation.order='YXZ';this.weaponRoot=new T.Group();this.weaponRoot.position.set(.21,-.16,-.5);this.weaponScene.add(this.weaponRoot);
    this.guns=[0,1,2].map(createGun);this.guns.forEach(g=>this.weaponRoot.add(g));this.effects=[];this.elapsed=0;this.damage=0;this.lastWeapon=0;
    this.effectMaterials={spark:new T.MeshBasicMaterial({color:0xffbd62}),hit:new T.MeshBasicMaterial({color:0x65daee}),shell:mat(0xc99d43),shellRed:mat(0xd15c3c)};
    this.resize();
  }
  resize(){const {clientWidth:w,clientHeight:h}=this.renderer.domElement;this.renderer.setSize(w,h,false);for(const c of [this.camera,this.weaponCamera]){c.aspect=w/h;c.updateProjectionMatrix();}}
  clearWorld(){
    for(const effect of this.effects){this.scene.remove(effect.mesh);if(effect.owned){effect.mesh.geometry.dispose();effect.mesh.material.dispose();}}this.effects=[];
    this.world.traverse(o=>{if((o.isMesh||o.isLine)&&![cube,bevelCube,sphere,tube].includes(o.geometry)){o.geometry.dispose();if(o.material?.map)o.material.map.dispose();if(!Object.values(materials).includes(o.material))o.material.dispose();}});
    this.world.clear();this.actors.clear();this.gates=[];this.pickups=[];
  }
  build(game){
    this.clearWorld();this.game=game;this.pendingShell=0;this.weaponRoot.position.set(.21,-.16,-.5);this.weaponRoot.rotation.set(0,0,0);for(const g of this.guns){g.userData.flashLife=0;g.userData.flash.visible=false;}
    box(this.world,[0,-.22,-35],[70,.4,118],'green');box(this.world,[0,-.025,-35],[20,.05,102],'white');
    for(let z=12;z>-87;z-=4){box(this.world,[0,.006,z],[20,.008,.025],'metal');}
    for(const x of [-9.4,9.4])box(this.world,[x,.009,-35],[.10,.015,102],'orange');
    for(const b of game.map.boxes){
      box(this.world,[b.x,b.h/2,b.z],[b.w,b.h,b.d],b.kind==='cover'?'white':'white');
      if(b.kind==='cover'){box(this.world,[b.x,.16,b.z],[b.w+.04,.32,b.d+.04],'navy');box(this.world,[b.x,b.h-.2,b.z],[b.w+.035,.10,b.d+.035],'orange');
        for(const side of [-1,1])box(this.world,[b.x+side*(b.w/2-.12),b.h/2,b.z],[.13,b.h,b.d+.045],'metal');}
      else if(b.kind==='divider')box(this.world,[b.x,b.h-.22,b.z],[b.w+.03,.2,b.d+.03],'blue');
      else box(this.world,[b.x,.6,b.z],[b.w+.03,1.2,b.d+.03],'blue');
    }
    for(const gate of game.map.gates){const g=new T.Group();g.position.set(gate.x,0,gate.z);this.world.add(g);box(g,[0,1.85,0],[gate.w,3.7,gate.d],'blue');for(let i=-3;i<=3;i++)box(g,[i,1.85,.26],[.06,3.6,.03],'white');label(g,'CLEAR TO PROCEED',[0,2.1,.29],4);this.gates.push({mesh:g,data:gate});}
    for(let room=0;room<4;room++){
      const z=-room*23;label(this.world,`0${room+1} / VERTEX`,[0,4.1,z-16.7],5.6);
      box(this.world,[0,4.8,z-17],[20,1,1],'white');box(this.world,[0,4.28,z-16.43],[7,.11,.07],'orange');
      for(const x of [-12.5,12.5]){link(this.world,[x,0,z+7],[x,5.2,z+7],.18,.18,'metal');ball(this.world,[x,6,z+7],[1.9,2,1.7],'green');}
      for(const x of [-14,14]){box(this.world,[x,4,z-5],[5,8,12],'white');box(this.world,[x,5.5,z-5],[5.03,2,11.8],'blue');}
      const arrow=new T.Mesh(new T.ConeGeometry(.25,.85,3),materials.orange);arrow.rotation.x=-Math.PI/2;arrow.position.set(0,.035,z+8);arrow.scale.z=.05;this.world.add(arrow);
    }
    for(const pickup of game.map.ammo){const g=new T.Group();g.position.set(pickup.x,.55,pickup.z);this.world.add(g);box(g,[0,0,0],[.9,.75,.65],'navy');box(g,[0,.1,.335],[.64,.37,.025],'orange');box(g,[0,.1,.355],[.09,.26,.02],'white');box(g,[0,.1,.355],[.27,.085,.02],'white');this.pickups.push({mesh:g,data:pickup});}
    const extraction=new T.Mesh(new T.RingGeometry(1.4,1.8,40),new T.MeshBasicMaterial({color:0x36bd8e,side:T.DoubleSide}));extraction.rotation.x=-Math.PI/2;extraction.position.set(0,.02,-82);this.world.add(extraction);this.extract=extraction;label(this.world,'FINISH / 认证终点',[0,2.8,-86.4],5);
    for(const e of game.enemies){const m=robot(e.type);this.world.add(m);this.actors.set(e.id,m);}
    this.render(game,0,{fov:95});
  }
  particle(point,velocity,kind='spark',life=.35,scale=.04){
    if(this.effects.length>=96){const old=this.effects.shift();this.scene.remove(old.mesh);if(old.owned){old.mesh.geometry.dispose();old.mesh.material.dispose();}}
    const m=new T.Mesh(kind.startsWith('shell')?tube:cube,this.effectMaterials[kind]);m.position.set(point.x,point.y,point.z);m.scale.set(scale,kind.startsWith('shell')?scale*3:scale,scale);this.scene.add(m);this.effects.push({mesh:m,velocity,life,initial:life});
  }
  event(event,game){
    if(event.type==='shot'){
      for(const impact of event.impacts)if(impact.point.y<8){for(let i=0;i<(event.weapon===2?1:4);i++)this.particle(impact.point,{x:(Math.random()-.5)*2,y:1+Math.random()*2,z:(Math.random()-.5)*2},impact.hit?'hit':'spark');}
      this.guns[event.weapon].userData.flash.visible=true;this.guns[event.weapon].userData.flashLife=event.weapon===2?.08:.045;
      if(event.weapon!==2)this.eject(game);else this.pendingShell={remaining:.22,weapon:2};
    }
    if(event.type==='kill')for(let i=0;i<12;i++)this.particle(event.point,{x:(Math.random()-.5)*4,y:2+Math.random()*3,z:(Math.random()-.5)*4},'hit',.55,.06);
    if(event.type==='enemy_shot'){const geometry=new T.BufferGeometry().setFromPoints([new T.Vector3(event.from.x,event.from.y,event.from.z),new T.Vector3(event.to.x,event.to.y,event.to.z)]),m=new T.Line(geometry,new T.LineBasicMaterial({color:0xff8643,transparent:true,opacity:.85}));this.scene.add(m);this.effects.push({mesh:m,velocity:{x:0,y:0,z:0},life:.09,initial:.09,owned:true});}
  }
  eject(game,weapon=game.p.weapon){const p=game.p,right=new T.Vector3(Math.cos(p.yaw),0,-Math.sin(p.yaw)),origin=new T.Vector3(p.x,p.y+1.4,p.z).addScaledVector(right,.25);this.particle(origin,{x:right.x*2,y:1.5,z:right.z*2},weapon===2?'shellRed':'shell',.9,.018);}
  render(game,dt,settings){
    const p=game.p;this.elapsed+=dt;
    for(const [id,m] of this.actors){const e=game.enemies.find(e=>e.id===id);m.visible=!e.dead&&e.room<=game.room;if(!m.visible)continue;m.position.set(e.x,e.y,e.z);m.rotation.y=e.yaw;
      const moving=e.phase==='chase'||e.phase==='patrol',walk=moving?Math.sin(game.time*(e.type==='rusher'?13:7)+id)*.4:0;
      m.userData.legs.forEach((leg,i)=>leg.rotation.x=walk*(i?1:-1));m.userData.arms.forEach((arm,i)=>{if(e.type==='drone')arm.rotation.y=game.time*35;else arm.rotation.x=-walk*.35*(i?1:-1);});
      m.userData.body.rotation.z=game.time<e.stunUntil?Math.sin(game.time*65)*.10:0;m.userData.ring.material.color.set(e.telegraph?0xff653f:palette[e.type==='rusher'?'orange':'blue']);
      const warning=m.userData.warning;warning.visible=!!e.telegraph;if(e.telegraph){m.updateMatrixWorld(true);const local=m.worldToLocal(new T.Vector3(e.telegraph.target.x,e.telegraph.target.y,e.telegraph.target.z)),a=warning.geometry.attributes.position;a.setXYZ(0,0,e.type==='drone'?0:1.5,0);a.setXYZ(1,local.x,local.y,local.z);a.needsUpdate=true;}
    }
    for(const g of this.gates)g.mesh.position.y=g.data.open?4.2:0;
    for(const p of this.pickups){p.mesh.visible=!p.data.used;p.mesh.rotation.y=Math.sin(game.time)*.10;}
    this.extract.visible=game.stats.kills===game.total;
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;if(!e.owned){e.velocity.y-=9*dt;e.mesh.position.x+=e.velocity.x*dt;e.mesh.position.y+=e.velocity.y*dt;e.mesh.position.z+=e.velocity.z*dt;e.mesh.rotation.x+=dt*9;e.mesh.rotation.z+=dt*6;}if(e.life<=0){this.scene.remove(e.mesh);if(e.owned){e.mesh.geometry.dispose();e.mesh.material.dispose();}this.effects.splice(i,1);}}
    if(this.pendingShell){this.pendingShell.remaining-=dt;if(this.pendingShell.remaining<=0){this.eject(game,this.pendingShell.weapon);this.pendingShell=0;}}
    const bob=p.moving?Math.sin(game.time*(p.sprinting?15:10))*.006:0;
    this.camera.position.set(p.x,p.y+1.65,p.z);this.camera.rotation.set(p.pitch+p.recoil,p.yaw,0);
    const fov=verticalFov(settings.fov*(p.ads?.83:1),this.camera.aspect);this.camera.fov=game.state==='playing'?this.camera.fov+(fov-this.camera.fov)*(1-Math.exp(-14*dt)):fov;this.camera.updateProjectionMatrix();
    this.sun.position.set(p.x-12,28,p.z+14);this.sun.target.position.set(p.x,0,p.z-8);
    this.guns.forEach((gun,i)=>{gun.visible=i===p.weapon;const u=gun.userData;u.flashLife=Math.max(0,(u.flashLife||0)-dt);u.flash.visible=u.flashLife>0;});
    const gun=this.guns[p.weapon],u=gun.userData,ads=p.ads?1:0;
    const targetX=ads?0:.21,targetY=ads?(p.weapon===0?-.13:-.15):-.16,targetZ=ads?-.46:-.5;
    this.weaponRoot.position.lerp(new T.Vector3(targetX,targetY+bob,targetZ+p.kick*(p.weapon===2?.09:.035)),1-Math.exp(-16*Math.max(dt,.001)));
    this.weaponRoot.rotation.set(p.kick*(p.weapon===2?.19:.08)+(p.sprinting?-.20:0),0,0);
    u.mag.position.copy(u.magBase);u.mag.visible=true;u.support.position.set(0,0,0);u.support.rotation.set(0,0,0);gun.rotation.set(0,0,0);
    u.bolt.position.copy(u.boltBase);u.bolt.position.z+=p.kick*.035;
    if(u.pump){const phase=1-p.pump,travel=p.pump>0?Math.sin(clamp((phase-.1)/.75,0,1)*Math.PI)*.15:0;u.pump.position.z=-.48+travel;u.support.position.z=travel;}
    if(p.reload){const t=clamp((game.time-p.reload.start)/(p.reload.end-p.reload.start),0,1),envelope=Math.sin(t*Math.PI);gun.rotation.z=-envelope*.25;gun.rotation.x=envelope*.12;
      const magMove=Math.sin(clamp((t-.12)/.7,0,1)*Math.PI);u.support.position.set(envelope*.10,-magMove*.30,envelope*.21);u.support.rotation.z=-envelope*.22;
      if(p.weapon!==2){u.mag.position.y-=magMove*.35;u.mag.visible=!(t>.36&&t<.56);}else u.support.position.y-=Math.abs(Math.sin(t*Math.PI*4))*.07;
    }
    this.renderer.info.reset();this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);if(game.state!=='menu'){this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.weaponCamera);}this.renderer.autoClear=true;
  }
}
