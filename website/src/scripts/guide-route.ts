interface Point { x:number; y:number; }
interface Rect { left:number; right:number; top:number; bottom:number; }
export interface GuideRoute { points:Point[]; distances:number[]; length:number; }

/** Route the little walking guide through whitespace, including the outer margin on narrow screens. */
export function guideRoutes(stops:Point[], width:number, height:number, size:number, obstacles:Rect[]):GuideRoute[] {
  const step=18, edge=36, cols=Math.ceil((width+edge*2)/step)+1, rows=Math.ceil(height/step)+1;
  const blocked=new Uint8Array(cols*rows);
  const clearance=size*.36+6;
  const padding=clearance+12;
  const directions=[[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  const cell=(p:Point)=>Math.min(rows-1,Math.max(0,Math.round(p.y/step)))*cols+Math.min(cols-1,Math.max(0,Math.round((p.x+edge)/step)));
  const point=(index:number):Point=>({x:(index%cols)*step-edge,y:Math.floor(index/cols)*step});
  for(const rect of obstacles){
    const left=Math.max(0,Math.floor((rect.left-padding+edge)/step));
    const right=Math.min(cols-1,Math.ceil((rect.right+padding+edge)/step));
    const top=Math.max(0,Math.floor((rect.top-padding)/step));
    const bottom=Math.min(rows-1,Math.ceil((rect.bottom+padding)/step));
    for(let y=top;y<=bottom;y++)blocked.fill(1,y*cols+left,y*cols+right+1);
  }
  const freeLine=(a:Point,b:Point)=>{
    const count=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(step/2));
    for(let i=1;i<count;i++)if(blocked[cell({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count})])return false;
    return true;
  };
  return stops.slice(1).map((end,index)=>{
    const start=stops[index],first=cell(start),last=cell(end);
    // Resting places are measured in dedicated empty slots.
    blocked[first]=0;blocked[last]=0;
    const parents=new Int32Array(blocked.length).fill(-1),queue=new Uint32Array(blocked.length);
    let head=0,tail=1;queue[0]=first;parents[first]=first;
    while(head<tail&&parents[last]<0){
      const current=queue[head++],x=current%cols,y=Math.floor(current/cols);
      for(const [dx,dy] of directions){
        const nx=x+dx,ny=y+dy,next=ny*cols+nx;
        if(nx<0||nx>=cols||ny<0||ny>=rows||blocked[next]||parents[next]>=0)continue;
        if(dx&&dy&&(blocked[y*cols+nx]||blocked[ny*cols+x]))continue;
        parents[next]=current;queue[tail++]=next;
      }
    }
    const raw:Point[]=[];
    if(parents[last]>=0){
      for(let current=last;current!==first;current=parents[current])raw.push(point(current));
      raw.push(start);raw.reverse();raw[raw.length-1]=end;
    }else{
      // A completely blocked layout still has a route around its outside edge.
      raw.push(start,{x:-edge,y:start.y},{x:-edge,y:end.y},end);
    }
    const points=[raw[0]];
    for(let i=0;i<raw.length-1;){
      let next=raw.length-1;while(next>i+1&&!freeLine(raw[i],raw[next]))next--;
      points.push(raw[next]);i=next;
    }
    const rounded=roundCorners(points, p => obstacles.every(r => p.x<r.left-clearance || p.x>r.right+clearance || p.y<r.top-clearance || p.y>r.bottom+clearance));
    const distances=[0];
    for(let i=1;i<rounded.length;i++)distances.push(distances[i-1]+Math.hypot(rounded[i].x-rounded[i-1].x,rounded[i].y-rounded[i-1].y));
    return {points:rounded,distances,length:distances[distances.length-1]};
  });
}

/** Tangent-aligned cubic Bézier fillets soften turns without cutting through content. */
function roundCorners(points:Point[], safe:(point:Point)=>boolean):Point[] {
  const rounded=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1];
    const incoming=Math.hypot(b.x-a.x,b.y-a.y),outgoing=Math.hypot(c.x-b.x,c.y-b.y);
    if(incoming<1||outgoing<1)continue;
    let radius=Math.min(80,incoming*.35,outgoing*.35);
    let curve:Point[]=[];
    while(radius>1){
      const enter={x:b.x+(a.x-b.x)*radius/incoming,y:b.y+(a.y-b.y)*radius/incoming};
      const exit={x:b.x+(c.x-b.x)*radius/outgoing,y:b.y+(c.y-b.y)*radius/outgoing};
      const controlA={x:enter.x+(b.x-enter.x)*2/3,y:enter.y+(b.y-enter.y)*2/3};
      const controlB={x:exit.x+(b.x-exit.x)*2/3,y:exit.y+(b.y-exit.y)*2/3};
      curve=Array.from({length:25},(_,step)=>{
        const t=step/24,u=1-t;
        return {x:u*u*u*enter.x+3*u*u*t*controlA.x+3*u*t*t*controlB.x+t*t*t*exit.x,
          y:u*u*u*enter.y+3*u*u*t*controlA.y+3*u*t*t*controlB.y+t*t*t*exit.y};
      });
      if(curve.every(safe))break;
      radius*=.5;curve=[];
    }
    rounded.push(...(curve.length?curve:[b]));
  }
  rounded.push(points[points.length-1]);
  return rounded;
}

/** cubic-bezier(.45, 0, .25, 1): unhurried departure, longer deceleration. */
export function easeGuide(progress:number):number {
  if(progress<=0)return 0;
  if(progress>=1)return 1;
  let low=0,high=1,t=progress;
  for(let i=0;i<14;i++){
    const u=1-t,x=3*u*u*t*.45+3*u*t*t*.25+t*t*t;
    if(x<progress)low=t;else high=t;
    t=(low+high)/2;
  }
  return 3*(1-t)*t*t+t*t*t;
}

export function pointOnRoute(route:GuideRoute,progress:number):Point {
  if(route.points.length<2)return route.points[0];
  const distance=route.length*progress;
  let index=1;while(index<route.distances.length-1&&route.distances[index]<distance)index++;
  const a=route.points[index-1],b=route.points[index];
  const t=(distance-route.distances[index-1])/Math.max(1,route.distances[index]-route.distances[index-1]);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
