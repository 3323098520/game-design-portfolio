import {Game} from './game.mjs?v=20260906-1';
import {View} from './view.mjs?v=20260906-1';
import {AudioBus} from './audio.mjs?v=20260906-1';
import {emptySave,clamp} from './rules.mjs?v=20260906-1';

const $=id=>document.getElementById(id),show=(id,visible)=>$(id).classList.toggle('hidden',!visible),formatTime=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const storageKey='vertex-gdd-rebuild-v2';let save=emptySave();
try{const stored=JSON.parse(localStorage.getItem(storageKey));if(stored?.version===2){save={...save,...stored,settings:{...save.settings,...stored.settings}};save.unlocked=clamp(Number(save.unlocked)||0,0,4);}}
catch{}
for(const [key,min,max] of [['sensitivity',.2,2],['fov',70,110],['master',0,1],['effects',0,1],['music',0,1]])save.settings[key]=clamp(Number.isFinite(Number(save.settings[key]))?Number(save.settings[key]):emptySave().settings[key],min,max);
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(save));}catch{notify('浏览器未允许保存，成绩仅本次有效',3);}}
let game,view,audio,last=performance.now(),accumulator=0,settingsReturn='menu',hitUntil=0,hurtUntil=0,toastUntil=0,subtitleUntil=0,windowMode=false;
const keys=new Set(),input={fire:false,pressed:false,ads:false,jump:false};
function clearInput(){keys.clear();Object.assign(input,{fire:false,pressed:false,ads:false,jump:false});}
function notify(text,seconds=2.4){$('toast').textContent=text;show('toast',true);toastUntil=(game?.time||0)+seconds;}
function subtitle(text,seconds=6){$('subtitle').textContent=text;show('subtitle',save.settings.subtitles);subtitleUntil=game.time+seconds;}
function refreshLevels(){
  $('levels').replaceChildren();game.data.levels.levels.forEach((level,i)=>{const button=document.createElement('button'),record=save.levels[level.id];button.className='level-card';button.disabled=i>save.unlocked;
    const id=document.createElement('b'),name=document.createElement('strong'),best=document.createElement('small');id.textContent=level.id;name.textContent=level.name;best.textContent=i>save.unlocked?'待解锁':record?`${record.grade} · ${record.best_score.toFixed(1)}`:'尚未挑战';button.append(id,name,best);button.onclick=()=>start(i);$('levels').append(button);});
  $('continue').innerHTML=save.unlocked===0?'开始训练 <span>→</span>':'继续认证 <span>→</span>';
}
function settingsUI(){for(const name of ['sensitivity','fov','master','effects','music']){$(name).value=save.settings[name];$(`${name}-value`).textContent=name==='sensitivity'?Number(save.settings[name]).toFixed(3):name==='fov'?`${save.settings[name]}°`:`${Math.round(save.settings[name]*100)}%`;}for(const name of ['highContrast','subtitles'])$(name).checked=!!save.settings[name];$('crosshair').value=save.settings.crosshair;document.body.classList.toggle('high-contrast',save.settings.highContrast);$('reticle').classList.toggle('dot',save.settings.crosshair==='dot');audio?.apply();}
function openSettings(from){settingsReturn=from;if(game.state==='playing')pause();show(from,false);show('settings',true);settingsUI();}
function pause(message='训练已暂停，计时和敌人行动都已停止。'){
  if(!game||game.state==='menu'||game.state==='result')return;game.pause();clearInput();audio.pause();document.exitPointerLock?.();show('hud',false);show('pause',true);$('pause-message').textContent=message;
}
function capture(){
  windowMode=false;clearInput();show('pause',true);$('pause-message').textContent='正在接管鼠标；按 Esc 可随时暂停。';
  audio.unlock().then(()=>{if(game.state!=='playing')audio.pause();}).catch(()=>notify('音频暂不可用，可继续无声训练'));
  try{if(!$('viewport').requestPointerLock)throw Error('unsupported');const request=$('viewport').requestPointerLock();request?.catch(()=>pause('鼠标锁定未成功。请用电脑 Chrome 或 Edge 打开，点击继续训练。'));}
  catch{pause('当前浏览器不支持鼠标锁定。请用电脑 Chrome 或 Edge 打开此页面。');}
}
function start(index){
  if(index>save.unlocked)return;clearInput();game.start(index);view.build(game);audio.reset();hitUntil=hurtUntil=0;show('menu',false);show('result',false);show('settings',false);show('toast',false);show('subtitle',false);$('damage-numbers').replaceChildren();$('hitmark').style.opacity=0;$('damage-vignette').classList.remove('active');capture();
}
function menu(){game.state='menu';clearInput();audio.pause();document.exitPointerLock?.();for(const id of ['hud','pause','settings','result','subtitle','toast'])show(id,false);show('menu',true);refreshLevels();}
function finish(){
  clearInput();document.exitPointerLock?.();audio.pause();show('hud',false);show('pause',false);show('subtitle',false);show('toast',false);show('result',true);
  const r=game.result,s=game.stats,id=game.level.id,old=save.levels[id];let record=false;
  if(r.success){record=!old||r.total>old.best_score;save.levels[id]={best_score:Math.max(old?.best_score||0,r.total),grade:record?r.grade:old.grade,best_time:Math.min(old?.best_time??Infinity,s.time),best_accuracy:Math.max(old?.best_accuracy||0,r.accuracy),best_hits_taken:Math.min(old?.best_hits_taken??Infinity,s.taken),attempts:(old?.attempts||0)+1};save.unlocked=Math.max(save.unlocked,Math.min(4,game.index+1));persist();}
  $('result-label').textContent=r.success?'CERTIFICATION COMPLETE':'TRAINING ENDED';$('result-title').textContent=r.success?`${game.level.name} · 认证完成`:r.reason;
  $('grade').textContent=r.success?r.grade:'—';$('score').textContent=r.success?`${r.total.toFixed(1)} / 100`:'再试一次';$('record').textContent=r.success?(record?'新的个人最好成绩':`个人最佳 ${old.best_score.toFixed(1)} 分`):'本次未通关，不写入最佳成绩';
  $('score-parts').innerHTML=[['时间',r.time,r.weights.time],['命中',r.accuracy,r.weights.accuracy],['生存',r.survival,r.weights.survival]].map(([label,value,weight])=>`<div class="score-part"><span>${label} ${Math.round(weight*100)}%</span><div class="track"><div class="fill" style="width:${value}%"></div></div><span>${value.toFixed(1)}</span></div>`).join('');
  $('result-details').textContent=`${formatTime(s.time)} · 命中 ${r.accuracy.toFixed(1)}% · 受击 ${s.taken} 次 · 清除 ${s.kills}/${game.total}`;
  show('next-level',r.success&&game.index<4);
}
function events(){
  for(const e of game.events.splice(0)){
    view.event(e,game);audio.event(e);
    if(e.type==='resume'){show('pause',false);show('hud',true);if(game.time<.1)subtitle(['WASD 移动；左键点射；R 换弹。先清除前厅目标。','突击步枪已配发：按 2 切换，按住射击，松开恢复。','优先处理无人机。右键瞄准能提高精度。','霰弹枪已配发：按 3 切换，靠近突击机器人再开火。','打断精英扫射；清场后在 90 秒内抵达终点。'][game.index]);}
    if(e.type==='hit'){hitUntil=game.time+.12;$('hitmark').style.color=e.head?'#ef6548':'#ffbf51';const n=document.createElement('span');n.textContent=`${Math.round(e.damage)}${e.head?' · 爆头':''}`;$('damage-numbers').replaceChildren(n);}
    if(e.type==='hurt'){hurtUntil=game.time+.20;}
    if(e.type==='area_clear'&&game.stats.kills<game.total)notify('区域已清空，闸门开启');
    if(e.type==='area_enter')subtitle(`进入${game.level.sections[Math.min(game.room+1,game.level.sections.length-1)].area}，${Math.ceil(game.prepare-game.time)} 秒后目标开始行动。`,3);
    if(e.type==='pickup')notify('备弹已补充');if(e.type==='empty')notify(game.p.ammo[game.p.weapon].reserve?'弹匣已空，按 R 换弹':'备弹已耗尽，切枪或寻找橙色补给箱',1.6);
    if(e.type==='extraction')notify('认证目标已清除，90 秒内抵达绿色终点',5);
    if(e.type==='result')finish();
  }
}
function hud(){
  const p=game.p,w=game.weapon(),a=p.ammo[p.weapon];$('level-name').textContent=`${game.level.id} / ${game.level.name}`;$('objective').textContent=game.extractionUntil?`撤离剩余 ${Math.max(0,Math.ceil(game.extractionUntil-game.time))} 秒`:`清除目标 ${game.stats.kills} / ${game.total}`;
  $('stage').textContent=game.time<game.prepare?`准备 ${Math.ceil(game.prepare-game.time)} 秒`:`区域 ${Math.min(game.room+1,4)} / 4${game.finishedRooms.has(game.room)?' · 前往下一道闸门':''}`;
  $('timer').textContent=formatTime(game.time);$('par').textContent=`标准 ${formatTime(game.level.par_time_sec)}`;$('weapon-name').textContent=`0${p.weapon+1} / ${w.name}`;$('mag').textContent=a.mag;$('reserve').textContent=`/ ${a.reserve}`;
  $('weapon-hint').textContent=p.reload?'换弹中 · 切枪或射击可取消':p.ads?'瞄准 · 精度提升':`${['点按射击','按住连射','点按射击 · 泵动'][p.weapon]} · R 换弹`;
  $('health').textContent=Math.ceil(p.hp);$('health-fill').style.width=`${p.hp}%`;$('health-fill').style.background=p.hp<30?'#ef6548':'#f2f4f7';
  $('sprint-label').textContent=p.sprintCooldown>0?'冲刺冷却':p.sprinting?'冲刺中':'冲刺就绪';$('sprint-fill').style.width=`${p.sprintCooldown>0?(1-p.sprintCooldown/5)*100:p.sprintLeft/3*100}%`;
  $('reload-bar').firstElementChild.style.width=p.reload?`${clamp((game.time-p.reload.start)/(p.reload.end-p.reload.start),0,1)*100}%`:'0';
  $('reticle').style.setProperty('--gap',`${(p.ads?3:5)+p.recoil*100}px`);$('hitmark').style.opacity=game.time<hitUntil?1:0;$('damage-vignette').classList.toggle('active',game.time<hurtUntil);
  if(game.time>toastUntil)show('toast',false);if(game.time>subtitleUntil)show('subtitle',false);
}
function animate(now){
  requestAnimationFrame(animate);if(!game)return;const dt=Math.min(.15,Math.max(0,(now-last)/1000));last=now;
  if(game.state==='playing'){
    accumulator+=dt;while(accumulator>=1/120){game.step(1/120,{...input,forward:(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),right:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')});input.pressed=false;input.jump=false;accumulator-=1/120;events();if(game.state!=='playing'){accumulator=0;break;}}
    audio.tick(game);hud();
  }else {accumulator=0;events();}
  view.render(game,game.state==='playing'?dt:0,save.settings);
}
try{
  const names=['player','weapons','enemies','levels'];const entries=await Promise.all(names.map(async name=>{const r=await fetch(new URL(`../../01%20PORTFOLIO_VERTEX/data/${name}.json`,import.meta.url));if(!r.ok)throw Error(`${name}.json / ${r.status}`);return [name,await r.json()];}));
  game=new Game(Object.fromEntries(entries));game.start(0);game.state='menu';game.events=[];view=new View($('viewport'));view.build(game);audio=new AudioBus(save.settings);settingsUI();refreshLevels();show('loading',false);show('menu',true);requestAnimationFrame(animate);
}catch(error){$('load-message').textContent=`加载失败：${error.message}。请通过网站链接或本地服务器打开，不要直接双击 HTML。`;console.error(error);}

$('continue').onclick=()=>start(save.unlocked);$('resume').onclick=capture;$('open-settings').onclick=()=>openSettings('menu');$('pause-settings').onclick=()=>openSettings('pause');
$('window-mode').onclick=()=>{windowMode=true;clearInput();game.resume();audio.unlock();subtitle('窗口模式：按住右键拖动观察，左键射击。WASD 移动；Esc 暂停。',12);};
$('close-settings').onclick=()=>{persist();show('settings',false);show(settingsReturn,true);};$('retry-pause').onclick=()=>start(game.index);$('retry-result').onclick=()=>start(game.index);$('next-level').onclick=()=>start(game.index+1);$('return-menu').onclick=menu;$('result-menu').onclick=menu;
$('reset-settings').onclick=()=>{Object.assign(save.settings,emptySave().settings);settingsUI();};
for(const name of ['sensitivity','fov','master','effects','music'])$(name).oninput=()=>{save.settings[name]=Number($(name).value);settingsUI();};
for(const name of ['highContrast','subtitles'])$(name).onchange=()=>{save.settings[name]=$(name).checked;settingsUI();};$('crosshair').onchange=()=>{save.settings.crosshair=$('crosshair').value;settingsUI();};
document.addEventListener('pointerlockchange',()=>{if(!game)return;if(document.pointerLockElement===$('viewport')){windowMode=false;game.resume();clearInput();audio.unlock();}else if(game.state==='playing'&&!windowMode)pause();});
document.addEventListener('pointerlockerror',()=>pause('鼠标锁定未成功。请点击继续；如仍失败，请用电脑 Chrome 或 Edge 打开。'));
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===$('viewport')||(windowMode&&e.target===$('viewport')&&(e.buttons&3)))game.look(e.movementX,e.movementY,save.settings.sensitivity);});
document.addEventListener('mousedown',e=>{if(game?.state!=='playing'||(document.pointerLockElement!==$('viewport')&&!(windowMode&&e.target===$('viewport'))))return;if(e.button===0){input.fire=true;input.pressed=true;}if(e.button===2)input.ads=true;});
document.addEventListener('mouseup',e=>{if(e.button===0)input.fire=false;if(e.button===2)input.ads=false;});$('viewport').oncontextmenu=e=>e.preventDefault();
document.addEventListener('keydown',e=>{
  if(e.code==='Escape'){if(!$('settings').classList.contains('hidden')){$('close-settings').click();return;}if(game?.state==='playing')pause();return;}
  if(game?.state!=='playing')return;if(['Space','Tab','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;
  if(e.code==='Space')input.jump=true;if(e.code==='KeyR')game.reload();if(/^Digit[123]$/.test(e.code))game.select(Number(e.code.slice(-1))-1);
});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('resize',()=>view?.resize());
