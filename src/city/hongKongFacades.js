import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const palette = { stone: "#dfdfcf", trim: "#d4dfd5", glass: "#739b94", dark: "#4c766f", brick: "#ba8068", mortar: "#d5af90", roof: "#899489" };

// Three daytime batches, plus one optional batch of illuminated window panes.
function builder() {
  const parts = { solid: [], glass: [], metal: [], nightWindows: [] };
  let windowIndex=0;
  function add(geometry, color, kind = "solid") {
    let g = geometry;
    if (g.index) { g = geometry.toNonIndexed(); geometry.dispose(); }
    g.deleteAttribute("uv");
    const c = new THREE.Color(color), colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts[kind].push(g);
  }
  function box(position, size, color = palette.stone, kind = "solid", rotation = [0, 0, 0]) {
    const g = new THREE.BoxGeometry(...size);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    g.translate(...position);
    // Only thin glazing lights up. The structural glass hull stays dark.
    if(kind==="glass" && Math.min(...size)<=.03) {
      const n=windowIndex++;
      if((n*37+11)%13<8) {
        const axis=size.indexOf(Math.min(...size));
        for(const sign of [-1,1]) {
          const glow=new THREE.PlaneGeometry(axis===0?size[2]:size[0],axis===1?size[2]:size[1]);
          if(axis===0)glow.rotateY(Math.PI/2);else if(axis===1)glow.rotateX(Math.PI/2);
          const offset=[0,0,0];offset[axis]=sign*(size[axis]/2+.0006);glow.translate(...offset);
          glow.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));glow.translate(...position);
          add(glow,n%5===0?"#c3dbe3":n%3===0?"#e9bb75":"#f1d5a0","nightWindows");
        }
      }
    }
    add(g, color, kind);
  }
  function beam(a, b, radius, color = palette.trim, kind = "metal") {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
    const g = new THREE.CylinderGeometry(radius, radius, delta.length(), 5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    g.translate(...from.add(to).multiplyScalar(.5).toArray()); add(g, color, kind);
  }
  function prism(points, y, height, color = palette.glass, kind = "glass") {
    const shape = new THREE.Shape(points.map(([x,z]) => new THREE.Vector2(x,-z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI/2); g.translate(0,y,0); add(g,color,kind);
  }
  function finish() {
    return Object.fromEntries(Object.entries(parts).filter(([,p])=>p.length).map(([kind,p])=> {
      const geometry = mergeGeometries(p); p.forEach(g=>g.dispose());
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      return [kind, geometry];
    }));
  }
  return { add, box, beam, prism, finish };
}

function chamfered(width, depth, bevel=.065) {
  const x=width/2,z=depth/2,b=bevel;
  return [[-x+b,-z],[x-b,-z],[x,-z+b],[x,z-b],[x-b,z],[-x+b,z],[-x,z-b],[-x,-z+b]];
}

function curtainWall(b, polygon, bottom, height, floors, bays = 5) {
  b.prism(polygon,bottom,height);
  for(let edge=0;edge<polygon.length;edge++) {
    const a=polygon[edge],c=polygon[(edge+1)%polygon.length];
    const dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx);
    const columns=Math.max(1,Math.round(length/.5*bays));
    const normal=[dz/length,-dx/length];
    const at=(t,y,offset=.004)=>[a[0]+dx*t+normal[0]*offset,y,a[1]+dz*t+normal[1]*offset];
    for(let floor=0;floor<floors;floor++) {
      const y=bottom+(floor+.5)*height/floors;
      for(let col=0;col<columns;col++) {
        const color=["#6e9690","#82a7a0","#7c9f9a","#92afa6"][(floor+col*3+edge)%4];
        b.box(at((col+.5)/columns,y),[length/columns-.007,height/floors-.012,.009],color,"glass",[0,angle,0]);
      }
      b.box(at(.5,bottom+floor*height/floors,.011),[length+.003,.007,.012],palette.trim,"metal",[0,angle,0]);
    }
    for(let col=0;col<=columns;col++) {
      b.box(at(col/columns,bottom+height/2,.012),[col===0?.012:.007,height,.014],palette.trim,"metal",[0,angle,0]);
    }
    b.box(at(.5,bottom+height,.012),[length+.005,.013,.016],palette.stone,"metal",[0,angle,0]);
  }
}

function ifc(b) {
  b.box([0,.08,0],[.77,.16,.66],"#d0d4c0");
  curtainWall(b,chamfered(.65,.53),.16,.2,2,6);
  for(let tier=0;tier<5;tier++) {
    const width=.54-tier*.018,depth=.46-tier*.015;
    curtainWall(b,chamfered(width,depth,.068),.36+tier*.623,.623,9,6);
  }
  curtainWall(b,chamfered(.39,.32,.045),3.475,.15,2,5);
  // The open crown and paired fins are part of IFC's silhouette.
  for(const x of [-.15,-.05,.05,.15]) {
    b.box([x,3.76,-.13],[.022,.32,.046],palette.stone,"metal");
    b.box([x,3.76,.13],[.022,.32,.046],palette.stone,"metal");
  }
  b.box([0,3.62,0],[.27,.09,.19],palette.dark,"glass");
  b.box([0,.04,-.42],[.58,.08,.2]);
  for(let i=0;i<5;i++)b.box([-.24+i*.12,.21,-.281],[.018,.16,.024],palette.stone,"metal");
}

function icc(b) {
  b.box([0,.09,0],[.89,.18,.76],"#d1d7c4");
  curtainWall(b,chamfered(.71,.6,.065),.18,.16,2,6);
  for(let tier=0;tier<4;tier++) {
    curtainWall(b,chamfered(.58-tier*.028,.53-tier*.026,.05),.34+tier*1.02,1.02,14,6);
  }
  b.box([0,4.45,0],[.45,.12,.4],palette.stone);
  for(let i=0;i<7;i++) b.box([0,4.409+i*.015,-.205],[.37,.006,.016],"#a9bbb0","metal");
  b.box([0,4.525,0],[.33,.035,.3],"#b7c7ba","metal");
}

function bank(b) {
  const points=[[-.265,-.265],[.265,-.265],[.265,.265],[-.265,.265]],tops=[2.6,3.09,2.53,2.07];
  b.box([0,.08,0],[.72,.16,.64],"#d2d8c6");
  for(let edge=0;edge<4;edge++) {
    const next=(edge+1)%4,a=points[edge],c=points[next],h0=tops[edge],h1=tops[next],normal=[(c[1]-a[1])/.53,-(c[0]-a[0])/.53];
    const pos=(t,y,offset=.004)=>[a[0]+(c[0]-a[0])*t+normal[0]*offset,y,a[1]+(c[1]-a[1])*t+normal[1]*offset];
    const verts=[pos(0,.16,0),pos(1,h1,0),pos(1,.16,0),pos(0,.16,0),pos(0,h0,0),pos(1,h1,0)];
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(verts.flat(),3));g.computeVertexNormals();b.add(g,["#72948e","#8ca7a0","#829f99","#71938d"][edge],"glass");
    for(let floor=.24;floor<Math.max(h0,h1);floor+=.068) {
      for(let col=0;col<6;col++) {
        const t=(col+.5)/6,top=h0+(h1-h0)*t;
        if(floor+.032>top)continue;
        b.box(pos(t,floor),[.078,.055,.009],(col+Math.round(floor*100))%3===0?"#8cab9f":"#73968f","glass",[0,-Math.atan2(c[1]-a[1],c[0]-a[0]),0]);
      }
    }
    b.beam(pos(0,.15,.016),pos(0,h0,.016),.01);
    b.beam(pos(0,h0,.016),pos(1,h1,.016),.01);
    // Diagonals stop at each sloping roof edge, including the side facades.
    for(let y=.16;y<Math.min(h0,h1)-.1;y+=.78) {
      const end0=Math.min(y+.78,h0),end1=Math.min(y+.78,h1);
      b.beam(pos(0,y,.02),pos(1,end1,.02),.009);
      b.beam(pos(1,y,.02),pos(0,end0,.02),.009);
    }
  }
  const roof=new THREE.BufferGeometry(),p=points.map(([x,z],i)=>[x,tops[i],z]);
  roof.setAttribute("position",new THREE.Float32BufferAttribute([p[0],p[2],p[1],p[0],p[3],p[2]].flat(),3));roof.computeVertexNormals();b.add(roof,"#a3b8ab","metal");
  b.beam([.25,3.08,-.25],[.25,3.67,-.25],.008);
  b.beam([-.25,2.6,-.25],[-.25,3.2,-.25],.007);
}

function archPath(x, bottom, width, height) {
  const p=new THREE.Path(),r=width/2,spring=bottom+height-r;
  p.moveTo(x-r,bottom);p.lineTo(x+r,bottom);p.lineTo(x+r,spring);
  p.absarc(x,spring,r,0,Math.PI,false);p.lineTo(x-r,bottom);return p;
}

function clockFace(b, x, y, z, radius, angle=0) {
  const g=new THREE.CylinderGeometry(radius,radius,.007,24);
  g.rotateX(Math.PI/2);g.rotateY(angle);g.translate(x,y,z);b.add(g,"#f0e5c9");
  const transform=(dx,dy,dz)=>[x+dx*Math.cos(angle)+dz*Math.sin(angle),y+dy,z-dx*Math.sin(angle)+dz*Math.cos(angle)];
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    b.beam(transform(Math.sin(a)*radius*.78,Math.cos(a)*radius*.78,-.006),transform(Math.sin(a)*radius*.92,Math.cos(a)*radius*.92,-.006),.0018,"#567062");
  }
  b.beam(transform(0,0,-.008),transform(-radius*.5,radius*.2,-.008),.0028,"#4e6558");
  b.beam(transform(0,0,-.008),transform(radius*.22,radius*.64,-.008),.0024,"#4e6558");
}

function university(b) {
  const stone="#e5d5b8",brick=palette.brick;
  b.box([0,.04,0],[1.96,.08,1.35],"#cacdb2");
  // A courtyard plan, recessed glazing and open arcade give the facade depth.
  b.box([0,.095,.1],[1.5,.07,.86],"#a8bb8b");
  const front=new THREE.Shape();front.moveTo(-.85,.1);front.lineTo(.85,.1);front.lineTo(.85,.66);front.lineTo(-.85,.66);front.closePath();
  const bays=Array.from({length:13},(_,i)=>(i-6)*.122);
  for(const x of bays) {
    front.holes.push(archPath(x,.12,.086,.17));
    for(const bottom of [.34,.51])front.holes.push(archPath(x,bottom,.074,.12));
  }
  const wall=new THREE.ExtrudeGeometry(front,{depth:.045,bevelEnabled:false,curveSegments:8});wall.translate(0,0,-.45);b.add(wall,brick);
  for(const x of bays)b.box([x,.39,-.355],[.095,.53,.026],"#526c5b","glass");
  // Stone voussoirs follow the openings; each arch remains genuinely open.
  for(const x of bays) {
    for(const [bottom,w,h] of [[.12,.086,.17],[.34,.074,.12],[.51,.074,.12]]) {
      const spring=bottom+h-w/2,r=w/2+.008;
      for(let i=0;i<9;i++) {
        const a0=i*Math.PI/9,a1=(i+1)*Math.PI/9;
        b.beam([x+Math.cos(a0)*r,spring+Math.sin(a0)*r,-.458],[x+Math.cos(a1)*r,spring+Math.sin(a1)*r,-.458],.009,stone,"solid");
      }
      for(const sign of [-1,1])b.box([x+sign*r,(bottom+spring)/2,-.457],[.016,spring-bottom,.022],stone);
      if(bottom>.2){b.box([x,bottom+.039,-.425],[.004,.076,.009],stone);b.box([x,bottom+.044,-.425],[w,.005,.009],stone);}
    }
  }
  for(const y of [.105,.312,.484,.667])b.box([0,y,-.449],[1.77,.019,.069],stone);
  // Brick joints are limited to solid piers, leaving the openings unobstructed.
  for(let i=0;i<14;i++) {
    const x=(i-6.5)*.122;
    for(let row=0;row<25;row++) b.box([x,.13+row*.021,-.451],[.028,.0025,.004],row%2?"#c79a7c":"#a86f5d");
  }
  for(const x of [-.73,0,.73]) {
    b.box([x,.38,.17],[x===0?.21:.24,.56,1.1],brick);
    b.box([x,.677,.17],[x===0?.25:.28,.032,1.14],stone);
    // Low pitched slate roofs, with shallow raised tile courses.
    for(const sign of [-1,1])b.box([x+sign*.058,.715,.17],[.145,.018,1.12],palette.roof,"solid",[0,0,-sign*.4]);
    for(let t=0;t<23;t++)b.box([x,.738,-.36+t*.048],[.021,.012,.007],"#aeb6a2");
  }
  b.box([0,.38,.675],[1.7,.56,.18],brick);b.box([0,.67,.675],[1.77,.03,.22],stone);
  b.box([0,.38,.17],[1.5,.56,.1],brick);b.box([0,.675,.17],[1.53,.025,.13],palette.roof);
  for(const sign of [-1,1]) {
    for(let bay=0;bay<8;bay++)for(const y of [.24,.43,.58]) {
      const z=-.3+bay*.125;
      b.box([sign*.856,y,z],[.014,.097,.071],"#607963","glass");
      b.box([sign*.865,y+.057,z],[.022,.013,.09],stone);b.box([sign*.865,y-.057,z],[.022,.013,.09],stone);
      b.box([sign*.866,y,z],[.008,.097,.004],stone);
    }
    for(const y of [.105,.312,.484,.667])b.box([sign*.862,y,.17],[.038,.02,1.14],stone);
  }
  for(const x of bays) for(const y of [.24,.43,.58]) {
    b.box([x,y,.773],[.072,.095,.012],"#657d68","glass");
    b.box([x,y+.053,.781],[.087,.011,.018],stone);b.box([x,y-.053,.781],[.087,.011,.018],stone);
  }
  // Four corner turrets and the central clock tower.
  for(const x of [-.8,-.59,.59,.8]) {
    b.box([x,.665,-.46],[.12,.24,.14],stone);
    b.box([x,.697,-.535],[.055,.095,.009],"#6e7e66","glass");
    const cap=new THREE.SphereGeometry(.088,12,6,0,Math.PI*2,0,Math.PI/2);cap.scale(1,.78,1);cap.translate(x,.795,-.46);b.add(cap,"#a6ae98","metal");
    b.beam([x,.82,-.46],[x,.895,-.46],.008,stone);
  }
  b.box([0,.755,-.48],[.245,.22,.23],brick);
  b.box([0,.879,-.48],[.275,.027,.257],stone);
  b.box([0,.982,-.48],[.194,.18,.19],stone);
  clockFace(b,0,.987,-.581,.062);clockFace(b,.101,.987,-.48,.061,-Math.PI/2);
  for(const x of [-.108,.108])b.box([x,.98,-.577],[.017,.21,.018],"#c9b694");
  b.box([0,1.087,-.48],[.238,.026,.232],stone);
  const dome=new THREE.SphereGeometry(.129,16,8,0,Math.PI*2,0,Math.PI/2);dome.scale(1,.82,1);dome.translate(0,1.103,-.48);b.add(dome,"#9ba792","metal");
  b.beam([0,1.2,-.48],[0,1.3,-.48],.009,stone);
  // Portico, Ionic-inspired column capitals and layered entrance steps.
  for(let step=0;step<5;step++)b.box([0,.016+step*.016,-.69+step*.027],[.4-step*.02,.032,.21-step*.018],stone);
  for(const x of [-.125,-.042,.042,.125]) {
    b.beam([x,.1,-.535],[x,.56,-.535],.013,stone,"solid");
    b.box([x,.55,-.535],[.04,.027,.036],stone);b.box([x,.11,-.535],[.039,.025,.04],stone);
  }
  const pediment=new THREE.Shape();pediment.moveTo(-.18,.58);pediment.lineTo(.18,.58);pediment.lineTo(0,.7);pediment.closePath();
  const pedimentGeometry=new THREE.ExtrudeGeometry(pediment,{depth:.08,bevelEnabled:false});pedimentGeometry.translate(0,0,-.6);b.add(pedimentGeometry,stone);
  b.beam([-.175,.583,-.606],[0,.7,-.606],.008,"#c4bca2");b.beam([0,.7,-.606],[.175,.583,-.606],.008,"#c4bca2");
}

function peak(b) {
  const stone="#e4dfc9",rail="#d6ddd2",slate="#a4b8a9";
  // Keep the site under one world unit: a little pavilion within the mountain.
  b.box([0,.085,0],[.64,.17,.46],"#b9bda2");
  b.box([0,.18,0],[.79,.025,.59],stone);
  b.box([0,.32,.035],[.23,.26,.22],"#b9c8b8");
  for(const x of [-.22,.22])b.box([x,.29,.035],[.034,.2,.24],stone);
  b.box([0,.3,-.097],[.2,.17,.014],"#688d82","glass");
  for(const x of [-.07,0,.07])b.box([x,.3,-.108],[.008,.17,.012],rail,"metal");
  // A continuous upswept bowl supports the open observation deck.
  const profile=new THREE.Shape();profile.moveTo(-.35,.535);profile.lineTo(.35,.535);
  for(let i=24;i>=0;i--){const x=-.35+i/24*.7;profile.lineTo(x,.355+.155*(x/.35)**2);}
  profile.closePath();
  const bowl=new THREE.ExtrudeGeometry(profile,{depth:.34,bevelEnabled:false,curveSegments:1});bowl.translate(0,0,-.17);b.add(bowl,stone);
  for(const sign of [-1,1]) {
    for(let i=0;i<19;i++) {
      const x=-.315+i*.035,bottom=.362+.155*(x/.35)**2,h=.521-bottom;
      if(h<.012)continue;
      b.box([x,bottom+h/2,sign*.177],[.026,h,.009],"#6e978f","glass");
      b.box([x+.016,bottom+h/2,sign*.184],[.006,h+.005,.011],rail,"metal");
    }
    const rim=Array.from({length:25},(_,i)=>{const x=-.35+i/24*.7;return [x,.351+.155*(x/.35)**2,sign*.183];});
    for(let i=1;i<rim.length;i++)b.beam(rim[i-1],rim[i],.007,rail);
  }
  b.box([0,.549,0],[.73,.024,.37],stone);
  b.box([0,.565,0],[.61,.009,.275],slate);
  // Thin balustrades, benches and a low stair head leave the terrace usable.
  for(const z of [-.172,.172]) {
    b.beam([-.355,.612,z],[.355,.612,z],.0045,rail);
    for(let i=0;i<=12;i++)b.beam([-.348+i*.058,.561,z],[-.348+i*.058,.612,z],.003,rail);
  }
  for(const x of [-.355,.355])b.beam([x,.612,-.172],[x,.612,.172],.0045,rail);
  b.box([0,.584,.108],[.18,.036,.08],"#b1bda8");
  for(const x of [-.23,.23])b.box([x,.582,.085],[.105,.024,.034],"#aa9b7c");
  for(let i=0;i<5;i++)b.box([-.25,.025+i*.031,-.385+i*.032],[.16,.035,.09],stone);
  // Small perimeter bollards also act as restrained path lighting at night.
  for(const x of [-.34,.34]) {
    b.box([x,.225,-.24],[.015,.07,.015],slate,"metal");
    b.box([x,.256,-.24],[.02,.014,.02],"#eee0b0","glass");
  }
}

export function buildLandmarkFacade(id) {
  const b=builder();
  const model={ifc,icc,bank,hku:university,peak}[id];
  if(!model)throw new Error(`Unknown facade: ${id}`);
  model(b);return b.finish();
}

export function disposeLandmarkFacade(model) { Object.values(model).forEach(geometry=>geometry.dispose()); }
