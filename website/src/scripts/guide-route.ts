interface Point { x:number; y:number; }
interface Rect { left:number; right:number; top:number; bottom:number; }
export interface GuideRoute { points:Point[]; distances:number[]; length:number; }

/** Route the little walking guide through whitespace, including the outer margin on narrow screens. */
export function guideRoutes(stops:Point[], width:number, height:number, size:number, obstacles:Rect[]):GuideRoute[] {
  const step=18, edge=36, cols=Math.ceil((width+edge*2)/step)+1, rows=Math.ceil(height/step)+1;
  const blocked=new Uint8Array(cols*rows);
  const padding=size*.36+6;
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
    const distances=[0];
    for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
    return {points,distances,length:distances[distances.length-1]};
  });
}

export function pointOnRoute(route:GuideRoute,progress:number):Point {
  const distance=route.length*progress;
  let index=1;while(index<route.distances.length-1&&route.distances[index]<distance)index++;
  const a=route.points[index-1],b=route.points[index];
  const t=(distance-route.distances[index-1])/Math.max(1,route.distances[index]-route.distances[index-1]);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
