import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROWTH_STYLES, CONFIG } from '../dist/game/config.js';
import { appearanceFor, nextAppearance, unlockedAppearances } from '../dist/game/rules.js';
import { Renderer } from '../dist/game/renderer.js';
import { Simulation, makeSnake } from '../dist/game/simulation.js';

function drawing(level, player=true, treasure=false) {
  const commands=[], target={};
  const ctx=new Proxy(target,{
    get(object,key){if(key in object)return object[key]; if(key==='createLinearGradient')return (...args)=>{commands.push([key,...args]);return {addColorStop:(...values)=>commands.push(['colorStop',...values])};}; return (...args)=>commands.push([key,...args]);},
    set(object,key,value){object[key]=value;commands.push([key,typeof value==='object'?'gradient':value]);return true;},
  });
  const s=makeSnake(800,800,0,level,'preview',[CONFIG.playerColor,CONFIG.playerDark]); s.treasure=treasure;
  const r=Object.create(Renderer.prototype); Object.assign(r,{ctx,clock:0,width:400,height:240,scale:.72,camera:{x:800,y:800},simulation:{player:player?s:{level:1},state:'paused',protection:0}});
  return {r,s,commands};
}
test('23 ordered transformations cover every boundary through level 100',()=>{
  assert.deepEqual(GROWTH_STYLES.map(s=>s.level),[1,3,5,8,...Array.from({length:19},(_,i)=>10+i*5)]);
  assert.equal(new Set(GROWTH_STYLES.map(s=>s.id)).size,23);
  for(let i=0;i<GROWTH_STYLES.length;i++) {
    const style=GROWTH_STYLES[i]; assert.equal(appearanceFor(style.level),style);
    if(i){assert.equal(appearanceFor(style.level-1),GROWTH_STYLES[i-1]);assert.deepEqual(unlockedAppearances(style.level-1,style.level),[style]);}
    assert.equal(nextAppearance(style.level),GROWTH_STYLES[i+1]??null);
  }
  assert.equal(appearanceFor(150).id,'legend'); assert.equal(nextAppearance(100),null);
});
test('a large reward unlocking many stages announces the final stage once and retains XP',()=>{
  const sim=new Simulation(()=>.5); sim.start();
  sim.reward(99*103+2,800,800);
  assert.equal(sim.player.level,100); assert.equal(sim.player.xp,2);
  const events=sim.events.filter(e=>e.type==='level');assert.equal(events.length,1);assert.equal(events[0].style.id,'legend'); assert.equal(events[0].unlocked.length,22);
  assert.equal(sim.player.body.length,40); assert.ok(sim.particles.length<=220); assert.equal(sim.popups.filter(p=>p.large).length,1);
});
test('every stage produces a distinct drawing without changing the snake or accumulating effects',()=>{
  const fingerprints=[];
  for(const style of GROWTH_STYLES) {
    const {r,s,commands}=drawing(style.level), before=JSON.stringify(s);
    r.drawSnake(s,true); assert.equal(JSON.stringify(s),before); assert.ok(commands.length<2500);
    fingerprints.push(JSON.stringify(commands));
    assert.ok(commands.some(row=>row[0]==='ellipse')); // All stages retain the snake face/body.
  }
  assert.equal(new Set(fingerprints).size,23);
});
test('high-level enemies and treasure never receive player transformations',()=>{
  for(const treasure of [false,true]) {
    const {r,s}=drawing(100,false,treasure);let patterns=0,accessories=0;
    r.drawBodyPattern=()=>patterns++;r.drawAccessory=()=>accessories++;
    r.drawSnake(s,false); assert.equal(patterns,0); assert.equal(accessories,0);
  }
});
test('every next-appearance icon exists in the game markup',()=>{
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  for(const style of GROWTH_STYLES) assert.ok(html.includes('id="'+style.icon+'"'),style.id);
  assert.ok(html.includes('Lv.100 王さま'));
});
test('the long final transformation announcement stays readable inside a narrow field',()=>{
  const {r,s}=drawing(100), text=[];
  s.x=20; s.y=20;
  r.width=308;r.height=561;r.dpr=2;r.decorations=[];
  r.ctx.measureText=value=>({width:[...value].length*parseFloat(r.ctx.font.split(' ')[1])});
  r.ctx.strokeText=(value,x,y)=>text.push({value,x,y,font:r.ctx.font,width:r.ctx.measureText(value).width});
  Object.assign(r.simulation,{player:s,state:'playing',enemies:[],food:[],flowers:[],particles:[],treasure:null,popups:[{text:'にじの王さまに へんしん！',x:20,y:-55,life:1.8,large:true}]});
  r.draw(.016);
  assert.equal(text.length,1); assert.ok(parseFloat(text[0].font.split(' ')[1])>=14);
  assert.ok(text[0].x-text[0].width/2>=9.9);assert.ok(text[0].x+text[0].width/2<=298.1);assert.ok(text[0].y>=32);
});
