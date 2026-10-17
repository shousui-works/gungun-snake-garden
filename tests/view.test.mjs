import test from 'node:test';
import assert from 'node:assert/strict';
import { viewModeFor, viewScaleFor } from '../dist/game/view.js';
import { Renderer } from '../dist/game/renderer.js';
import { InputController } from '../dist/game/input.js';

class ViewCanvas extends EventTarget {
  constructor(width=378,height=832) { super(); this.rect={width,height,left:10,top:20}; this.captures=new Set(); }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}
function layout() {
  globalThis.window=new EventTarget(); window.devicePixelRatio=3;
  const canvas=new ViewCanvas(), simulation={state:'playing',player:{x:420,y:320,radius:13.8,level:2,xp:3},time:12,flowers:[{x:2,y:3}]};
  const renderer=Object.create(Renderer.prototype); Object.assign(renderer,{canvas,simulation,viewMode:'wide',camera:{x:400,y:300}}); renderer.resize();
  return {canvas,simulation,renderer};
}
test('narrow portrait and landscape screens both gain space without a breakpoint jump',()=>{
  for(const [width,height] of [[308,561],[378,837],[828,374]]) {
    const wide=viewScaleFor(width,height), large=viewScaleFor(width,height,'large');
    assert.ok(wide<1.08); assert.ok(width/wide>width/1.08); assert.ok(height/wide>height/1.08); assert.ok(large>wide);
    assert.equal(wide,viewScaleFor(height,width));
  }
  assert.ok(Math.abs(viewScaleFor(649,500)-viewScaleFor(650,500))<.01);
  assert.equal(viewScaleFor(1280,720),1.12);
});
test('zoom keeps tiny-screen sprites readable and caps magnification on large screens',()=>{
  for(const [width,height] of [[200,300],[308,561],[378,837],[828,374],[1640,1330]]) for(const mode of ['wide','large']) {
    const scale=viewScaleFor(width,height,mode); assert.ok(scale>=.72 && scale<=1.5); assert.ok(13.8*2*scale>=19.8);
  }
  for(const value of [null,undefined,'invalid','__proto__']) assert.equal(viewModeFor(value),'wide');
});
test('resize and view changes update the real visible area, retain gameplay, and cap pixel density',()=>{
  const {canvas,simulation,renderer}=layout(), before={player:{...simulation.player},time:simulation.time,flowers:simulation.flowers};
  assert.equal(renderer.dpr,2); assert.equal(canvas.width,756);
  const initial=simulation.viewport.width; renderer.setViewMode('large'); assert.ok(simulation.viewport.width<initial);
  canvas.rect={...canvas.rect,width:828,height:374}; renderer.resize();
  assert.equal(simulation.viewport.width,828/renderer.scale); assert.equal(simulation.viewport.height,374/renderer.scale);
  assert.deepEqual(simulation.player,before.player); assert.equal(simulation.time,before.time); assert.equal(simulation.flowers,before.flowers); assert.equal(simulation.state,'playing');
  renderer.setViewMode('invalid'); assert.equal(renderer.viewMode,'wide'); delete globalThis.window;
});
test('the spawn viewport follows the actual camera near walls, after resize and after restarting',()=>{
  const {canvas,simulation,renderer}=layout();
  renderer.ctx=paintContext().ctx;renderer.clock=0;renderer.decorations=[];
  renderer.drawSnake=()=>{};renderer.drawGrowthLabel=()=>{};
  Object.assign(simulation,{enemies:[],food:[],flowers:[],particles:[],popups:[],treasure:null});
  simulation.player.x=30;simulation.player.y=30;
  renderer.draw(.05);
  assert.equal(simulation.viewport.x,renderer.camera.x);assert.equal(simulation.viewport.y,renderer.camera.y);
  assert.notEqual(simulation.viewport.x,simulation.player.x);
  assert.notEqual(simulation.viewport.y,simulation.player.y);
  canvas.rect={...canvas.rect,width:828,height:374};renderer.setViewMode('large');
  assert.equal(simulation.viewport.width,828/renderer.scale);assert.equal(simulation.viewport.x,renderer.camera.x);
  simulation.player.x=800;simulation.player.y=800;renderer.resetCamera();
  assert.equal(simulation.viewport.x,800);assert.equal(simulation.viewport.y,800);
  delete globalThis.window;
});
function paintContext() {
  const text=[], cards=[], transforms=[];
  const target={measureText:s=>({width:s.length*6}),fillText(value,x,y){text.push({value,x,y,font:this.font});},roundRect(x,y,w,h){cards.push({x,y,w,h});},setTransform(...args){transforms.push(args);}};
  return {ctx:new Proxy(target,{get:(object,key)=>key in object?object[key]:()=>{}}),text,cards,transforms};
}
test('growth card and enemy labels keep their text size when sprites zoom, including near controls',()=>{
  for(const scale of [.72,1.5]) {
    const {ctx,text,cards,transforms}=paintContext(), r=Object.create(Renderer.prototype);
    Object.assign(r,{ctx,width:378,height:832,scale,dpr:2,camera:{x:800,y:800},simulation:{player:{level:2}}});
    const player={x:800+(374-189)/scale,y:800+(10-416)/scale,radius:14,level:2,xp:3};
    r.drawGrowthLabel(player);
    assert.match(text[0].font,/11px/); assert.match(text[1].font,/10px/); assert.equal(cards[0].h,40);
    assert.ok(cards[0].x>=6 && cards[0].x+cards[0].w<=372); assert.ok(cards[0].y>=72 && cards[0].y+40<=826);
    r.drawLabel({...player,level:3}); assert.match(text.find(row=>row.value==='Lv.3').font,/11px/);
    assert.ok(transforms.every(args=>JSON.stringify(args)===JSON.stringify([2,0,0,2,0,0])));
  }
});
test('enemy body symbols remain readable at both zoom settings',()=>{
  for(const scale of [.72,1.5]) {
    const {ctx,text}=paintContext(), r=Object.create(Renderer.prototype);
    Object.assign(r,{ctx,width:378,height:832,scale,camera:{x:800,y:800},simulation:{player:{level:1}}});
    r.drawEnemyBodyMarkers({level:3,radius:15,body:[{x:800,y:800},{x:820,y:800},{x:850,y:800}]});
    assert.equal(text.length,1); assert.equal(text[0].value,'!'); assert.ok(parseFloat(text[0].font.split(' ')[1])*scale>=10);
  }
});
test('taps use the new projected head after zoom or rotation',()=>{
  const {canvas,simulation,renderer}=layout();
  const input=new InputController(canvas,simulation,()=>{},()=>renderer.screenPosition(simulation.player));
  for(const [mode,width,height] of [['wide',378,832],['large',378,832],['wide',828,374]]) {
    canvas.rect={...canvas.rect,width,height}; renderer.setViewMode(mode);
    const head=renderer.screenPosition(simulation.player);
    for(const [dx,dy,angle] of [[60,0,0],[0,60,Math.PI/2],[-60,0,Math.PI],[0,-60,-Math.PI/2]]) {
      const down=new Event('pointerdown',{cancelable:true}); Object.assign(down,{pointerId:1,button:0,clientX:10+head.x+dx,clientY:20+head.y+dy});canvas.dispatchEvent(down);
      const up=new Event('pointerup');Object.assign(up,{pointerId:1});canvas.dispatchEvent(up); assert.equal(input.getAngle(),angle);
    }
  }
  input.destroy(); delete globalThis.window;
});
