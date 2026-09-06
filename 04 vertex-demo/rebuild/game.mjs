import {clamp,rad,distance,movement,direction,weaponIds,scoreRun,damageAt,reloadAmmo,rayBox,layout,canOccupy,clearSegment,route} from './rules.mjs?v=20260906-1';

export class Game {
  constructor(data,random=Math.random){this.data=data;this.random=random;this.state='menu';this.events=[];this.time=0;this.nextId=0;}
  emit(type,detail={}){this.events.push({type,time:this.time,...detail});}
  start(index){
    this.index=index;this.level=this.data.levels.levels[index];this.map=layout(index);this.solids=[...this.map.boxes,...this.map.gates];
    this.time=0;this.state='ready';this.room=0;this.prepare=2.8;this.extractionUntil=null;this.finishedRooms=new Set();this.result=null;this.events=[];
    this.available=index===0?1:index<3?2:3;
    this.p={x:0,y:0,z:12,yaw:0,pitch:0,vy:0,hp:this.data.player.max_hp,weapon:0,ads:false,
      ammo:weaponIds.map(id=>({mag:this.data.weapons[id].magazine_size,reserve:this.data.weapons[id].reserve_ammo})),
      nextShot:0,lastShot:-10,burst:0,recoil:0,reload:null,shotSerial:0,kick:0,pump:0,sprintLeft:3,sprintCooldown:0,sprinting:false};
    this.stats={time:0,shots:0,hits:0,taken:0,deaths:0,kills:0,headshots:0};
    this.enemies=this.map.spawns.flatMap((list,room)=>list.map(spawn=>({...spawn,id:++this.nextId,room,y:spawn.type==='drone'?2.5:0,hp:this.data.enemies[spawn.type].hp,
      dead:false,phase:'patrol',yaw:0,alertAt:null,nextAttack:0,stunUntil:0,burstLeft:0,telegraph:null,path:[],pathUntil:0,spawnX:spawn.x,spawnZ:spawn.z})));
    this.total=this.enemies.length;this.emit('level_start',{index});
  }
  resume(){if(this.state==='ready'||this.state==='paused'){this.state='playing';this.p.ads=false;this.emit('resume');}}
  pause(){if(this.state==='playing'){this.state='paused';this.p.ads=false;this.p.sprinting=false;this.emit('pause');}}
  look(dx,dy,sensitivity){if(this.state!=='playing')return;const multiplier=this.p.ads?.65:1;this.p.yaw-=dx*.00115*sensitivity*multiplier;this.p.pitch=clamp(this.p.pitch-dy*.00115*sensitivity*multiplier,-1.35,1.35);}
  select(index){if(index<0||index>=this.available||index===this.p.weapon)return;this.p.weapon=index;this.p.reload=null;this.p.burst=0;this.p.recoil=0;this.p.kick=0;this.p.pump=0;this.p.ads=false;this.p.nextShot=Math.max(this.p.nextShot,this.time+.18);this.emit('switch',{weapon:index});}
  weapon(){return this.data.weapons[weaponIds[this.p.weapon]];}
  reload(){const a=this.p.ammo[this.p.weapon];if(this.state!=='playing'||this.p.reload||!a.reserve||a.mag===this.weapon().magazine_size)return;this.p.ads=false;this.p.reload={start:this.time,end:this.time+this.weapon().reload_time_sec,weapon:this.p.weapon};this.emit('reload',{weapon:this.p.weapon});}
  eye(){return {x:this.p.x,y:this.p.y+1.65,z:this.p.z};}
  enemyBoxes(e){const drone=e.type==='drone',elite=e.type==='elite',w=elite?.55:.36;return [
    {enemy:e,head:false,min:{x:e.x-w,y:e.y+(drone?-.25:.35),z:e.z-w},max:{x:e.x+w,y:e.y+(drone?.24:1.45),z:e.z+w}},
    {enemy:e,head:true,min:{x:e.x-.28,y:e.y+(drone?-.12:1.48),z:e.z-.28},max:{x:e.x+.28,y:e.y+(drone?.17:1.96),z:e.z+.28}}
  ];}
  trace(origin,dir,max=100,includeEnemies=true){
    let best=null,limit=max;
    for(const box of this.solids){if(box.open)continue;const t=rayBox(origin,dir,box,limit);if(t!==null&&t<limit){limit=t;best={distance:t,box};}}
    if(includeEnemies)for(const e of this.enemies){if(e.dead||e.room!==this.room)continue;for(const box of this.enemyBoxes(e)){const t=rayBox(origin,dir,box,limit);if(t!==null&&t<limit){limit=t;best={distance:t,box,enemy:e,head:box.head};}}}
    return {...best,distance:limit,point:{x:origin.x+dir.x*limit,y:origin.y+dir.y*limit,z:origin.z+dir.z*limit}};
  }
  shoot(){
    const p=this.p,w=this.weapon(),a=p.ammo[p.weapon];if(this.state!=='playing')return false;
    if(p.reload){p.reload=null;this.emit('reload_cancel');}
    if(this.time<p.nextShot)return false;
    if(!a.mag){p.nextShot=this.time+.25;this.emit('empty');return false;}
    if(this.time-p.lastShot>.2)p.burst=0;
    const shotDirection=direction(p.yaw,p.pitch+p.recoil),origin=this.eye(),pellets=w.pellet_count||1;
    let hit=false,headshot=false;const impacts=[];
    const spread=p.weapon===1?(p.burst<w.recoil.controlled_shots?.12:w.recoil.spread_max_deg):w.recoil.spread_deg;
    for(let i=0;i<pellets;i++){
      const radius=Math.sqrt(this.random())*Math.tan(rad(spread))*(p.ads?w.ads.spread_multiplier:1),angle=this.random()*Math.PI*2;
      const right={x:Math.cos(p.yaw),y:0,z:-Math.sin(p.yaw)},up={x:Math.sin(p.yaw)*Math.sin(p.pitch+p.recoil),y:Math.cos(p.pitch+p.recoil),z:Math.cos(p.yaw)*Math.sin(p.pitch+p.recoil)};
      const dir={x:shotDirection.x+right.x*Math.cos(angle)*radius+up.x*Math.sin(angle)*radius,y:shotDirection.y+up.y*Math.sin(angle)*radius,z:shotDirection.z+right.z*Math.cos(angle)*radius+up.z*Math.sin(angle)*radius};
      const n=Math.hypot(dir.x,dir.y,dir.z);for(const k of ['x','y','z'])dir[k]/=n;
      const h=this.trace(origin,dir);impacts.push({point:h.point,hit:!!h.enemy});
      if(h.enemy&&!h.enemy.dead){hit=true;headshot ||= h.head;const damage=damageAt(w,h.distance,h.head),e=h.enemy;e.hp=Math.max(0,e.hp-damage);e.stunUntil=this.time+this.data.enemies[e.type].hitstun_sec;e.phase='alert';e.alertAt=this.time;e.burstLeft=0;e.telegraph=null;e.nextAttack=Math.max(e.nextAttack,e.stunUntil+.2);this.emit('hit',{id:e.id,damage,head:h.head,point:h.point});if(e.hp<=0){e.dead=true;this.stats.kills++;this.emit('kill',{id:e.id,point:{x:e.x,y:e.y+1,z:e.z}});}}
    }
    a.mag--;p.shotSerial++;p.nextShot=this.time+1/w.fire_rate_per_sec;p.lastShot=this.time;p.burst++;p.kick=1;p.pump=p.weapon===2?1:0;
    p.recoil=clamp(p.recoil+rad(w.recoil.vertical_deg_per_shot),0,rad(p.weapon===1?5:3));
    this.stats.shots++;if(hit)this.stats.hits++;if(headshot)this.stats.headshots++;
    this.emit('shot',{weapon:p.weapon,origin,impacts,hit,headshot});return true;
  }
  move(body,dx,dz,r,feet=0){for(let i=0,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));i<steps;i++){if(canOccupy({x:body.x+dx/steps,z:body.z},r,this.solids,feet))body.x+=dx/steps;if(canOccupy({x:body.x,z:body.z+dz/steps},r,this.solids,feet))body.z+=dz/steps;}}
  navigate(e,target,speed,dt){
    const r=e.type==='elite'?.58:.4;let destination=target;
    if(!clearSegment(e,target,r,this.solids)){if(this.time>e.pathUntil||!e.path.length){e.path=route(e,target,r,this.solids);e.pathUntil=this.time+1;}while(e.path.length&&distance(e,e.path[0])<.14)e.path.shift();if(!e.path.length)return;destination=e.path[0];}else e.path=[];
    const d=distance(e,destination);if(d<.01)return;const step=Math.min(d,speed*dt);this.move(e,(destination.x-e.x)/d*step,(destination.z-e.z)/d*step,r);}
  see(e){const eye={x:e.x,y:e.y+(e.type==='drone'?0:1.5),z:e.z},target=this.eye(),dist=Math.hypot(target.x-eye.x,target.y-eye.y,target.z-eye.z),dir={x:(target.x-eye.x)/dist,y:(target.y-eye.y)/dist,z:(target.z-eye.z)/dist};return {eye,target,dist,visible:!this.trace(eye,dir,dist,false).box};}
  hurt(damage,from){if(this.state!=='playing')return;this.p.hp=Math.max(0,this.p.hp-damage);this.stats.taken++;this.emit('hurt',{from,damage});if(this.p.hp<=0){this.stats.deaths++;this.finish(false,'生命值归零');}}
  updateEnemy(e,dt){
    if(e.dead||e.room!==this.room||this.time<this.prepare||this.time<e.stunUntil)return;
    const cfg=this.data.enemies[e.type],sight=this.see(e),d=distance(e,this.p),angle=Math.atan2(this.p.x-e.x,this.p.z-e.z),diff=Math.atan2(Math.sin(angle-e.yaw),Math.cos(angle-e.yaw));
    if(e.phase==='patrol'){
      if(sight.visible&&sight.dist<cfg.perception.range_m&&Math.abs(diff)<=rad(cfg.perception.fov_deg/2)){e.phase='alert';e.alertAt=this.time+cfg.perception.reaction_sec;this.emit('alert',{id:e.id});}
      else {const target={x:e.spawnX+Math.sin(this.time*.6+e.id)*1.1,z:e.spawnZ};this.navigate(e,target,cfg.move_speed_mps*.4,dt);e.yaw=Math.sin(this.time*.4+e.id)*.6;return;}
    }
    e.yaw=angle;if(this.time<e.alertAt)return;e.phase='attack';
    if(e.type==='rusher'){if(d>cfg.attack.range_m||!sight.visible){e.phase='chase';this.navigate(e,this.p,cfg.move_speed_mps,dt);}else if(this.time>=e.nextAttack){this.hurt(cfg.attack.damage,{x:e.x,z:e.z});e.nextAttack=this.time+cfg.attack.interval_sec;}return;}
    if(!sight.visible||d>cfg.attack.range_m){e.phase='chase';this.navigate(e,this.p,cfg.move_speed_mps,dt);e.telegraph=null;return;}
    if(e.type==='drone'){const side=movement(-angle,Math.sin(this.time*.9+e.id)>0?1:-1,0);this.move(e,side.x*cfg.move_speed_mps*.45*dt,side.z*cfg.move_speed_mps*.45*dt,.4);e.y=2.5+Math.sin(this.time*1.3+e.id)*.22;}
    if(e.telegraph&&this.time>=e.telegraph.until){
      const from=sight.eye,to=e.telegraph.target,dir={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},len=Math.hypot(dir.x,dir.y,dir.z);for(const k of ['x','y','z'])dir[k]/=len;
      const block=this.trace(from,dir,len,false),p=this.p,body={min:{x:p.x-.33,y:p.y+.3,z:p.z-.33},max:{x:p.x+.33,y:p.y+1.9,z:p.z+.33}};
      if(rayBox(from,dir,body,block.distance)!==null)this.hurt(cfg.attack.damage,from);
      this.emit('enemy_shot',{from,to:block.point});e.telegraph=null;
      if(e.type==='elite'&&e.burstLeft>1){e.burstLeft--;e.nextAttack=this.time+.16;}else{e.burstLeft=0;e.nextAttack=this.time+cfg.attack.interval_sec;}
    }else if(!e.telegraph&&this.time>=e.nextAttack){if(!e.burstLeft)e.burstLeft=cfg.attack.burst_shots||1;e.telegraph={until:this.time+.24,target:{x:this.p.x,y:this.p.y+1.1,z:this.p.z}};}
  }
  step(dt,input={}){
    if(this.state!=='playing')return;dt=Math.min(dt,.05);this.time+=dt;this.stats.time=this.time;const p=this.p,w=this.weapon(),pc=this.data.player;
    p.ads=!!input.ads&&!p.reload;p.kick=Math.max(0,p.kick-dt*7);p.pump=Math.max(0,p.pump-dt*1.65);
    if(p.reload&&this.time>=p.reload.end){const a=p.ammo[p.reload.weapon],cfg=this.data.weapons[weaponIds[p.reload.weapon]];Object.assign(a,reloadAmmo(a.mag,a.reserve,cfg.magazine_size));p.reload=null;this.emit('reload_done');}
    if(this.time-p.lastShot>(p.weapon===1?.15:0))p.recoil=Math.max(0,p.recoil-dt*rad(w.recoil.vertical_deg_per_shot)*Math.max(1,p.burst)/w.recoil.recovery_sec);
    p.sprintCooldown=Math.max(0,p.sprintCooldown-dt);
    const moving=!!(input.forward||input.right),wantSprint=!!input.sprint&&moving&&!p.ads&&!p.reload&&p.sprintCooldown<=0;
    if(wantSprint&&p.sprintLeft>0){p.sprinting=true;p.sprintLeft-=dt;if(p.sprintLeft<=0){p.sprinting=false;p.sprintCooldown=pc.sprint.cooldown_sec;}}
    else {if(p.sprinting){p.sprintCooldown=pc.sprint.cooldown_sec;}p.sprinting=false;if(p.sprintCooldown===0)p.sprintLeft=pc.sprint.duration_sec;}
    if(input.jump&&p.y===0){p.vy=5.6;this.emit('jump');}
    p.vy-=16*dt;p.y=Math.max(0,p.y+p.vy*dt);if(p.y===0)p.vy=0;
    const v=movement(p.yaw,input.right||0,input.forward||0),speed=(p.sprinting?pc.sprint.speed_mps:pc.walk_speed_mps)*w.move_speed_multiplier*(p.ads?w.ads.move_speed_multiplier:1)*(p.y>0?pc.air_control_multiplier:1);
    this.move(p,v.x*speed*dt,v.z*speed*dt,.34,p.y);p.moving=moving;p.speed=moving?speed:0;
    if(input.pressed||(input.fire&&w.fire_mode==='full_auto'))this.shoot();
    for(const e of this.enemies){if(this.state!=='playing')break;this.updateEnemy(e,dt);}
    if(this.state!=='playing')return;
    for(const box of this.map.ammo)if(!box.used&&distance(p,box)<1.5){box.used=true;for(let i=0;i<this.available;i++){const max=this.data.weapons[weaponIds[i]].reserve_ammo;p.ammo[i].reserve=Math.min(max,p.ammo[i].reserve+Math.ceil(max*.6));}this.emit('pickup');}
    if(!this.enemies.some(e=>!e.dead&&e.room===this.room)&&!this.finishedRooms.has(this.room)){
      this.finishedRooms.add(this.room);const gate=this.map.gates[this.room];if(gate)gate.open=true;this.emit('area_clear',{room:this.room});
      if(this.stats.kills===this.total){if(this.level.requires_exterminate_first){if(!this.extractionUntil){this.extractionUntil=this.time+this.level.extraction_time_sec;for(const gate of this.map.gates)gate.open=true;this.emit('extraction');}}else this.finish(true);}
    }
    if(this.room<3&&this.finishedRooms.has(this.room)&&p.z<-(this.room*23)-18){this.room++;this.prepare=this.time+2.2;this.emit('area_enter',{room:this.room});}
    if(this.extractionUntil){if(distance(p,this.map.extract)<1.7)this.finish(true);else if(this.time>=this.extractionUntil)this.finish(false,'撤离超时');}
  }
  finish(success,reason=''){if(this.state==='result')return;this.state='result';this.p.ads=false;this.stats.time=this.time;this.result={success,reason,...scoreRun(this.level,this.data.levels.scoring,this.stats)};this.emit('result',this.result);}
}
