import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {MTLLoader} from 'three/addons/loaders/MTLLoader.js';
import {PLYLoader} from 'three/addons/loaders/PLYLoader.js';
import {CAD,MAX_BYTES,MAX_TRIANGLES,extension,inspectGLB,safeResource,unitMm} from './policy.js';
import {getAsset} from './db.js';
import {computeSha256,generateUUID} from './crypto.js';
const cache=new Map();
const material=()=>new THREE.MeshStandardMaterial({color:0xb1b6b9,roughness:.46,metalness:.25,side:THREE.DoubleSide});
export function releaseObject(root){const geometries=new Set(),materials=new Set(),textures=new Set();root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
function cadParse(buffer,ext){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./cad-worker.js',import.meta.url),{type:'classic'});
 const timer=setTimeout(()=>{worker.terminate();reject(Error('CAD vượt quá 45 giây. Hãy tách assembly hoặc export GLB nhẹ hơn.'));},45000);
 const finish=()=>{clearTimeout(timer);worker.terminate();};
 worker.onerror=e=>{finish();reject(Error(e.message||'Không khởi tạo được CAD worker.'));};
 worker.onmessage=({data})=>{finish();if(data.error)return reject(Error(data.error));resolve(data.result);};
 worker.postMessage({buffer,ext},[buffer]);
});}
function cadGroup(result){
 const group=new THREE.Group();
 for(const m of result.meshes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(m.attributes.position.array,3));g.setIndex(m.index.array);
 if(m.attributes.normal)g.setAttribute('normal',new THREE.Float32BufferAttribute(m.attributes.normal.array,3));else g.computeVertexNormals();
 const mat=material();if(m.color)mat.color.setRGB(...m.color);const mesh=new THREE.Mesh(g,mat);mesh.name=m.name||'CAD part';group.add(mesh);}
 return group;
}
export async function parseModel(file,files,{unit='mm',up='z',origin='imported',targetMm=null}={}){
 if(file.size>MAX_BYTES)throw Error('File lớn hơn 40 MiB.');
 const ext=extension(file.name),buffer=await file.arrayBuffer(),urls=[];
 const manager=new THREE.LoadingManager();let resourceError=null;
 manager.onError=uri=>{resourceError=Error('Không đọc được tài nguyên: '+uri);};
 manager.setURLModifier(uri=>{if(uri.startsWith('blob:'))return uri;try{const resource=safeResource(uri,files);if(typeof resource==='string')return resource;const url=URL.createObjectURL(resource);urls.push(url);return url;}catch(e){resourceError=e;throw e;}});
 let source,normalized,hadMtl=false;
 try{
  if(ext==='glb'){inspectGLB(buffer);source=(await new GLTFLoader(manager).parseAsync(buffer,'')).scene;}
  else if(ext==='gltf'){
   const json=JSON.parse(new TextDecoder().decode(buffer));
   if(json.extensionsRequired?.length)throw Error('glTF chưa hỗ trợ extension bắt buộc; hãy export GLB không nén.');
   for(const item of [...(json.buffers||[]),...(json.images||[])])if(item.uri)safeResource(item.uri,files);
   source=(await new GLTFLoader(manager).parseAsync(JSON.stringify(json),'')).scene;
  }else if(ext==='obj'){
   const text=new TextDecoder().decode(buffer),loader=new OBJLoader(manager);
   const mtls=[...text.matchAll(/^mtllib\s+(.+)$/gm)].map(m=>m[1].trim());
   if(mtls.length>1)throw Error('OBJ nhiều MTL: hãy gộp hoặc export GLB.');
   if(mtls.length){hadMtl=true;const f=safeResource(mtls[0],files);const materials=new MTLLoader(manager).parse(await f.text(),'');const ready=new Promise(resolve=>{manager.onLoad=resolve;});materials.preload();loader.setMaterials(materials);if(urls.length)await ready;}
   source=loader.parse(text);
  }else if(ext==='stl'||ext==='ply'){
   const g=ext==='stl'?new STLLoader().parse(buffer):new PLYLoader().parse(buffer);if(!g.getAttribute('normal'))g.computeVertexNormals();source=new THREE.Group();source.add(new THREE.Mesh(g,material()));
  }else if(CAD.includes(ext))source=cadGroup(await cadParse(buffer,ext));
  else throw Error('Định dạng không hỗ trợ.');
  if(resourceError)throw resourceError;
  // STEP/IGES are tessellated explicitly into mm by OpenCascade. glTF is meters/Y-up by specification.
  const actualUnit=['glb','gltf'].includes(ext)?'m':CAD.includes(ext)&&ext!=='brep'?'mm':unit;
  const actualUp=['glb','gltf'].includes(ext)?'y':up;
  const factor=unitMm(actualUnit);if(!factor)throw Error('Cần chọn đơn vị nguồn.');
  normalized=new THREE.Group();normalized.add(source);
  source.scale.multiplyScalar(factor/1000);if(actualUp==='z')source.rotateX(-Math.PI/2);
  normalized.updateMatrixWorld(true);
  let triangles=0,meshes=0,vertices=0;
  source.traverse(o=>{if(!o.isMesh)return;meshes++;const a=o.geometry?.getAttribute('position');if(!a)throw Error('Mesh thiếu vị trí đỉnh.');
   vertices+=a.count;triangles+=(o.geometry.index?.count??a.count)/3;
   for(let i=0;i<a.array.length;i++)if(!Number.isFinite(a.array[i]))throw Error('Mesh có tọa độ NaN/Infinity.');
   if(o.isSkinnedMesh)throw Error('Hãy bake skin/animation thành static mesh trước khi import.');
  });
  if(!meshes||!triangles)throw Error('Model không có mặt tam giác để hiển thị.');
  if(triangles>MAX_TRIANGLES)throw Error('Vượt 750.000 tam giác. Hãy giảm mesh trước khi import.');
  const bounds=new THREE.Box3().setFromObject(normalized),size=new THREE.Vector3();bounds.getSize(size);
  if(!Number.isFinite(size.length())||size.length()===0)throw Error('Kích thước hình học không hợp lệ.');
  if(targetMm){if(!Number.isFinite(targetMm)||targetMm<=0||targetMm>10000)throw Error('Kích thước đích phải trong (0, 10000] mm.');normalized.scale.multiplyScalar(targetMm/1000/Math.max(size.x,size.y,size.z));bounds.setFromObject(normalized);bounds.getSize(size);}
  if(Math.max(size.x,size.y,size.z)>10||Math.max(size.x,size.y,size.z)<.00001)throw Error('Model ngoài khoảng 0,01–10.000 mm. Kiểm tra đơn vị nguồn.');
  const center=new THREE.Vector3();bounds.getCenter(center);const wrapper=new THREE.Group();normalized.position.sub(center);wrapper.add(normalized);
  const glb=await new GLTFExporter().parseAsync(wrapper,{binary:true,onlyVisible:true,maxTextureSize:2048});
  if(glb.byteLength>MAX_BYTES)throw Error('GLB chuẩn hóa vượt 40 MiB.');
  const hash=await computeSha256(glb);
  const id=generateUUID(),dimensionsMm=[size.x*1000,size.z*1000,size.y*1000].map(n=>+n.toFixed(3));
  const asset={id,name:file.name.replace(/\.[^.]+$/,''),sourceName:file.name,sourceFormat:ext,sourceUnit:actualUnit,sourceUp:actualUp,origin,dimensionsMm,triangles:Math.round(triangles),vertices,meshes,sha256:hash,bytes:glb.byteLength,blob:new Blob([glb],{type:'model/gltf-binary'}),original:file,createdAt:new Date().toISOString(),status:'local',mechanical:{},electrical:{}};
  return {asset,object:wrapper,warnings:[...(triangles>150000?['Mesh nặng trên điện thoại. Nên giảm xuống dưới 150.000 tam giác.']:[]),...(origin==='ai'?['AI visual: kích thước được ước lượng; chưa có thông số CAD chính xác.']:[]),...(ext==='obj'&&!hadMtl?['OBJ không kèm MTL: dùng vật liệu trung tính.']:[])]};
 }catch(error){releaseObject(normalized||source);throw error;}finally{urls.forEach(u=>URL.revokeObjectURL(u));}
}
export async function assetVisual(id){
 if(!cache.has(id))cache.set(id,(async()=>{const a=await getAsset(id);if(!a)throw Error('Thiếu GLB cục bộ. Import lại file hoặc tải từ cộng đồng.');return (await new GLTFLoader().parseAsync(await a.blob.arrayBuffer(),'')).scene;})().catch(e=>{cache.delete(id);throw e;}));
 const original=await cache.get(id);const copy=original.clone(true);
 copy.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});
 copy.scale.multiplyScalar(10);return copy; // canonical meters -> engine (1 unit = 100 mm)
}
