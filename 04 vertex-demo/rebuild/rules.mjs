export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const rad=d=>d*Math.PI/180;
export const verticalFov=(horizontal,aspect)=>2*Math.atan(Math.tan(rad(horizontal)/2)/aspect)*180/Math.PI;
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const weaponIds=['pistol','assault_rifle','shotgun'];
export function movement(yaw,right,forward){const n=Math.hypot(right,forward)||1;return {x:(Math.cos(yaw)*right-Math.sin(yaw)*forward)/n,z:(-Math.sin(yaw)*right-Math.cos(yaw)*forward)/n};}
export function direction(yaw,pitch){return {x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};}
export function scoreRun(level,scoring,stats){
  const accuracy=stats.shots?clamp(stats.hits/stats.shots,0,1):0;
  const time=clamp(100-(stats.time-level.par_time_sec)*scoring.time_penalty_per_sec,0,100);
  const survival=clamp(100-stats.taken*scoring.hits_taken_penalty-(stats.deaths||0)*scoring.death_penalty,0,100);
  const weights=scoring.goal_overrides[level.goal]||scoring.weights;
  const total=time*weights.time+accuracy*100*weights.accuracy+survival*weights.survival;
  return {total:Math.round(total*10)/10,time,accuracy:accuracy*100,survival,weights,grade:total>=scoring.grades.S?'S':total>=scoring.grades.A?'A':total>=scoring.grades.B?'B':'C'};
}
export function damageAt(weapon,range,head=false){const f=weapon.falloff,m=f?1-clamp((range-f.full_damage_until_m)/(f.min_damage_at_m-f.full_damage_until_m),0,1)*(1-f.min_multiplier):1;return weapon.damage*m*(head?weapon.headshot_multiplier:1);}
export function reloadAmmo(mag,reserve,size){const amount=Math.min(size-mag,reserve);return {mag:mag+amount,reserve:reserve-amount};}
export function rayBox(origin,dir,box,limit=120){let near=0,far=limit;for(const k of ['x','y','z']){if(Math.abs(dir[k])<1e-8){if(origin[k]<box.min[k]||origin[k]>box.max[k])return null;continue}let a=(box.min[k]-origin[k])/dir[k],b=(box.max[k]-origin[k])/dir[k];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null}return near;}
export function solid(x,z,w,h,d,kind='cover'){return {x,z,w,h,d,kind,min:{x:x-w/2,y:0,z:z-d/2},max:{x:x+w/2,y:h,z:z+d/2}};}
export const waves=[
  [['patrol','patrol','patrol'],Array(4).fill('patrol'),Array(3).fill('patrol'),Array(3).fill('patrol')],
  [Array(3).fill('patrol'),['rusher','rusher'],Array(4).fill('patrol'),['rusher','rusher','patrol']],
  [['patrol','patrol','drone'],['patrol','patrol','patrol','drone','drone'],['drone','drone','patrol','patrol'],['patrol','patrol','patrol','drone','drone']],
  [['rusher','rusher'],['rusher','rusher','rusher','patrol','patrol'],['drone','drone','rusher','rusher'],['rusher','rusher','rusher','patrol','patrol']],
  [Array(4).fill('patrol'),['elite','elite','patrol','patrol'],['rusher','rusher','rusher','drone','drone'],[]]
];
export function layout(index){
  const boxes=[solid(-10.6,-35,1.2,4.5,104,'wall'),solid(10.6,-35,1.2,4.5,104,'wall'),solid(0,16,22,4.5,1,'wall'),solid(0,-87,22,4.5,1,'wall')];
  const gates=[];
  for(let room=0;room<4;room++){
    const z=-room*23;
    boxes.push(solid(-4.9,z-1,3.4,1.25,1.5),solid(4.9,z-5,3.4,1.85,1.5),solid(-3,z+4,1.2,2.7,5,'divider'));
    if(index>=2)boxes.push(solid(3,z+2,2,1.05,1.2));
    if(room<3){const gz=z-17;boxes.push(solid(-6.8,gz,6.4,4,1,'wall'),solid(6.8,gz,6.4,4,1,'wall'));gates.push({...solid(0,gz,7.2,3.7,.5,'gate'),room,open:false});}
  }
  const spawns=waves[index].map((types,room)=>types.map((type,i)=>({type,x:[-6.5,5.7,0,-2.5,3.3][i],z:-room*23-9-(i%2)*2})));
  return {boxes,gates,spawns,extract:{x:0,z:-82},ammo:Array.from({length:index<2?1:2},(_,i)=>({x:i%2?-7.8:7.8,z:-23*(i+1)+5,used:false}))};
}
export function canOccupy(pos,r,boxes,feet=0){if(pos.x-r<-10||pos.x+r>10||pos.z-r<-86.4||pos.z+r>15.4)return false;return !boxes.some(b=>!b.open&&feet<b.h&&pos.x+r>b.min.x&&pos.x-r<b.max.x&&pos.z+r>b.min.z&&pos.z-r<b.max.z);}
export function clearSegment(a,b,r,boxes){const steps=Math.max(1,Math.ceil(distance(a,b)/.3));for(let i=0;i<=steps;i++){const t=i/steps;if(!canOccupy({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},r,boxes))return false;}return true;}
export function route(from,to,r,boxes){
  const nearest=(p,connect)=>{const choices=[];for(let x=Math.round(p.x)-1;x<=Math.round(p.x)+1;x++)for(let z=Math.round(p.z)-1;z<=Math.round(p.z)+1;z++){const q={x,z};if(canOccupy(q,r,boxes)&&(!connect||clearSegment(p,q,r,boxes)))choices.push(q)}return choices.sort((a,b)=>distance(a,p)-distance(b,p))[0]};
  const start=nearest(from,true),end=nearest(to,false);if(!start||!end)return [];
  const key=p=>`${p.x},${p.z}`,queue=[start],previous=new Map([[key(start),null]]),nodes=new Map([[key(start),start]]);
  for(let i=0;i<queue.length;i++){const p=queue[i],k=key(p);if(k===key(end)){const path=[];for(let at=k;at!==null;at=previous.get(at))path.push(nodes.get(at));return path.reverse()}
    for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1]]){const q={x:p.x+x,z:p.z+z},qk=key(q);if(previous.has(qk)||!clearSegment(p,q,r,boxes))continue;previous.set(qk,k);nodes.set(qk,q);queue.push(q);}
  }return [];
}
export function emptySave(){return {version:2,settings:{sensitivity:1,fov:95,master:.65,effects:.8,music:.15,highContrast:false,subtitles:true,crosshair:'cross'},levels:{},unlocked:0};}
