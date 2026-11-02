import defaultAssembly from '../data/assembly.json';
import catalogData from '../data/components.json';
import {validateProjectShape,instanceComponent} from './engineering.js';
let custom=[];
try{custom=JSON.parse(localStorage.getItem('space-lot-custom-catalog')||'[]').filter(c=>c.assetId&&/^asset-[a-f0-9-]+$/.test(c.id)&&Array.isArray(c.dimensionsMm)&&c.dimensionsMm.length===3&&c.dimensionsMm.every(v=>Number.isFinite(v)&&v>=0));}catch{}
export const catalog=[...catalogData.components,...custom];
const STORAGE_KEY='aeroguide-builder-v0.1';
export const defaultProject=()=>structuredClone(defaultAssembly);
function restore() {
  try {
    const saved=localStorage.getItem(STORAGE_KEY);
    return saved ? validateProjectShape(JSON.parse(saved),catalog) : defaultProject();
  } catch { return defaultProject(); }
}
export const store = {
  registerAsset(asset){
    const descriptor={id:'asset-'+asset.id,assetId:asset.id,name:asset.name,category:'custom',subtitle:asset.origin==='ai'?'AI visual · unverified specifications':'Imported mesh · unverified specifications',dimensionsMm:asset.dimensionsMm,massG:asset.massG??null,ports:[],origin:asset.origin};
    const index=catalog.findIndex(c=>c.id===descriptor.id);if(index<0)catalog.push(descriptor);else catalog[index]=descriptor;
    localStorage.setItem('space-lot-custom-catalog',JSON.stringify(catalog.filter(c=>c.assetId)));
  },
  project:restore(), selectedId:'fc-1', activeCategory:'all', search:'', tool:'select',
  mode:'assembly', explode:0, showLabels:true, showClearance:false, highlightedWire:'all',
  subscribers:new Set(),
  subscribe(fn){this.subscribers.add(fn);return()=>this.subscribers.delete(fn);},
  changed(save=true){
    if(save)try{localStorage.setItem(STORAGE_KEY,JSON.stringify(this.project));}catch{};
    for(const fn of this.subscribers) fn();
  },
  select(id){this.selectedId=id;this.changed(false);},
  move(id,position){
    const p=this.project.instances.find(i=>i.id===id);if(!p)return;
    const pos=position.map(x=>Math.max(-5000,Math.min(5000,Math.round(x))));
    const kind=instanceComponent(catalog,p)?.category;
    const frame=this.project.instances.find(i=>instanceComponent(catalog,i)?.category==='frame');
    const anchors=frame && instanceComponent(catalog,frame)?.anchors;
    const framePosition=frame?.positionMm??[0,0,0];
    let locations=[];
    if(kind==='fc' && anchors?.flightController) locations=[anchors.flightController];
    if(['motor','prop','esc'].includes(kind) && anchors?.motors){
      locations=kind==='esc'?anchors.motors.map(a=>[a[0]*.56,a[1]*.56,a[2]]):anchors.motors;
    }
    let nearest=null,distance=Infinity;
    for(const a of locations){const x=a[0]+framePosition[0],y=a[1]+framePosition[1];const d=Math.hypot(x-pos[0],y-pos[1]);if(d<distance){distance=d;nearest=[x,y];}}
    if(nearest && distance<20){pos[0]=Math.round(nearest[0]);pos[1]=Math.round(nearest[1]);}
    p.positionMm=pos;this.changed();
  },
  remove(id){if(!id)return;this.project.instances=this.project.instances.filter(x=>x.id!==id);this.project.connections=this.project.connections.filter(x=>x.from!==id&&x.to!==id);this.selectedId=null;this.changed();},
  add(componentId, initialPosition = null){
    const component=catalog.find(c=>c.id===componentId);
    if(!component || this.project.instances.length>=80)return null;
    const existing=this.project.instances.filter(i=>i.componentId===componentId);
    const id=`${component.category}-${Date.now().toString(36)}-${existing.length+1}`;
    let position=[0,0,80];
    const frame=this.project.instances.find(i=>instanceComponent(catalog,i)?.category==='frame');
    const frameModel=frame && instanceComponent(catalog,frame);
    if(['motor','prop','esc'].includes(component.category) && frameModel?.anchors?.motors){
      const peers=this.project.instances.filter(i=>instanceComponent(catalog,i)?.category===component.category);
      const anchor=frameModel.anchors.motors[Math.min(peers.length,3)];
      if(anchor){
        position=component.category==='esc'?[Math.round(anchor[0]*0.56),Math.round(anchor[1]*0.56),7]:[anchor[0],anchor[1],component.category==='motor'?24:45];
      }
    }
    if(component.category==='fc')position=[0,0,23];
    if(component.category==='battery')position=[-10,0,51];
    if (initialPosition && Array.isArray(initialPosition) && initialPosition.length === 3) {
      position = initialPosition.map(x => Math.max(-5000, Math.min(5000, Math.round(Number(x) || 0))));
    }
    const instance={id,componentId,positionMm:position};
    this.project.instances.push(instance);this.selectedId=id;this.changed();return instance;
  },
  getDefaultPosition(componentId){
    const component=catalog.find(c=>c.id===componentId);
    if(!component) return [0, 0, 0];
    let position=[0,0,80];
    const frame=this.project.instances.find(i=>instanceComponent(catalog,i)?.category==='frame');
    const frameModel=frame && instanceComponent(catalog,frame);
    if(['motor','prop','esc'].includes(component.category) && frameModel?.anchors?.motors){
      const peers=this.project.instances.filter(i=>instanceComponent(catalog,i)?.category===component.category);
      const anchor=frameModel.anchors.motors[Math.min(peers.length,3)];
      if(anchor){
        position=component.category==='esc'?[Math.round(anchor[0]*0.56),Math.round(anchor[1]*0.56),7]:[anchor[0],anchor[1],component.category==='motor'?24:45];
      }
    }
    if(component.category==='fc')position=[0,0,23];
    if(component.category==='battery')position=[-10,0,51];
    return position;
  },
  reset(){this.project=defaultProject();this.selectedId='fc-1';this.explode=0;this.mode='assembly';this.tool='select';this.changed();},
  import(project){this.project=validateProjectShape(project,catalog);this.selectedId=null;this.explode=0;this.changed();},
  addWire(from,fromPort,to,toPort){
    const src=this.project.instances.find(x=>x.id===from);const source=src && instanceComponent(catalog,src);const port=source?.ports?.find(p=>p.id===fromPort);
    const kind=['power','battery-power'].includes(port?.signal)?'power':'signal';
    const wire={id:`wire-${Date.now().toString(36)}`,from,fromPort,to,toPort,kind,label:`${from}:${fromPort} → ${to}:${toPort}`};
    this.project.connections.push(wire);this.changed();
  },
  removeWire(id){this.project.connections=this.project.connections.filter(w=>w.id!==id);this.changed();}
};
