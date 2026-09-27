import {
  BoxGeometry, CylinderGeometry, TorusGeometry, SphereGeometry, Mesh, Group,
  MeshStandardMaterial, DataTexture, RGBAFormat, RepeatWrapping, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter,
  Vector3, Matrix4, Quaternion, type BufferGeometry, type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SpacecraftId } from '../data/spacecraft';

type XYZ = [number, number, number];
const Y = new Vector3(0, 1, 0);

/** Original geometry reconstructed from ESA / NASA / ISRO public illustrations.
 * Dimensions and minor fittings are visual approximations, not engineering CAD.
 * +Y is the instrument / nadir face; solar drives rotate around local X. */
export function buildSpacecraft(id: SpacecraftId) {
  const root = new Group();
  const textures: DataTexture[] = [];
  function texture(kind: 'foil' | 'cells') {
    const w = 256, h = 256, bytes = new Uint8Array(w * h * 4);
    for (let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const i=(y*w+x)*4;
      if (kind === 'cells') {
        const edge=x%32<2||y%16<1;
        const bus=x%32===15;
        const glint=Math.sin(x*.15+y*.12)*3;
        bytes[i]=edge?86:bus?113:15+glint;
        bytes[i+1]=edge?96:bus?115:29+glint;
        bytes[i+2]=edge?102:bus?111:52+glint;
      } else {
        // Repeatable crinkles at several scales, used as a subtle bump map.
        const fold = Math.abs(Math.sin(x*.071+Math.sin(y*.043)*4+Math.cos(x*.037-y*.019)*3));
        const crease = Math.pow(1-fold,12)*75;
        const v=105+fold*40+crease+Math.sin(y*.21-x*.13+Math.sin(y*.093)*2)*12;
        bytes[i]=bytes[i+1]=bytes[i+2]=v;
      }
      bytes[i+3]=255;
    }
    const tex=new DataTexture(bytes,w,h,RGBAFormat);
    tex.wrapS=tex.wrapT=RepeatWrapping;
    tex.generateMipmaps=true; tex.minFilter=LinearMipmapLinearFilter; tex.magFilter=LinearFilter; tex.anisotropy=8;
    if(kind==='cells')tex.colorSpace=SRGBColorSpace;
    tex.needsUpdate=true; textures.push(tex); return tex;
  }
  const foil=texture('foil'), cells=texture('cells');
  const materials = {
    gold: new MeshStandardMaterial({color:'#ac8031',metalness:.92,roughness:.27,bumpMap:foil,bumpScale:.065}),
    silver: new MeshStandardMaterial({color:'#bdc6cf',metalness:.86,roughness:.28,bumpMap:foil,bumpScale:.055}),
    white: new MeshStandardMaterial({color:'#e0e2dc',metalness:.12,roughness:.68}),
    frame: new MeshStandardMaterial({color:'#8a969e',metalness:.83,roughness:.28}),
    black: new MeshStandardMaterial({color:'#13171d',metalness:.25,roughness:.56}),
    optic: new MeshStandardMaterial({color:'#182d39',metalness:.85,roughness:.12}),
    cells: new MeshStandardMaterial({map:cells,metalness:.48,roughness:.31}),
    wire: new MeshStandardMaterial({color:'#9b6940',metalness:.67,roughness:.4}),
  };
  type Finish=keyof typeof materials;
  // Hundreds of fittings merge by material, keeping the three globe models inexpensive.
  const batches = new Map<Group, Map<Finish, BufferGeometry[]>>();
  function add(parent:Group, geo:BufferGeometry, finish:Finish, p:XYZ=[0,0,0], q?:Quaternion) {
    geo.applyMatrix4(new Matrix4().compose(new Vector3(...p),q??new Quaternion(),new Vector3(1,1,1)));
    if(!batches.has(parent)) batches.set(parent,new Map());
    const batch=batches.get(parent)!;
    if(!batch.has(finish))batch.set(finish,[]);
    batch.get(finish)!.push(geo);
  }
  function box(parent:Group,p:XYZ,size:XYZ,finish:Finish,rounded=false) {
    add(parent,rounded?new RoundedBoxGeometry(...size,2,.035):new BoxGeometry(...size),finish,p);
  }
  function cylinder(parent:Group,p:XYZ,r:number,h:number,finish:Finish,top=r,segments=48) {
    add(parent,new CylinderGeometry(top,r,h,segments),finish,p);
  }
  function rod(parent:Group,a:XYZ,b:XYZ,r=.025,finish:Finish='frame') {
    const start=new Vector3(...a),end=new Vector3(...b),d=end.clone().sub(start);
    add(parent,new CylinderGeometry(r,r,d.length(),8),finish,start.add(end).multiplyScalar(.5).toArray() as XYZ,new Quaternion().setFromUnitVectors(Y,d.normalize()));
  }
  function ring(parent:Group,p:XYZ,r:number,tube=.025,finish:Finish='frame') {
    add(parent,new TorusGeometry(r,tube,8,48),finish,p,new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2));
  }
  function aperture(parent:Group,p:XYZ,r:number,length:number,finish:Finish) {
    cylinder(parent,p,r,length,finish);
    // Inset pupil, baffle rings and dark optical glass on the nadir face.
    cylinder(parent,[p[0],p[1]+length/2+.002,p[2]],r*.91,.008,'black');
    cylinder(parent,[p[0],p[1]+length/2+.009,p[2]],r*.65,.01,'optic');
    ring(parent,[p[0],p[1]+length/2+.02,p[2]],r*.95,.035,finish);
    ring(parent,[p[0],p[1]+length/2+.014,p[2]],r*.76,.016,'black');
  }
  function radiator(parent:Group,p:XYZ,width:number,height:number) {
    box(parent,p,[width,height,.055],'white');
    for(let i=0;i<12;i++) box(parent,[p[0]-width*.45+i*width*.9/11,p[1],p[2]+.03],[.009,height*.94,.006],'frame');
    for(const x of [-1,1])for(const y of [-1,1])
      add(parent,new SphereGeometry(.022,6,4),'frame',[p[0]+x*width*.45,p[1]+y*height*.45,p[2]+.04]);
  }
  function dish(parent:Group,p:XYZ,r:number) {
    const g=new Group();g.position.set(...p);g.rotation.x=.6;root.add(g);
    cylinder(g,[0,0,0],r,.13,'gold',r*.5);
    cylinder(g,[0,.072,0],r*.94,.01,'white');
    for(const x of [-1,1])rod(g,[x*r*.85,.08,0],[0,.4,0],.016);
    rod(g,[0,.08,r*.85],[0,.4,0],.016);
    cylinder(g,[0,.4,0],.055,.13,'frame');
    rod(parent,[p[0],p[1]-.4,p[2]],p,.04);
  }
  function fittings(parent:Group,width:number,depth:number,y:number) {
    for(const x of [-1,1])for(const z of [-1,1]) {
      const p:XYZ=[x*width*.43,y,z*depth*.43];
      box(parent,p,[.23,.15,.24],'black',true);
      aperture(parent,[p[0],y+.15,p[2]],.07,.18,'frame');
      // Corner thruster nozzles and mounting plates.
      cylinder(parent,[p[0],-y*.9,p[2]],.08,.18,'frame',.035,12);
    }
  }
  const wings:Group[]=[];
  function wing(side:number,origin:XYZ,count:number,panelWidth:number,panelDepth:number) {
    const g=new Group();g.name='solar-drive';g.position.set(...origin);root.add(g);wings.push(g);
    rod(g,[0,0,0],[side*.55,0,0],.055);
    for(let i=0;i<count;i++) {
      const x=side*(.55+panelWidth/2+i*(panelWidth+.065));
      box(g,[x,0,0],[panelWidth,.07,panelDepth],'frame');
      box(g,[x,.04,0],[panelWidth-.08,.014,panelDepth-.08],'cells');
      box(g,[x,-.04,0],[panelWidth-.08,.014,panelDepth-.08],'black');
      for(const z of [-1,1]) rod(g,[x-side*panelWidth/2,-.075,z*panelDepth*.32],[x+side*panelWidth/2,-.075,-z*panelDepth*.32],.018);
      for(const z of [-1,1]) {
        box(g,[x-side*panelWidth/2,0,z*panelDepth*.35],[.14,.14,.16],'frame');
        box(g,[x, .055,z*panelDepth*.33],[panelWidth-.05,.01,.016],'wire');
      }
    }
  }

  if(id==='sentinel-2b') {
    box(root,[0,0,0],[1.8,2.35,3.4],'gold',true);
    // Individual blanket seams and corner rails preserve the AstroBus-L box profile.
    for(const x of [-.92,.92])for(const z of [-1.72,0,1.72]) rod(root,[x,-1.13,z],[x,1.13,z],.015,'wire');
    for(const y of [-1.12,0,1.12]) box(root,[0,y,1.712],[1.72,.018,.018],'wire');
    radiator(root,[0,-.1,1.735],1.35,1.45);
    box(root,[-.35,1.36,-.55],[1.03,.36,1.65],'silver',true);
    aperture(root,[-.35,1.65,-.75],.42,.48,'silver');
    box(root,[.28,1.22,.62],[.76,.2,1.12],'white',true);
    aperture(root,[.4,1.47,1.05],.16,.3,'black');
    cylinder(root,[0,-1.27,0],.59,.21,'frame');
    ring(root,[0,-1.4,0],.6,.05);
    fittings(root,1.8,3.4,1.2);
    wing(1,[.92,-.35,0],3,1.5,2.1);
    dish(root,[-.64,1.64,1.3],.24);
    rod(root,[-.82,1.2,-1.4],[-.82,2.18,-1.4],.022);
  } else if(id==='landsat-9') {
    cylinder(root,[0,-.35,0],1.38,2.25,'silver',1.38,8);
    box(root,[0,.88,0],[2.7,.18,2.25],'frame',true);
    // Separate OLI-2 rectangular assembly and taller TIRS-2 cryocooler housing.
    box(root,[-.53,1.48,-.12],[1.55,1.05,1.9],'white',true);
    aperture(root,[-.57,2.04,-.2],.48,.38,'white');
    box(root,[.86,1.35,.05],[.93,.78,1.22],'silver',true);
    aperture(root,[.88,1.92,.05],.32,.58,'silver');
    radiator(root,[.8,1.25,.75],1.05,.85);
    box(root,[-.7,1.5,1.04],[1.7,1.2,.035],'white');
    for(let i=0;i<6;i++)box(root,[-1.1+i*.43,-.38,1.29],[.22,1.64,.045],'black');
    cylinder(root,[0,-1.64,0],.76,.2,'frame');
    ring(root,[0,-1.75,0],.78,.05);
    fittings(root,2.7,2.2,.93);
    wing(1,[1.4,-.48,0],4,1.65,2.55);
    dish(root,[-1.58,-.24,.1],.53);
    rod(root,[-1.25,-.9,-.7],[-2.2,-1.4,-1.6],.04);
    box(root,[-2.2,-1.4,-1.6],[.72,.04,.78],'black');
  } else {
    box(root,[0,-.52,0],[2.35,1.85,2.15],'gold',true);
    box(root,[0,.45,0],[2.45,.14,2.25],'frame');
    // Large on-axis telescope dominates Cartosat's silhouette in ISRO's drawing.
    aperture(root,[0,1.38,0],.92,1.75,'white');
    for(const y of [.59,1.02,1.94])ring(root,[0,y,0],.93,.024,'frame');
    cylinder(root,[0,2.27,0],.59,.018,'optic');
    cylinder(root,[0,2.31,0],.23,.16,'black');
    for(let i=0;i<3;i++) {
      const a=i*Math.PI*2/3;
      rod(root,[Math.cos(a)*.87,2.3,Math.sin(a)*.87],[0,2.38,0],.018,'black');
    }
    box(root,[-1.03,1.01,-.55],[.43,1.05,.68],'silver',true);
    box(root,[1.02,.91,.4],[.4,.8,.8],'silver',true);
    radiator(root,[0,-.5,1.105],1.65,1.32);
    for(const x of [-1.19,1.19])rod(root,[x,-1.42,1.05],[x,.47,1.05],.024);
    fittings(root,2.35,2.15,.61);
    wing(-1,[-1.2,-.25,0],2,1.32,2.15);
    wing(1,[1.2,-.25,0],2,1.32,2.15);
    dish(root,[1.02,1.82,-.82],.29);
    cylinder(root,[0,-1.55,0],.58,.23,'frame');
    ring(root,[0,-1.69,0],.6,.04);
  }
  for(const [parent,batch] of batches) for(const [finish,geometries] of batch) {
    // All primitives carry position/normal/uv. Indexed topology is normalised for merging.
    const expanded=geometries.map(g=>g.index?g.toNonIndexed():g);
    const merged=mergeGeometries(expanded)!;
    const mesh=new Mesh(merged,materials[finish]);
    mesh.name=finish;parent.add(mesh);
    for(const g of expanded)g.dispose();
    for(const g of geometries)g.dispose();
  }
  return {root,wings,dispose:()=>{
    root.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});
    Object.values(materials).forEach((m:Material)=>m.dispose());
    textures.forEach(t=>t.dispose());
  }};
}
