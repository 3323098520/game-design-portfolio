export class AudioBus {
  constructor(settings){this.settings=settings;this.buffers=[];this.nextStep=0;this.nextBeat=0;this.beat=0;this.voices=new Set();}
  async unlock(){
    if(!this.context){
      this.context=new AudioContext();this.master=this.context.createGain();this.effects=this.context.createGain();this.music=this.context.createGain();
      const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=12;compressor.ratio.value=5;compressor.attack.value=.002;compressor.release.value=.12;
      this.effects.connect(compressor);this.music.connect(compressor);compressor.connect(this.master);this.master.connect(this.context.destination);this.apply();
      this.loading=Promise.all(['pistol','rifle','shotgun'].map(async(name,i)=>{try{const r=await fetch(new URL(`../assets/audio/${name}.wav`,import.meta.url));if(!r.ok)throw Error(r.status);this.buffers[i]=await this.context.decodeAudioData(await r.arrayBuffer());}catch{this.buffers[i]=null;}}));
    }
    await this.context.resume();return this.loading;
  }
  apply(){if(!this.context)return;this.master.gain.value=this.settings.master;this.effects.gain.value=this.settings.effects;this.music.gain.value=this.settings.music;}
  tone(freq,duration,volume=.04,type='sine',bus=this.effects,end=freq){if(!this.context||this.context.state!=='running')return;const now=this.context.currentTime,osc=this.context.createOscillator(),gain=this.context.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,now);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+duration);gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain).connect(bus);osc.start();osc.stop(now+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
  noise(duration,volume,cutoff=1800){if(!this.context||this.context.state!=='running')return;const ctx=this.context,buf=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buf.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3);const source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();source.buffer=buf;filter.type='lowpass';filter.frequency.value=cutoff;gain.gain.value=volume;source.connect(filter).connect(gain).connect(this.effects);source.start();source.onended=()=>{source.disconnect();gain.disconnect();filter.disconnect();};}
  shot(index){
    if(!this.context||this.context.state!=='running')return;
    const buffer=this.buffers[index];if(buffer){const source=this.context.createBufferSource(),gain=this.context.createGain(),filter=this.context.createBiquadFilter();source.buffer=buffer;source.playbackRate.value=[1,.98,.91][index];gain.gain.value=[.27,.20,.36][index];filter.type='lowpass';filter.frequency.value=[6500,5500,4500][index];source.connect(filter).connect(gain).connect(this.effects);source.start();this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();filter.disconnect();};if(this.voices.size>12){const oldest=this.voices.values().next().value;oldest.stop();this.voices.delete(oldest);}}
    else this.noise([.09,.07,.18][index],[.20,.17,.29][index],index===2?2000:5500);
    this.tone([115,90,65][index],index===2?.17:.07,index===2?.09:.03,'sine',this.effects,40);
  }
  event(e){if(e.type==='shot')this.shot(e.weapon);else if(e.type==='hit'){this.tone(e.head?1100:780,.04,.022,'triangle');}else if(e.type==='kill'){this.tone(520,.11,.04,'sine',this.effects,950);}else if(e.type==='reload'||e.type==='reload_done'||e.type==='switch'){this.noise(.07,.055,3200);this.tone(180,.045,.025,'triangle');}else if(e.type==='hurt'){this.noise(.1,.10,550);this.tone(110,.12,.045,'sine',this.effects,55);}else if(e.type==='enemy_shot')this.noise(.065,.045,2800);else if(e.type==='empty')this.noise(.025,.035,4000);else if(e.type==='pickup'||e.type==='area_clear'){this.tone(440,.18,.035,'sine',this.effects,660);}}
  tick(game){if(!this.context||game.state!=='playing')return;if(game.p.weapon===2&&game.p.pump>0&&game.time-game.p.lastShot>.2&&this.pumpShot!==game.p.shotSerial){this.pumpShot=game.p.shotSerial;this.noise(.12,.06,2300);this.tone(170,.07,.018,'triangle');}if(game.p.moving&&game.p.y===0&&game.time>=this.nextStep){this.nextStep=game.time+(game.p.sprinting?.29:.43);this.noise(.075,.037,850);}if(game.time>=this.nextBeat){this.nextBeat=game.time+.5;const notes=[110,0,165,0,130.81,0,146.83,0];if(notes[this.beat%8])this.tone(notes[this.beat%8],.35,.045,'triangle',this.music);this.beat++;}}
  pause(){for(const voice of this.voices)try{voice.stop();}catch{}this.voices.clear();this.context?.suspend();}
  reset(){this.nextStep=0;this.nextBeat=0;this.beat=0;this.pumpShot=-1;}
}
