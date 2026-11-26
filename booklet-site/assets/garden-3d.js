import * as THREE from './vendor/three.module.js';

(function(){
  'use strict';
  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  var layer=document.createElement('div');
  layer.className='garden-3d-layer';
  layer.setAttribute('aria-hidden','true');
  document.body.appendChild(layer);

  function fallback(){
    layer.classList.add('garden-3d-fallback');
    [
      ['ginger','assets/garden-ginger-cutout.png'],
      ['peppermint','assets/garden-peppermint-cutout.png'],
      ['henbane','assets/garden-henbane-cutout.png']
    ].forEach(function(specimen){
      var img=document.createElement('img');
      img.className='garden-fallback-plant garden-fallback-plant--'+specimen[0];
      img.src=specimen[1];img.alt='';img.decoding='async';
      layer.appendChild(img);
    });
  }

  var renderer;
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  }catch(error){fallback();return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.className='garden-3d-canvas';
  layer.appendChild(renderer.domElement);

  var scene=new THREE.Scene();
  var camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,2400);
  camera.position.set(0,0,1400);
  camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xdff5da,0x263321,2.0));
  var key=new THREE.DirectionalLight(0xfff4d7,2.4);key.position.set(-260,390,650);scene.add(key);
  var fill=new THREE.DirectionalLight(0x94d6aa,1.3);fill.position.set(390,120,260);scene.add(fill);

  var leafGeometryCache={};
  function leafGeometry(length,width,toothed){
    var key=length+'_'+width+'_'+(toothed?1:0);
    if(leafGeometryCache[key])return leafGeometryCache[key];
    var across=8,along=14,positions=[],indices=[];
    var uvs=[];
    for(var j=0;j<=along;j++){
      var t=.012+.976*j/along;
      var taper=Math.pow(Math.sin(Math.PI*t),.76)*(.82+.18*t);
      if(toothed)taper*=1+.105*Math.sin(t*Math.PI*18)*Math.sin(Math.PI*t);
      for(var i=0;i<=across;i++){
        var u=(i/across)*2-1;
        positions.push(u*width*.5*taper,length*t,.055*(1-u*u)*Math.sin(Math.PI*t)+.026*Math.sin(Math.PI*t));
        uvs.push(i/across,t);
      }
    }
    for(var row=0;row<along;row++)for(var col=0;col<across;col++){
      var a=row*(across+1)+col,b=a+across+1;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    var geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geo.setIndex(indices);geo.computeVertexNormals();
    leafGeometryCache[key]=geo;return geo;
  }
  var materialCache={};
  function material(color,options){
    var key=String(color);
    if(!options&&materialCache[key])return materialCache[key];
    var created=new THREE.MeshStandardMaterial(Object.assign({color:color,roughness:.82,metalness:0,side:THREE.DoubleSide},options||{}));
    if(!options)materialCache[key]=created;
    return created;
  }
  function mergePlant(root){
    root.updateMatrixWorld(true);
    var batches=new Map(),linePositions=[];
    root.traverse(function(object){
      if(object.isMesh){
        var batch=batches.get(object.material);
        if(!batch){batch={material:object.material,positions:[],normals:[],uvs:[],indices:[]};batches.set(object.material,batch);}
        var geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
        var position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
        var offset=batch.positions.length/3;
        for(var i=0;i<position.count;i++){
          batch.positions.push(position.getX(i),position.getY(i),position.getZ(i));
          batch.normals.push(normal.getX(i),normal.getY(i),normal.getZ(i));
          batch.uvs.push(uv.getX(i),uv.getY(i));
        }
        var index=geometry.index;
        if(index){for(var j=0;j<index.count;j++)batch.indices.push(offset+index.getX(j));}
        else{for(var k=0;k<position.count;k++)batch.indices.push(offset+k);}
        geometry.dispose();
      }else if(object.isLine){
        var lineGeometry=object.geometry.clone().applyMatrix4(object.matrixWorld),line=lineGeometry.getAttribute('position');
        for(var p=0;p<line.count-1;p++){
          linePositions.push(line.getX(p),line.getY(p),line.getZ(p),line.getX(p+1),line.getY(p+1),line.getZ(p+1));
        }
        lineGeometry.dispose();
      }
    });
    root.clear();
    batches.forEach(function(batch){
      var geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
      geometry.setIndex(batch.indices);root.add(new THREE.Mesh(geometry,batch.material));
    });
    if(linePositions.length){
      var lines=new THREE.BufferGeometry();
      lines.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));
      root.add(new THREE.LineSegments(lines,new THREE.LineBasicMaterial({color:0x9eaa70,transparent:true,opacity:.72})));
    }
  }
  function addLeaf(parent,opts){
    var pivot=new THREE.Group();
    pivot.position.set(opts.x||0,opts.y||0,opts.z||0);
    pivot.rotation.set(opts.rx||0,opts.ry||0,opts.rz||0);
    var leaf=new THREE.Mesh(leafGeometry(opts.length,opts.width,!!opts.toothed),material(opts.color));
    pivot.add(leaf);
    var pts=[];
    for(var i=0;i<=6;i++){
      var t=.05+.9*i/6;
      pts.push(new THREE.Vector3(0,opts.length*t,.085*Math.sin(Math.PI*t)));
    }
    var veinGeometry=new THREE.BufferGeometry().setFromPoints(pts);
    var vein=new THREE.Line(veinGeometry,new THREE.LineBasicMaterial({color:opts.vein||0x72924c,transparent:true,opacity:.72}));
    pivot.add(vein);parent.add(pivot);return pivot;
  }
  function addStem(parent,points,color,radius){
    var curve=new THREE.CatmullRomCurve3(points.map(function(p){return new THREE.Vector3(p[0],p[1],p[2]||0);}));
    var mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,20,radius||2.2,7,false),material(color||0x557747));
    parent.add(mesh);return mesh;
  }
  function addSphere(parent,x,y,z,sx,sy,sz,color,detail){
    var sphere=new THREE.Mesh(new THREE.SphereGeometry(1,detail||12,9),material(color));
    sphere.position.set(x,y,z);sphere.scale.set(sx,sy,sz);parent.add(sphere);return sphere;
  }
  function addMintSpike(parent,x,y,z,scale){
    var height=24*scale;
    addStem(parent,[[x,y,z],[x+1,y+height*.5,z],[x+2,y+height,z]],0x617748,1.15*scale);
    for(var i=0;i<8;i++){
      var t=i/8,cy=y+height*(.12+t*.84),r=(2.5+2.4*Math.sin(Math.PI*t))*scale;
      for(var k=0;k<5;k++){
        var a=k*Math.PI*2/5+i*.42;
        addSphere(parent,x+Math.cos(a)*r,cy,z+Math.sin(a)*r,2.1*scale,3.1*scale,2*scale,i%2?0xa979ad:0xc28cba,7);
      }
    }
  }
  function gingerPlant(){
    var root=new THREE.Group(),green=[0x567e42,0x668b48,0x789551,0x4f7540];
    [[-23,8,0,23,0x9d743c],[0,6,4,26,0xb48a4d],[23,9,-1,21,0x9b713f],[-10,0,-12,19,0xc09a5d],[13,1,12,18,0xad8249]].forEach(function(b){
      addSphere(root,b[0],b[1],b[2],b[3],b[3]*.72,b[3]*.82,b[4],14);
      addSphere(root,b[0]+b[3]*.52,b[1]+3,b[2]+2,b[3]*.65,b[3]*.56,b[3]*.67,b[4],12);
      for(var r=0;r<2;r++){
        var x=b[0]+(Math.random()-.5)*b[3],z=b[2]+(Math.random()-.5)*b[3];
        addStem(root,[[x,b[1]-3,z],[x+(Math.random()-.5)*5,-10,z+3],[x+(Math.random()-.5)*9,-21,z+5]],0xb18d61,1.1);
      }
    });
    for(var s=0;s<5;s++){
      var angle=s*Math.PI*2/5+.25,baseX=Math.cos(angle)*12,baseZ=Math.sin(angle)*10,h=142+(s%3)*22;
      var bend=Math.cos(angle)*13;
      addStem(root,[[baseX,20,baseZ],[baseX+bend*.25,h*.43,baseZ],[baseX+bend,h,baseZ]],green[s%green.length],2.8);
      for(var n=0;n<5;n++){
        var t=.24+n*.145,y=20+h*t,x=baseX+bend*t;
        var side=(n%2?1:-1),dir=angle+side*.95+(s%2)*.3;
        addLeaf(root,{x:x,y:y,z:baseZ,length:52+(n%3)*7,width:13+(n%2)*3,color:green[(s+n)%green.length],vein:0xa4ae70,rz:dir,rx:(n%2?-.43:.43),ry:Math.sin(angle)*.75});
      }
    }
    root.userData={speed:.215,phase:.4,amplitude:5};return root;
  }
  function mintPlant(){
    var root=new THREE.Group(),greens=[0x3f7845,0x4e874a,0x5a9050,0x487d43];
    for(var s=0;s<8;s++){
      var a=s*Math.PI*2/8,r=7+(s%3)*3,bx=Math.cos(a)*r,bz=Math.sin(a)*r,h=150+(s%4)*13,lean=Math.cos(a)*13;
      addStem(root,[[bx,0,bz],[bx+lean*.25,h*.38,bz],[bx+lean,h,bz]],greens[s%4],2.15);
      for(var n=0;n<5;n++){
        var t=.2+n*.145,y=h*t,x=bx+lean*t,side=n%2?1:-1;
        addLeaf(root,{x:x,y:y,z:bz,length:38+(n%3)*5,width:23+(n%2)*4,color:greens[(s+n)%4],vein:0x9db579,toothed:true,rz:a+side*.9,rx:side*.36,ry:Math.sin(a)*.72});
      }
      if(s%2===0)addMintSpike(root,bx+lean,h+2,bz,.8+(s%3)*.12);
    }
    root.userData={speed:-.175,phase:2.1,amplitude:7};return root;
  }
  function addHenbaneFlower(parent,x,y,z,scale,rotation){
    var blossom=new THREE.Group();blossom.position.set(x,y,z);blossom.rotation.set(.22,rotation,.12);parent.add(blossom);
    for(var p=0;p<5;p++){
      var a=p*Math.PI*2/5;
      addLeaf(blossom,{x:Math.cos(a)*1.5,y:0,z:Math.sin(a)*1.5,length:22*scale,width:18*scale,color:p%2?0xe1d99f:0xf0e8bd,vein:0x817254,rz:a+Math.PI/2,rx:Math.sin(a)*.25,ry:Math.cos(a)*.28});
    }
    addSphere(blossom,0,7*scale,.18,5*scale,5*scale,2.2*scale,0x423529,10);
    for(var i=0;i<7;i++){
      var t=i*.9;addSphere(blossom,Math.cos(t)*2.7*scale,7*scale+Math.sin(t)*2.7*scale,.7,1.2*scale,1.2*scale,.8,0x8e7448,6);
    }
  }
  function henbanePlant(){
    var root=new THREE.Group(),greens=[0x758257,0x849064,0x68794f,0x929777];
    var branches=[{a:-.1,h:190,x:-5,z:0},{a:1.05,h:164,x:8,z:3},{a:2.2,h:174,x:-11,z:-4},{a:3.35,h:155,x:9,z:-2},{a:4.45,h:181,x:-7,z:5}];
    branches.forEach(function(b,branchIndex){
      var dx=Math.cos(b.a)*18,dz=Math.sin(b.a)*15;
      addStem(root,[[b.x,0,b.z],[b.x+dx*.25,b.h*.4,b.z+dz*.25],[b.x+dx,b.h,b.z+dz]],greens[branchIndex%4],2.5);
      for(var n=0;n<4;n++){
        var t=.18+n*.16,y=b.h*t,x=b.x+dx*t,z=b.z+dz*t,side=n%2?1:-1;
        addLeaf(root,{x:x,y:y,z:z,length:47+(n%2)*9,width:30+(n%3)*4,color:greens[(branchIndex+n)%4],vein:0xc1c4a0,toothed:true,rz:b.a+side*1.02,rx:side*.34,ry:Math.cos(b.a)*.8});
      }
      if(branchIndex===0||branchIndex===1||branchIndex===3){
        addHenbaneFlower(root,b.x+dx,b.h+4,b.z+dz,1.08,b.a);
        if(branchIndex===1)addHenbaneFlower(root,b.x+dx+13,b.h-19,b.z+dz+4,.83,b.a+.8);
      }
    });
    root.userData={speed:.19,phase:4.3,amplitude:6};return root;
  }

  var plants=[gingerPlant(),mintPlant(),henbanePlant()];
  plants.forEach(function(plant){mergePlant(plant);scene.add(plant);});
  var viewport={width:1,height:1};
  function resize(){
    viewport.width=Math.max(1,window.innerWidth);viewport.height=Math.max(1,window.innerHeight);
    renderer.setSize(viewport.width,viewport.height,false);
    camera.left=-viewport.width/2;camera.right=viewport.width/2;
    camera.top=viewport.height/2;camera.bottom=-viewport.height/2;camera.updateProjectionMatrix();
    var scale=Math.max(.67,Math.min(1,viewport.height/820));
    plants.forEach(function(plant){plant.scale.setScalar(scale);});
    plants[0].position.set(-viewport.width*.385,-viewport.height*.23,0);
    plants[1].position.set(viewport.width*.385,-viewport.height*.21,-8);
    plants[2].position.set(viewport.width*.22,-viewport.height*.405,-14);
    plants.forEach(function(plant){plant.userData.baseX=plant.position.x;plant.userData.baseY=plant.position.y;});
  }
  window.addEventListener('resize',resize,{passive:true});resize();
  var startTime=performance.now(),lastFrame=startTime;
  function animate(){
    window.requestAnimationFrame(animate);
    var now=performance.now();
    if(document.hidden){lastFrame=now;return;}
    var dt=Math.min((now-lastFrame)/1000,.05),t=(now-startTime)/1000;
    lastFrame=now;
    plants.forEach(function(plant){
      if(reduced.matches){
        plant.position.x=plant.userData.baseX;plant.position.y=plant.userData.baseY;
        plant.rotation.x=0;plant.rotation.z=0;
        return;
      }
      plant.rotation.y+=plant.userData.speed*dt;
      plant.rotation.x=.07*Math.sin(t*.42+plant.userData.phase);
      plant.rotation.z=.018*Math.sin(t*.55+plant.userData.phase);
      plant.position.y=plant.userData.baseY+Math.sin(t*.48+plant.userData.phase)*plant.userData.amplitude;
      plant.position.x=plant.userData.baseX+Math.sin(t*.25+plant.userData.phase)*2;
    });
    renderer.render(scene,camera);
  }
  animate();
  document.addEventListener('visibilitychange',function(){if(!document.hidden)clock.start();});
})();
