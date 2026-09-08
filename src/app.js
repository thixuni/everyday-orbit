(function(){
"use strict";
/* ============ utilities ============ */
const $=s=>document.querySelector(s);
const el=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=p=>p+"_"+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseD=s=>{const p=String(s).split("-").map(Number);return new Date(p[0],p[1]-1,p[2]);};
const addDays=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x;};
const startOfWeek=d=>addDays(d,-((d.getDay()+6)%7));
const today=()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());};
const TODAY=()=>ymd(today());
const dayDiff=(a,b)=>Math.round((parseD(a)-parseD(b))/864e5);
const MON=["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOWS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const icon=(n,c)=>'<svg class="ic '+(c||"")+'" aria-hidden="true"><use href="#'+n+'"/></svg>';
const fmtDate=s=>{if(!s)return"";const d=parseD(s);return d.getDate()+" "+MONS[d.getMonth()]+(d.getFullYear()!==today().getFullYear()?" "+d.getFullYear():"");};
const fmtTime=t=>{if(!t)return"";const[h,m]=t.split(":").map(Number);const ap=h>=12?"pm":"am";const hh=h%12===0?12:h%12;return hh+(m?":"+pad(m):"")+ap;};
const relDue=s=>{if(!s)return"No date";const d=dayDiff(s,TODAY());if(d===0)return"Today";if(d===1)return"Tomorrow";if(d===-1)return"Yesterday";if(d<0)return Math.abs(d)+"d overdue";if(d<7)return"In "+d+"d";return fmtDate(s);};
const stripHtml=h=>{const t=document.createElement("div");t.innerHTML=String(h||"").replace(/<\/(p|div|h[1-6]|li|blockquote|ul|ol|tr)>/gi,"$& ");return (t.textContent||"").replace(/\s+/g," ").trim();};

/* ============ constants ============ */
const STATUSES=[
 {id:"backlog",name:"Backlog",color:"#9AA298"},
 {id:"planned",name:"Planned",color:"#4C6FE0"},
 {id:"in_progress",name:"In Progress",color:"#D99A16"},
 {id:"review",name:"Waiting for Review",color:"#7C5CE0"},
 {id:"completed",name:"Completed",color:"#3F7D5C"},
 {id:"dropped",name:"Dropped",color:"#C25340"}];
const ST=id=>STATUSES.find(s=>s.id===id)||STATUSES[0];
const QUADS=[
 {id:"do",name:"Do First",tag:"Urgent + Important",note:"Do these tasks immediately.",cls:"q-do",icon:"i-bolt"},
 {id:"decide",name:"Schedule",tag:"Important, not urgent",note:"Schedule time to work on these.",cls:"q-decide",icon:"i-calendar"},
 {id:"delegate",name:"Delegate",tag:"Urgent, not important",note:"Hand these to someone else.",cls:"q-delegate",icon:"i-user"},
 {id:"drop",name:"Eliminate",tag:"Neither",note:"Drop or ignore these.",cls:"q-drop",icon:"i-x"}];
const quadOf=t=>{if(t.urgent==null||t.important==null)return null;if(t.urgent&&t.important)return"do";if(!t.urgent&&t.important)return"decide";if(t.urgent&&!t.important)return"delegate";return"drop";};
const CAT_ICONS=["i-briefcase","i-laptop","i-home","i-user","i-target","i-heart","i-circle","i-flame","i-paw","i-rocket","i-book","i-star","i-cart","i-music","i-plane","i-dumbbell","i-leaf","i-coffee","i-palette","i-note"];
const CAT_COLORS=["#4C6FE0","#7C5CE0","#E0854A","#D95C93","#2F9C86","#D8544E","#7A8A80","#D99A16","#A9713B","#3F8F4F","#2E8BA8","#B0517E"];
const OPEN=["backlog","planned","in_progress","review"];

/* ============ starting data ============ */
function baseCategories(){
  return [
   {id:"office",name:"Office",icon:"i-briefcase",color:"#4C6FE0"},
   {id:"freelance",name:"Freelance",icon:"i-laptop",color:"#7C5CE0"},
   {id:"home",name:"Home",icon:"i-home",color:"#E0854A"},
   {id:"personal",name:"Personal",icon:"i-user",color:"#D95C93"},
   {id:"goals",name:"Goals",icon:"i-target",color:"#2F9C86"},
   {id:"hubby",name:"Hubby",icon:"i-heart",color:"#D8544E"},
   {id:"passion",name:"Passion",icon:"i-flame",color:"#D99A16"},
   {id:"pets",name:"Pets",icon:"i-paw",color:"#A9713B"},
   {id:"side",name:"Side Hustle",icon:"i-rocket",color:"#3F8F4F"},
   {id:"other",name:"Other",icon:"i-circle",color:"#7A8A80"}];
}
function blankState(){
  return {categories:baseCategories(),tasks:[],routines:[],notes:[],completions:{},
    prefs:{hidden:[],scratch:"",owner:"",setup:false}};
}
function sampleState(){
  const st=blankState(),o=n=>ymd(addDays(today(),n));
  const T=(title,due,cat,status,u,i,extra)=>Object.assign({id:uid("t"),title:title,desc:"",due:due,cat:cat,status:status,
    urgent:u,important:i,subtasks:[],created:o(-4),completedAt:status==="completed"?due:null},extra||{});
  st.tasks=[
   T("Reply to the emails still sitting in the inbox",o(-1),"office","planned",true,true),
   T("Send the invoice for last month",o(0),"freelance","in_progress",true,true),
   T("Draft the project brief",o(2),"office","planned",false,true,
     {desc:"One page: the problem, who it is for, and how we will know it worked.",
      subtasks:[{id:uid("s"),t:"Collect the background notes",d:true},{id:uid("s"),t:"Write the first pass",d:false},{id:uid("s"),t:"Send it round for comments",d:false}]}),
   T("Book the dentist",o(1),"personal","backlog",true,false),
   T("Tidy the desk",o(3),"home","backlog",false,false),
   T("Buy a birthday gift",o(5),"other","planned",false,true),
   T("Plan next month's goals",o(6),"goals","backlog",null,null),
   T("Renew the gym membership",o(-3),"personal","completed",false,true)];
  const R=(title,cat,days,time,dur)=>({id:uid("r"),title:title,cat:cat,freq:"weekly",days:days,every:2,
    time:time,dur:dur,start:o(-28),end:"",active:true,note:""});
  st.routines=[
   R("Morning stand-up","office",[1,2,3,4,5],"09:30",15),
   R("Deep work block","office",[1,2,3,4,5],"10:00",90),
   R("Evening walk","goals",[1,2,3,4,5,6,0],"18:30",30),
   R("Weekly review","goals",[5],"16:00",45),
   R("Water the plants","home",[1,4],"08:00",10)];
  st.routines.forEach(function(r){
    for(var i=1;i<=5;i++){var d=addDays(today(),-i);
      if(r.days.indexOf(d.getDay())>-1&&i!==2)st.completions[r.id+"|"+ymd(d)]=true;}
  });
  st.notes=[
   {id:uid("n"),title:"How this planner works",cat:"personal",tags:["start-here"],pinned:true,updated:Date.now(),
    html:"<p>Five sections, all sharing the same tasks and categories.</p>"+
      "<h2>Calendar</h2><p>Your default view. Tasks sit in the band across the top, routines sit in the time grid. The <b>Catch-up</b> panel on the right collects anything overdue so you can clear it in one place.</p>"+
      "<h2>Tasks</h2><p>A board you can drag cards across, or a list grouped by month. Quick filters sit on one row, and Advanced opens status, category, priority and date range.</p>"+
      "<h2>Matrix</h2><p>Every task lands in a quadrant based on whether it is urgent, important, both or neither. Closest due date comes first. Anything you have not judged yet waits in the tray at the bottom.</p>"+
      "<h2>Routines</h2><p>Anything that repeats: daily, weekdays, chosen days, or every few days. Tick the day squares to keep a streak going.</p>"+
      "<h2>Notes</h2><p>Write freely, tag by category, and turn any line into an action item. Action items become real tasks on your board and calendar.</p>"+
      "<p><b>Your data stays on this device</b>, in this browser. Use the download icon at the bottom of the sidebar to back it up, and the upload icon to restore it or move it to another computer.</p>",
    actions:[{id:uid("a"),t:"Add your own first task",done:false,taskId:null}]},
   {id:uid("n"),title:"Parking lot",cat:"goals",tags:["ideas"],pinned:false,updated:Date.now()-864e5,
    html:"<p>Somewhere to put the things that are not tasks yet.</p><ul><li>Somewhere to keep half-formed ideas</li><li>Books worth getting to</li></ul>",actions:[]}];
  st.prefs.setup=true;
  return st;
}

/* ============ state + persistence ============ */
const KEYS=["categories","tasks","routines","notes","completions","prefs"];
let S=blankState();
let db=null,dirty={},timers={},suppress={},touched={};
const LS="everyday-orbit-v1";
function loadLocal(){try{const raw=localStorage.getItem(LS);if(!raw)return false;const o=JSON.parse(raw);KEYS.forEach(k=>{if(o[k])S[k]=o[k];});return true;}catch(e){return false;}}
let storageOK=true;
function saveLocal(){try{const o={};KEYS.forEach(k=>o[k]=S[k]);localStorage.setItem(LS,JSON.stringify(o));storageOK=true;}catch(e){storageOK=false;}}
function setSync(state,label){
  const n=el("sync");if(!n)return;
  if(!storageOK&&!db){state="warn";label="This browser is blocking storage — back up often";}
  n.className="sync"+(state==="warn"?" warn":"");n.title=label;n.lastElementChild.textContent=label;
}
function bodyFor(k){
  if(k==="completions")return {list:Object.keys(S.completions||{})};
  if(k==="prefs")return {v:S.prefs};
  return {items:S[k]};
}
function save(key){
  dirty[key]=true;touched[key]=true;saveLocal();setSync("warn","Saving…");
  clearTimeout(timers[key]);
  timers[key]=setTimeout(()=>{
    timers[key]=null;
    if(!db){setSync("ok","Saved on this device");dirty[key]=false;return;}
    const body=bodyFor(key);
    suppress[key]=Date.now();
    db.doc("state/"+key).set(body).then(()=>{dirty[key]=false;setSync("ok","All changes saved");})
      .catch(()=>{dirty[key]=false;setSync("warn","Saved on this device");});
  },500);
}
function readDoc(key,snap){
  if(!snap||!snap.exists)return;
  const d=snap.data()||{};
  if(key==="completions"){
    if(Array.isArray(d.list)){const m={};d.list.forEach(k=>{m[k]=true;});S.completions=m;}
    else if(d.map&&typeof d.map==="object")S.completions=d.map;
  }
  else if(key==="prefs"&&d.v)S.prefs=Object.assign({hidden:[],scratch:""},d.v);
  else if(d.items)S[key]=d.items;
}
async function connect(){
  let cap=null;
  try{cap=window.claude&&claude.use?await claude.use("db"):null;}catch(e){cap=null;}
  if(!cap){setSync("warn","Saved on this device");return;}
  db=cap;
  try{
    const meta=await db.doc("state/meta").get();
    if(!meta.exists){
      await db.doc("state/meta").set({seeded:true,v:1,at:new Date().toISOString()});
      for(const k of KEYS)await db.doc("state/"+k).set(bodyFor(k));
    }else{
      const snaps=await Promise.all(KEYS.map(k=>db.doc("state/"+k).get()));
      KEYS.forEach((k,i)=>{if(!touched[k])readDoc(k,snaps[i]);});
      if(S.prefs.setup||S.tasks.length||S.routines.length||S.notes.length)closeWelcome();
      saveLocal();render();
    }
    setSync("ok","All changes saved");
    KEYS.forEach(k=>{
      db.doc("state/"+k).onSnapshot(snap=>{
        if(dirty[k]||timers[k])return;
        if(suppress[k]&&Date.now()-suppress[k]<8000)return;
        if(snap.metadata&&snap.metadata.hasPendingWrites)return;
        readDoc(k,snap);saveLocal();render();
      },()=>{});
    });
  }catch(e){setSync("warn","Saved on this device");}
}

/* ============ derived helpers ============ */
const cat=id=>S.categories.find(c=>c.id===id)||{id:"",name:"Uncategorised",icon:"i-circle",color:"#7A8A80"};
function hiddenCats(){
  if(!S.prefs||typeof S.prefs!=="object")S.prefs={hidden:[],scratch:""};
  if(!Array.isArray(S.prefs.hidden))S.prefs.hidden=[];
  return S.prefs.hidden;
}
const visibleCat=id=>hiddenCats().indexOf(id)===-1;
function toggleCat(id,force){
  const h=hiddenCats(),i=h.indexOf(id),show=force==null?i>-1:force;
  if(show){if(i>-1)h.splice(i,1);}else if(i===-1)h.push(id);
  touched.prefs=true;save("prefs");render();refreshCatsModal();
}
function refreshCatsModal(){const r=el("modalRoot");if(r&&r.querySelector('[data-act="cat-del"]'))catsModal();}
const taskById=id=>S.tasks.find(t=>t.id===id);
const routineById=id=>S.routines.find(r=>r.id===id);
const noteById=id=>S.notes.find(n=>n.id===id);
const isOpen=t=>OPEN.indexOf(t.status)>-1;
const isOverdue=t=>isOpen(t)&&t.due&&dayDiff(t.due,TODAY())<0;
function routineOn(r,d){
  if(!r.active)return false;
  const s=ymd(d);
  if(r.start&&s<r.start)return false;
  if(r.end&&s>r.end)return false;
  if(r.freq==="interval"){const n=Math.max(1,r.every||2);return Math.floor((parseD(s)-parseD(r.start||s))/864e5)%n===0;}
  return (r.days||[]).indexOf(d.getDay())>-1;
}
const doneR=(r,s)=>!!S.completions[r.id+"|"+s];
function matchQ(t,q){
  if(!q)return true;q=q.toLowerCase();
  return (t.title||"").toLowerCase().indexOf(q)>-1||(t.desc||"").toLowerCase().indexOf(q)>-1||
    cat(t.cat).name.toLowerCase().indexOf(q)>-1||(t.subtasks||[]).some(s=>s.t.toLowerCase().indexOf(q)>-1);
}
function streak(r){
  let n=0;for(let i=0;i<180;i++){const d=addDays(today(),-i);if(!routineOn(r,d))continue;if(doneR(r,ymd(d)))n++;else if(i>0)break;else continue;}
  return n;
}
function overdueItems(){
  const tasks=S.tasks.filter(t=>isOverdue(t)&&visibleCat(t.cat)).sort((a,b)=>a.due<b.due?-1:1);
  const miss=[];
  S.routines.filter(r=>visibleCat(r.cat)).forEach(r=>{
    for(let i=1;i<=7;i++){const d=addDays(today(),-i),s=ymd(d);
      if(routineOn(r,d)&&!doneR(r,s))miss.push({r:r,date:s});}
  });
  miss.sort((a,b)=>a.date<b.date?1:-1);
  return {tasks:tasks,miss:miss.slice(0,12)};
}

/* ============ view state ============ */
const V={view:"calendar",calMode:"week",anchor:today(),taskMode:"board",q:"",odOpen:true,adv:false,
  f:{quick:"open",status:"",cat:"",quad:"",from:"",to:"",sort:"due"},noteId:null,noteTag:""};

/* ============ rail + topbar ============ */
const NAV=[{id:"calendar",name:"Calendar",icon:"i-calendar"},{id:"tasks",name:"Tasks",icon:"i-board"},
 {id:"matrix",name:"Matrix",icon:"i-grid"},{id:"routines",name:"Routines",icon:"i-repeat"},{id:"notes",name:"Notes",icon:"i-note"}];
function navCount(id){
  if(id==="calendar"){const o=overdueItems();return o.tasks.length+o.miss.length;}
  if(id==="tasks")return S.tasks.filter(isOpen).length;
  if(id==="matrix")return S.tasks.filter(t=>isOpen(t)&&quadOf(t)==="do").length;
  if(id==="routines")return S.routines.filter(r=>routineOn(r,today())&&!doneR(r,TODAY())).length;
  return S.notes.length;
}
/* On a narrow screen the rail is a drawer over the view; on a wide one the
   class is inert because the rail is always in the layout. */
function closeRail(){document.body.classList.remove("rail-open");}

function renderRail(){
  const bs=el("brandSub");if(bs)bs.textContent=(S.prefs&&S.prefs.owner)?S.prefs.owner:"Personal planner";
  el("nav").innerHTML=NAV.map(n=>{const c=navCount(n.id);
    return '<button class="nav-btn" data-act="view" data-view="'+n.id+'" aria-current="'+(V.view===n.id)+'" title="'+esc(n.name)+'">'+icon(n.icon,"ic-18")+'<span>'+esc(n.name)+'</span>'+(c?'<span class="count num">'+c+'</span>':'')+'</button>';}).join("");
  const hid=hiddenCats().length;
  el("railHead").innerHTML='<span class="grow">Categories</span>'+
    (hid?'<button class="txt" data-act="cat-all" title="Show every category">Show all</button>'
        :'<button class="txt" data-act="cat-none" title="Hide every category">None</button>')+
    '<button data-act="manage-cats" title="Manage categories" aria-label="Manage categories">'+icon("i-settings","ic-14")+'</button>';
  el("catList").innerHTML=S.categories.map(c=>{const off=!visibleCat(c.id);
    return '<button class="cat-row'+(off?" off":"")+'" style="--c:'+c.color+'" data-act="cat-toggle" data-id="'+c.id+'" role="switch" aria-checked="'+(!off)+'" title="'+esc(off?"Show":"Hide")+' '+esc(c.name)+'">'+
      '<span class="cat-box">'+icon("i-check")+'</span>'+icon(c.icon,"ic-14 ic-cat")+'<span class="cname">'+esc(c.name)+'</span></button>';}).join("");
}
function topSearch(ph){
  return '<div class="search">'+icon("i-search")+'<input id="q" type="search" placeholder="'+esc(ph)+'" value="'+esc(V.q)+'" aria-label="Search"></div>';
}
function renderTopbar(){
  const open=S.tasks.filter(isOpen),over=S.tasks.filter(isOverdue);
  let title="",sub="",right="";
  if(V.view==="calendar"){
    title="Calendar";
    sub=V.calMode==="week"?"Week of "+fmtDate(ymd(startOfWeek(V.anchor))):MON[V.anchor.getMonth()]+" "+V.anchor.getFullYear();
    right=topSearch("Search tasks and routines")+'<button class="btn btn-primary" data-act="new-task">'+icon("i-plus")+'New task</button>';
  }else if(V.view==="tasks"){
    title="Tasks";sub=open.length+" open"+(over.length?" · "+over.length+" overdue":"")+" · "+S.tasks.length+" total";
    right='<div class="seg"><button data-act="task-mode" data-mode="board" aria-pressed="'+(V.taskMode==="board")+'">'+icon("i-board")+'Board</button>'+
      '<button data-act="task-mode" data-mode="list" aria-pressed="'+(V.taskMode==="list")+'">'+icon("i-list")+'List</button></div>'+
      topSearch("Search tasks")+'<button class="btn btn-primary" data-act="new-task">'+icon("i-plus")+'New task</button>';
  }else if(V.view==="matrix"){
    title="Eisenhower Matrix";sub="Open tasks by urgency and importance, closest due date first";
    right=topSearch("Search tasks")+'<button class="btn btn-primary" data-act="new-task">'+icon("i-plus")+'New task</button>';
  }else if(V.view==="routines"){
    const due=S.routines.filter(r=>routineOn(r,today())).length,done=S.routines.filter(r=>routineOn(r,today())&&doneR(r,TODAY())).length;
    title="Routines & Habits";sub=S.routines.length+" routines · "+done+" of "+due+" done today";
    right=topSearch("Search routines")+'<button class="btn btn-primary" data-act="new-routine">'+icon("i-plus")+'New routine</button>';
  }else{
    title="Notes";sub=S.notes.length+" notes · action items land in your tasks and calendar";
    right=topSearch("Search notes")+'<button class="btn" data-act="scratch">'+icon("i-bolt")+'Scratch pad</button>'+
      '<button class="btn btn-primary" data-act="new-note">'+icon("i-plus")+'New note</button>';
  }
  const hid=hiddenCats().length;
  const notice=hid?'<button class="filter-pill on" data-act="cat-all" title="Show all categories again">'+icon("i-filter")+hid+(hid===1?" category":" categories")+' hidden'+icon("i-x","ic-14")+'</button>':"";
  const menu='<button class="rail-toggle" data-act="rail" aria-label="Show the sidebar" title="Sidebar">'+icon("i-menu","ic-18")+'</button>';
  el("topbar").innerHTML=menu+'<div class="title-wrap"><h1>'+title+'</h1><p>'+esc(sub)+'</p></div><div class="spacer"></div>'+notice+right;
}

/* ============ shared fragments ============ */
function catChip(id){const c=cat(id);return '<span class="chip chip-cat" style="--c:'+c.color+'">'+icon(c.icon)+esc(c.name)+'</span>';}
function dueChip(t){
  if(!t.due)return"";
  const d=dayDiff(t.due,TODAY());const k=isOpen(t)?(d<0?"over":(d<=1?"soon":"")):"";
  return '<span class="chip chip-due '+k+'">'+icon("i-clock")+esc(relDue(t.due))+'</span>';
}
function quadChip(t){const q=quadOf(t);if(!q)return"";const Q=QUADS.find(x=>x.id===q);
  return '<span class="chip chip-q '+Q.cls+'">'+esc(Q.name)+'</span>';}
function tickBtn(t){return '<button class="tick'+(t.status==="completed"?" on":"")+'" data-act="task-done" data-id="'+t.id+'" aria-label="Mark complete" title="Mark complete">'+icon("i-check")+'</button>';}

/* ============ calendar ============ */
function eventsFor(d){
  const s=ymd(d);
  return S.routines.filter(r=>visibleCat(r.cat)&&routineOn(r,d)).map(r=>{
    const[h,m]=(r.time||"09:00").split(":").map(Number);
    return {r:r,start:h*60+m,dur:r.dur||30,date:s,done:doneR(r,s)};
  }).sort((a,b)=>a.start-b.start);
}
function layoutEvents(evs){
  const out=[];let cluster=[],end=-1;
  evs.forEach(e=>{
    if(cluster.length&&e.start>=end){flush();}
    cluster.push(e);end=Math.max(end,e.start+e.dur);
  });
  flush();
  function flush(){
    if(!cluster.length)return;
    const cols=[];
    cluster.forEach(e=>{
      let i=0;while(cols[i]&&cols[i]>e.start)i++;
      cols[i]=e.start+e.dur;e._c=i;
    });
    const n=cols.length;cluster.forEach(e=>{e._n=n;out.push(e);});
    cluster=[];end=-1;
  }
  return out;
}
function tasksFor(s){
  return S.tasks.filter(t=>t.due===s&&visibleCat(t.cat)&&matchQ(t,V.q)&&t.status!=="dropped");
}
const H0=6,H1=24,PX=48;
function weekGrid(){
  const start=startOfWeek(V.anchor),days=[];for(let i=0;i<7;i++)days.push(addDays(start,i));
  const tstr=TODAY();
  let head='<div class="wk-head"><div class="corner"></div>'+days.map(d=>{const s=ymd(d);
    return '<div class="dcol'+(s===tstr?" today":"")+'"><div class="dow">'+DOWS[(d.getDay()+6)%7]+'</div><div class="dnum num">'+d.getDate()+'</div></div>';}).join("")+'</div>';
  let ad='<div class="allday"><div class="lab">Tasks</div>'+days.map(d=>{const s=ymd(d);
    const ts=tasksFor(s);
    return '<div class="ad-cell'+(s===tstr?" today":"")+'" data-act="new-task" data-date="'+s+'">'+ts.map(t=>{const c=cat(t.cat);
      return '<button class="tchip'+(t.status==="completed"?" done":"")+(isOverdue(t)?" over":"")+'" style="--c:'+c.color+'" data-act="task" data-id="'+t.id+'" data-stop="1">'+icon(c.icon)+'<span>'+esc(t.title)+'</span></button>';}).join("")+'</div>';}).join("")+'</div>';
  let hours="";for(let h=H0;h<H1;h++)hours+='<div class="hourlab num">'+fmtTime(pad(h)+":00")+'</div>';
  const cols=days.map(d=>{
    const s=ymd(d);let lines="";for(let h=H0;h<H1;h++)lines+='<div class="hourline"></div>';
    const evs=layoutEvents(eventsFor(d).filter(e=>!V.q||e.r.title.toLowerCase().indexOf(V.q.toLowerCase())>-1||cat(e.r.cat).name.toLowerCase().indexOf(V.q.toLowerCase())>-1));
    const body=evs.map(e=>{
      const c=cat(e.r.cat),top=(e.start/60-H0)*PX,ht=Math.max(20,(e.dur/60)*PX-2);
      const w=100/e._n,left=e._c*w;
      return '<button class="ev'+(e.done?" done":"")+'" style="--c:'+c.color+';top:'+top.toFixed(1)+'px;height:'+ht.toFixed(1)+'px;left:calc('+left+'% + 3px);width:calc('+w+'% - 6px)" data-act="routine" data-id="'+e.r.id+'" data-date="'+s+'"><b>'+esc(e.r.title)+'</b><i class="num">'+fmtTime(e.r.time)+'</i></button>';}).join("");
    let now="";
    if(s===tstr){const n=new Date(),mins=n.getHours()*60+n.getMinutes();
      if(mins>=H0*60&&mins<=H1*60)now='<div class="nowline" style="top:'+(((mins/60)-H0)*PX).toFixed(1)+'px"></div>';}
    return '<div class="daycol'+(s===tstr?" today":"")+'">'+lines+body+now+'</div>';}).join("");
  return head+ad+'<div class="grid-scroll" id="gridScroll"><div class="tgrid"><div class="tcol-time">'+hours+'</div>'+cols+'</div></div>';
}
function monthGrid(){
  const first=new Date(V.anchor.getFullYear(),V.anchor.getMonth(),1);
  const start=startOfWeek(first),tstr=TODAY(),m=V.anchor.getMonth();
  let cells="";
  for(let i=0;i<42;i++){
    const d=addDays(start,i),s=ymd(d);
    const ts=tasksFor(s);
    const evs=eventsFor(d);
    const dots=[];evs.forEach(e=>{const c=cat(e.r.cat).color;if(dots.indexOf(c)===-1&&dots.length<4)dots.push(c);});
    const show=ts.slice(0,2),parts=[];
    if(ts.length-show.length>0)parts.push((ts.length-show.length)+" more");
    if(evs.length)parts.push(evs.length+" routine"+(evs.length===1?"":"s"));
    const more=parts.join(" · ");
    cells+='<div class="mcell'+(d.getMonth()!==m?" out":"")+(s===tstr?" today":"")+'" data-act="new-task" data-date="'+s+'">'+
      '<div class="mtop"><span class="mnum num">'+d.getDate()+'</span><span class="mdots">'+dots.map(c=>'<span class="mdot" style="--c:'+c+'"></span>').join("")+'</span></div>'+
      show.map(t=>{const c=cat(t.cat);return '<button class="mchip'+(t.status==="completed"?" done":"")+'" style="--c:'+c.color+'" data-act="task" data-id="'+t.id+'" data-stop="1"><span>'+esc(t.title)+'</span></button>';}).join("")+
      (more?'<button class="mmore" data-act="peek" data-date="'+s+'" data-stop="1">'+esc(more)+'</button>':"")+'</div>';
  }
  return '<div class="mhead">'+DOWS.map(d=>'<div>'+d+'</div>').join("")+'</div><div class="mgrid">'+cells+'</div>';
}
function overduePanel(){
  const o=overdueItems(),n=o.tasks.length+o.miss.length;
  const head='<div class="od-head">'+
    '<button class="icon-btn" data-act="od-toggle" title="'+(V.odOpen?"Collapse":"Expand")+' catch-up panel" aria-label="Toggle catch-up panel">'+icon(V.odOpen?"i-chev-r":"i-panel")+'</button>'+
    '<h3>Catch-up</h3>'+(n?'<span class="od-count num">'+n+'</span>':"")+'</div>';
  if(!V.odOpen)return '<aside class="overdue collapsed">'+head+'</aside>';
  let body="";
  if(!n)body='<div class="empty">'+icon("i-check")+'<p>Nothing behind. Every task and routine up to today is done.</p></div>';
  else{
    if(o.tasks.length)body+='<div class="od-group"><h4>Overdue tasks</h4>'+o.tasks.map(t=>
      '<div class="od-item">'+tickBtn(t)+'<div class="t"><b>'+esc(t.title)+'</b><small>'+esc(relDue(t.due))+' · '+esc(cat(t.cat).name)+'</small></div>'+
      '<button class="rowbtn" style="opacity:1" data-act="task" data-id="'+t.id+'" aria-label="Open task">'+icon("i-edit","ic-14")+'</button></div>').join("")+'</div>';
    if(o.miss.length)body+='<div class="od-group"><h4>Missed routines</h4>'+o.miss.map(x=>
      '<div class="od-item"><button class="tick" data-act="routine-done" data-id="'+x.r.id+'" data-date="'+x.date+'" aria-label="Mark done">'+icon("i-check")+'</button>'+
      '<div class="t"><b>'+esc(x.r.title)+'</b><small class="mut">'+esc(fmtDate(x.date))+' · '+esc(cat(x.r.cat).name)+'</small></div></div>').join("")+'</div>';
  }
  return '<aside class="overdue">'+head+'<div class="od-body">'+body+'</div></aside>';
}
function viewCalendar(){
  const bar='<div class="cal-bar">'+
    '<div class="stepper"><button data-act="cal-prev" aria-label="Previous">'+icon("i-chev-l")+'</button><button data-act="cal-next" aria-label="Next">'+icon("i-chev-r")+'</button></div>'+
    '<button class="btn btn-sm" data-act="cal-today">Today</button>'+
    '<h2>'+(V.calMode==="week"?fmtDate(ymd(startOfWeek(V.anchor)))+" – "+fmtDate(ymd(addDays(startOfWeek(V.anchor),6))):MON[V.anchor.getMonth()]+" "+V.anchor.getFullYear())+'</h2>'+
    '<div class="spacer"></div>'+
    '<div class="seg"><button data-act="cal-mode" data-mode="week" aria-pressed="'+(V.calMode==="week")+'">Week</button>'+
    '<button data-act="cal-mode" data-mode="month" aria-pressed="'+(V.calMode==="month")+'">Month</button></div></div>';
  return '<div class="cal-wrap"><div class="cal-main">'+bar+(V.calMode==="week"?weekGrid():monthGrid())+'</div>'+overduePanel()+'</div>';
}

/* ============ tasks: filters ============ */
const QUICKS=[{id:"open",name:"Open"},{id:"today",name:"Due today"},{id:"week",name:"This week"},{id:"overdue",name:"Overdue"},{id:"done",name:"Completed"},{id:"all",name:"Everything"}];
function filterTasks(mode){
  const f=V.f,t0=TODAY(),wkEnd=ymd(addDays(startOfWeek(today()),6));
  let list=S.tasks.filter(t=>visibleCat(t.cat)&&matchQ(t,V.q));
  if(f.quick==="today")list=list.filter(t=>t.due===t0);
  else if(f.quick==="week")list=list.filter(t=>t.due&&t.due>=ymd(startOfWeek(today()))&&t.due<=wkEnd);
  else if(f.quick==="overdue")list=list.filter(isOverdue);
  else if(f.quick==="done")list=list.filter(t=>t.status==="completed");
  else if(f.quick==="open"&&mode!=="board")list=list.filter(isOpen);
  else if(f.quick==="open"&&mode==="board")list=list.filter(t=>t.status!=="dropped"||true);
  if(f.status)list=list.filter(t=>t.status===f.status);
  if(f.cat)list=list.filter(t=>t.cat===f.cat);
  if(f.quad)list=list.filter(t=>f.quad==="none"?!quadOf(t):quadOf(t)===f.quad);
  if(f.from)list=list.filter(t=>t.due&&t.due>=f.from);
  if(f.to)list=list.filter(t=>t.due&&t.due<=f.to);
  const ord={do:0,decide:1,delegate:2,drop:3};
  list.sort((a,b)=>{
    if(f.sort==="title")return a.title.localeCompare(b.title);
    if(f.sort==="priority"){const x=ord[quadOf(a)]==null?9:ord[quadOf(a)],y=ord[quadOf(b)]==null?9:ord[quadOf(b)];if(x!==y)return x-y;}
    if(f.sort==="created")return (b.created||"")<(a.created||"")?-1:1;
    if(!a.due)return 1;if(!b.due)return -1;return a.due<b.due?-1:(a.due>b.due?1:0);});
  return list;
}
function activeFilterCount(){const f=V.f;return (f.status?1:0)+(f.cat?1:0)+(f.quad?1:0)+(f.from?1:0)+(f.to?1:0)+(f.sort!=="due"?1:0);}
function filterBar(){
  const n=activeFilterCount();
  let h='<div class="toolbar">'+QUICKS.map(q=>'<button class="filter-pill'+(V.f.quick===q.id?" on":"")+'" data-act="quick" data-v="'+q.id+'">'+esc(q.name)+'</button>').join("");
  h+='<div class="spacer"></div>';
  h+='<button class="filter-pill'+(V.adv||n?" on":"")+'" data-act="adv-toggle">'+icon("i-filter")+'Advanced'+(n?' · '+n:"")+'</button>';
  if(n)h+='<button class="filter-pill" data-act="filter-clear">'+icon("i-x")+'Clear</button>';
  h+='</div>';
  if(V.adv){
    h+='<div class="adv">'+
      field("Status",'<select class="inp" data-act="f" data-k="status"><option value="">Any status</option>'+STATUSES.map(s=>'<option value="'+s.id+'"'+(V.f.status===s.id?" selected":"")+'>'+esc(s.name)+'</option>').join("")+'</select>')+
      field("Category",'<select class="inp" data-act="f" data-k="cat"><option value="">All categories</option>'+S.categories.map(c=>'<option value="'+c.id+'"'+(V.f.cat===c.id?" selected":"")+'>'+esc(c.name)+'</option>').join("")+'</select>')+
      field("Matrix quadrant",'<select class="inp" data-act="f" data-k="quad"><option value="">Any priority</option>'+QUADS.map(q=>'<option value="'+q.id+'"'+(V.f.quad===q.id?" selected":"")+'>'+esc(q.name)+'</option>').join("")+'<option value="none"'+(V.f.quad==="none"?" selected":"")+'>Not prioritised</option></select>')+
      field("Due from",'<input class="inp" type="date" data-act="f" data-k="from" value="'+esc(V.f.from)+'">')+
      field("Due until",'<input class="inp" type="date" data-act="f" data-k="to" value="'+esc(V.f.to)+'">')+
      field("Sort by",'<select class="inp" data-act="f" data-k="sort"><option value="due"'+(V.f.sort==="due"?" selected":"")+'>Due date</option><option value="priority"'+(V.f.sort==="priority"?" selected":"")+'>Matrix priority</option><option value="title"'+(V.f.sort==="title"?" selected":"")+'>Title A–Z</option><option value="created"'+(V.f.sort==="created"?" selected":"")+'>Recently added</option></select>')+
      '</div>';
  }
  return h;
}
const field=(l,inner)=>'<div class="field"><label>'+esc(l)+'</label>'+inner+'</div>';

/* ============ tasks: board + list ============ */
function taskCard(t){
  const c=cat(t.cat),subs=t.subtasks||[],dn=subs.filter(s=>s.d).length;
  return '<div class="tcard'+(t.status==="completed"?" done":"")+'" draggable="true" data-id="'+t.id+'" data-act="task">'+
    '<div class="top">'+tickBtn(t)+'<span class="ttl">'+esc(t.title)+'</span></div>'+
    '<div class="meta">'+catChip(t.cat)+dueChip(t)+quadChip(t)+'</div>'+
    (subs.length?'<div class="bar" title="'+dn+' of '+subs.length+' subtasks done"><i style="width:'+Math.round(dn/subs.length*100)+'%"></i></div>':"")+
    '</div>';
}
function viewBoard(){
  const list=filterTasks("board");
  return filterBar()+'<div class="board">'+STATUSES.map(s=>{
    const items=list.filter(t=>t.status===s.id);
    return '<div class="col" data-col="'+s.id+'"><div class="col-head"><span class="sw" style="--s:'+s.color+'"></span><h3>'+esc(s.name)+'</h3><span class="n num">'+items.length+'</span></div>'+
      '<div class="col-list">'+items.map(taskCard).join("")+'</div>'+
      '<button class="addcard" data-act="new-task" data-status="'+s.id+'">'+icon("i-plus","ic-14")+'Add task</button></div>';}).join("")+'</div>';
}
function viewList(){
  const list=filterTasks("list");
  if(!list.length)return filterBar()+'<div class="card"><div class="empty">'+icon("i-inbox")+'<p>No tasks match these filters. Try clearing them or add something new.</p></div></div>';
  const groups={},order=[];
  list.forEach(t=>{const k=t.due?MONS[parseD(t.due).getMonth()]+" "+parseD(t.due).getFullYear():"No due date";
    if(!groups[k]){groups[k]=[];order.push(k);}groups[k].push(t);});
  const head='<div class="lrow head"><span></span><span>Task</span><span>Due date</span><span>Priority</span><span>Category</span><span>Status</span><span></span></div>';
  return filterBar()+order.map(k=>'<div class="lgroup"><h3>'+esc(k)+'<span class="n num">'+groups[k].length+'</span></h3><div class="ltable">'+head+
    groups[k].map(t=>{const c=cat(t.cat),s=ST(t.status),subs=t.subtasks||[];
      return '<div class="lrow'+(t.status==="completed"?" done":"")+'" data-act="task" data-id="'+t.id+'">'+
        tickBtn(t)+
        '<span class="name">'+icon(c.icon,"ic-14")+'<b>'+esc(t.title)+'</b>'+(subs.length?'<span class="sub num">'+subs.filter(x=>x.d).length+'/'+subs.length+'</span>':"")+'</span>'+
        '<span class="sub num" style="color:'+(isOverdue(t)?"var(--danger)":"var(--muted)")+'">'+esc(t.due?fmtDate(t.due):"—")+'</span>'+
        '<span>'+(quadChip(t)||'<span class="sub">—</span>')+'</span>'+
        '<span>'+catChip(t.cat)+'</span>'+
        '<span class="status-dot" style="--s:'+s.color+'"><span class="sw"></span>'+esc(s.name)+'</span>'+
        '<button class="rowbtn" data-act="task" data-id="'+t.id+'" data-stop="1" aria-label="Edit task">'+icon("i-edit","ic-14")+'</button></div>';}).join("")+
    '</div></div>').join("");
}

/* ============ matrix ============ */
function viewMatrix(){
  const base=S.tasks.filter(t=>visibleCat(t.cat)&&matchQ(t,V.q)&&t.status!=="dropped"&&(V.f.quick==="done"?true:t.status!=="completed"||V.f.quick==="all"));
  const byDue=(a,b)=>{if(!a.due)return 1;if(!b.due)return -1;return a.due<b.due?-1:(a.due>b.due?1:0);};
  const grid='<div class="mx">'+QUADS.map(Q=>{
    const items=base.filter(t=>quadOf(t)===Q.id).sort(byDue);
    return '<section class="quad '+Q.cls+'"><div class="quad-head">'+icon(Q.icon,"ic-18")+'<div><h3>'+esc(Q.name)+'</h3><p>'+esc(Q.note)+'</p></div><span class="n num">'+items.length+'</span></div>'+
      '<div class="quad-body">'+(items.length?items.map(t=>
        '<div class="qrow'+(t.status==="completed"?" done":"")+'" data-act="task" data-id="'+t.id+'">'+tickBtn(t)+
        '<div class="t"><b>'+esc(t.title)+'</b><div class="m">'+catChip(t.cat)+'<span class="chip">'+esc(ST(t.status).name)+'</span></div></div>'+
        '<span class="chip chip-due '+(isOverdue(t)?"over":(t.due&&dayDiff(t.due,TODAY())<=1?"soon":""))+'">'+esc(t.due?fmtDate(t.due):"No date")+'</span></div>').join("")
        :'<div class="empty" style="padding:20px">'+icon("i-check")+'<p>Nothing here right now.</p></div>')+'</div></section>';}).join("")+'</div>';
  const un=base.filter(t=>!quadOf(t));
  const tray=un.length?'<div class="unsorted"><h3>Not prioritised yet</h3><p>Tick urgent, important, or both and the task moves into a quadrant.</p>'+
    un.slice(0,10).map(t=>'<div class="urow"><span class="t">'+esc(t.title)+'</span>'+
      '<span class="chip chip-due">'+esc(t.due?fmtDate(t.due):"No date")+'</span>'+
      '<span class="toggle-pair"><button class="tgl warn'+(t.urgent?" on":"")+'" data-act="mx-set" data-id="'+t.id+'" data-k="urgent">Urgent</button>'+
      '<button class="tgl'+(t.important?" on":"")+'" data-act="mx-set" data-id="'+t.id+'" data-k="important">Important</button></span></div>').join("")+'</div>':"";
  return grid+tray;
}

/* ============ routines ============ */
function viewRoutines(){
  const q=V.q.toLowerCase();
  const list=S.routines.filter(r=>visibleCat(r.cat)&&(!q||r.title.toLowerCase().indexOf(q)>-1||cat(r.cat).name.toLowerCase().indexOf(q)>-1));
  if(!list.length)return '<div class="card"><div class="empty">'+icon("i-repeat")+'<p>No routines yet. Add the things you want to happen on repeat — a stand-up, a skincare routine, a weekly review.</p><button class="btn btn-primary" data-act="new-routine">'+icon("i-plus")+'New routine</button></div></div>';
  const wkStart=startOfWeek(today());
  return '<div class="rgrid">'+list.map(r=>{
    const c=cat(r.cat),st=streak(r);
    const days='<div class="week-dots">'+[0,1,2,3,4,5,6].map(i=>{
      const d=addDays(wkStart,i),s=ymd(d),sched=routineOn(r,d),done=doneR(r,s),isT=s===TODAY();
      return '<div class="wd"><small>'+DOWS[i][0]+'</small><button class="cell'+(sched?" sched":"")+(done?" done":"")+(isT?" today":"")+'" '+(sched?'data-act="routine-done" data-id="'+r.id+'" data-date="'+s+'"':'disabled')+' aria-label="'+esc(r.title)+' on '+esc(fmtDate(s))+'" style="--c:'+c.color+'">'+icon("i-check")+'</button></div>';}).join("")+'</div>';
    return '<article class="rcard'+(r.active?"":" paused")+'" style="--c:'+c.color+'">'+
      '<div class="rtop"><span class="ravatar">'+icon(c.icon,"ic-18")+'</span>'+
      '<div style="flex:1;min-width:0"><h3>'+esc(r.title)+'</h3><div class="rsub">'+icon("i-clock","ic-14")+'<span class="num">'+esc(fmtTime(r.time))+' · '+r.dur+' min</span><span>·</span><span>'+esc(freqLabel(r))+'</span></div></div>'+
      (st>1?'<span class="streak">'+icon("i-flame","ic-14")+st+'</span>':"")+'</div>'+
      days+
      '<div style="display:flex;gap:6px;align-items:center">'+catChip(r.cat)+'<div class="spacer" style="flex:1"></div>'+
      '<button class="btn btn-sm btn-ghost" data-act="routine-edit" data-id="'+r.id+'">'+icon("i-edit","ic-14")+'Edit</button></div>'+
      '</article>';}).join("")+'</div>';
}
function freqLabel(r){
  if(r.freq==="interval")return "Every "+(r.every||2)+" days";
  const d=r.days||[];
  if(d.length===7)return "Every day";
  if(d.length===5&&[1,2,3,4,5].every(x=>d.indexOf(x)>-1))return "Weekdays";
  if(!d.length)return "No days set";
  return d.slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(x=>DOWS[(x+6)%7]).join(", ");
}

/* ============ notes ============ */
function allTags(){const s=[];S.notes.forEach(n=>(n.tags||[]).forEach(t=>{if(s.indexOf(t)===-1)s.push(t);}));return s.sort();}
function viewNotes(){
  const q=V.q.toLowerCase();
  let list=S.notes.filter(n=>visibleCat(n.cat));
  if(V.noteTag)list=list.filter(n=>(n.tags||[]).indexOf(V.noteTag)>-1);
  if(q)list=list.filter(n=>(n.title||"").toLowerCase().indexOf(q)>-1||stripHtml(n.html).toLowerCase().indexOf(q)>-1||(n.tags||[]).join(" ").toLowerCase().indexOf(q)>-1);
  list.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||(b.updated||0)-(a.updated||0));
  if(!V.noteId||!noteById(V.noteId))V.noteId=list.length?list[0].id:null;
  const tags=allTags();
  const side='<div class="nlist"><div class="nlist-head">'+
    '<button class="btn btn-primary btn-sm" data-act="new-note">'+icon("i-plus","ic-14")+'New note</button>'+
    (tags.length?'<div class="pickers"><button class="pick'+(V.noteTag?"":" on")+'" data-act="note-tag" data-v="">All</button>'+
      tags.map(t=>'<button class="pick'+(V.noteTag===t?" on":"")+'" data-act="note-tag" data-v="'+esc(t)+'">#'+esc(t)+'</button>').join("")+'</div>':"")+
    '</div><div class="nlist-body">'+
    (list.length?list.map(n=>{const c=cat(n.cat);
      return '<button class="nitem'+(n.id===V.noteId?" on":"")+'" data-act="note-open" data-id="'+n.id+'">'+
        '<b>'+(n.pinned?"📌 ":"")+esc(n.title||"Untitled note")+'</b>'+
        '<p>'+esc(stripHtml(n.html).slice(0,110)||"Empty note")+'</p>'+
        '<span class="nm">'+catChip(n.cat)+'<span class="date">'+esc(new Date(n.updated||Date.now()).toLocaleDateString(undefined,{day:"numeric",month:"short"}))+'</span></span></button>';}).join("")
      :'<div class="empty">'+icon("i-note")+'<p>No notes match. Start one and tag it.</p></div>')+
    '</div></div>';
  const n=noteById(V.noteId);
  if(!n)return '<div class="notes">'+side+'<div class="neditor"><div class="empty">'+icon("i-note")+'<p>Pick a note on the left, or start a new one.</p></div></div></div>';
  const tools=[["bold","B","Bold"],["italic","I","Italic"],["underline","U","Underline"]];
  const bar='<div class="rte-bar">'+tools.map(t=>'<button data-act="rte" data-cmd="'+t[0]+'" title="'+t[2]+'" style="font-family:var(--fd)">'+t[1]+'</button>').join("")+
    '<span class="rte-sep"></span>'+
    '<button data-act="rte" data-cmd="formatBlock" data-v="h2" title="Heading">H2</button>'+
    '<button data-act="rte" data-cmd="formatBlock" data-v="h3" title="Subheading">H3</button>'+
    '<button data-act="rte" data-cmd="formatBlock" data-v="p" title="Body text">¶</button>'+
    '<span class="rte-sep"></span>'+
    '<button data-act="rte" data-cmd="insertUnorderedList" title="Bulleted list">'+icon("i-list","ic-14")+'</button>'+
    '<button data-act="rte" data-cmd="insertOrderedList" title="Numbered list">1.</button>'+
    '<button data-act="rte" data-cmd="formatBlock" data-v="blockquote" title="Quote">&ldquo;</button>'+
    '<span class="rte-sep"></span>'+
    '<button data-act="rte-link" title="Add link" style="width:auto;padding:0 9px;font-size:12px;font-weight:600">Link</button>'+
    '<button data-act="rte" data-cmd="removeFormat" title="Clear formatting">'+icon("i-x","ic-14")+'</button>'+
    '<span class="spacer" style="flex:1"></span>'+
    '<button data-act="note-pin" data-id="'+n.id+'" title="Pin note" style="width:auto;padding:0 9px;font-size:12px;font-weight:600">'+(n.pinned?"Unpin":"Pin")+'</button>'+
    '<button data-act="note-delete" data-id="'+n.id+'" title="Delete note" style="color:var(--danger)">'+icon("i-trash","ic-14")+'</button></div>';
  const meta='<div class="ned-meta">'+
    '<select class="inp" id="noteCat" style="width:auto;min-width:150px">'+S.categories.map(c=>'<option value="'+c.id+'"'+(n.cat===c.id?" selected":"")+'>'+esc(c.name)+'</option>').join("")+'</select>'+
    '<input class="inp" id="noteTags" style="width:auto;min-width:200px;flex:1" value="'+esc((n.tags||[]).join(", "))+'" placeholder="Tags, comma separated">'+
    '</div>';
  const acts='<div class="actions-panel"><h4>'+icon("i-check","ic-14")+'Action items <span style="color:var(--faint);font-weight:600;text-transform:none;letter-spacing:0">— each one becomes a task on your board and calendar</span></h4>'+
    (n.actions||[]).map(a=>{const t=a.taskId?taskById(a.taskId):null;const done=t?t.status==="completed":a.done;
      return '<div class="ai-row'+(done?" done":"")+'"><button class="tick'+(done?" on":"")+'" data-act="ai-done" data-nid="'+n.id+'" data-id="'+a.id+'" aria-label="Complete">'+icon("i-check")+'</button>'+
        '<span class="t">'+esc(a.t)+'</span>'+(t&&t.due?'<span class="chip chip-due">'+esc(relDue(t.due))+'</span>':"")+
        (t?'<button class="rowbtn" style="opacity:1" data-act="task" data-id="'+t.id+'" aria-label="Open task">'+icon("i-edit","ic-14")+'</button>':"")+
        '<button class="rowbtn" style="opacity:1" data-act="ai-del" data-nid="'+n.id+'" data-id="'+a.id+'" aria-label="Remove">'+icon("i-x","ic-14")+'</button></div>';}).join("")+
    '<div class="ai-add"><input class="inp" id="aiText" placeholder="Add an action item…" style="flex:1"><input class="inp" id="aiDate" type="date" value="'+TODAY()+'" style="width:auto">'+
    '<button class="btn btn-sm" data-act="ai-add" data-nid="'+n.id+'">'+icon("i-plus","ic-14")+'Add</button></div></div>';
  return '<div class="notes">'+side+'<div class="neditor">'+
    '<div class="ned-head"><input class="ned-title" id="noteTitle" value="'+esc(n.title)+'" placeholder="Note title">'+meta+'</div>'+
    bar+'<div class="rte" id="rte" contenteditable="true" data-ph="Start writing…">'+(n.html||"")+'</div>'+acts+'</div></div>';
}

/* ============ modals ============ */
function closeModal(){el("modalRoot").innerHTML="";}
function openModal(html){
  el("modalRoot").innerHTML='<div class="scrim" data-scrim="1">'+html+'</div>';
  const f=el("modalRoot").querySelector("input,textarea,select");if(f)setTimeout(()=>f.focus(),40);
}
/* Native confirm()/prompt() are blocked inside the sandboxed artifact frame,
   so destructive actions arm on the first click and fire on the second. */
function arm(btn,label){
  if(btn.dataset.armed==="1")return true;
  btn.dataset.armed="1";btn.dataset.prev=btn.innerHTML;
  btn.innerHTML=esc(label);
  btn.style.width="auto";btn.style.padding="0 9px";btn.style.fontSize="11.5px";
  btn.style.fontWeight="700";btn.style.color="var(--danger)";btn.style.background="var(--danger-soft)";
  toast("Click again to confirm");
  setTimeout(function(){
    if(btn.dataset.armed==="1"){btn.dataset.armed="";btn.innerHTML=btn.dataset.prev||"";
      btn.style.width="";btn.style.padding="";btn.style.fontSize="";btn.style.fontWeight="";btn.style.color="";btn.style.background="";}
  },3500);
  return false;
}
let savedRange=null;
function saveSel(){try{const s=window.getSelection();if(s&&s.rangeCount)savedRange=s.getRangeAt(0).cloneRange();}catch(e){}}
function restoreSel(){try{if(!savedRange)return false;const s=window.getSelection();s.removeAllRanges();s.addRange(savedRange);return true;}catch(e){return false;}}
function linkBar(host){
  if(document.getElementById("linkUrl")){el("linkUrl").focus();return;}
  host.insertAdjacentHTML("afterend",'<div class="link-bar"><input class="inp" id="linkUrl" placeholder="https://…" style="flex:1;max-width:340px">'+
    '<button class="btn btn-sm btn-primary" data-act="rte-link-apply">Add link</button>'+
    '<button class="btn btn-sm" data-act="rte-link-cancel">Cancel</button></div>');
  el("linkUrl").focus();
}
function closeLinkBar(){const b=document.querySelector(".link-bar");if(b)b.remove();}
function toast(msg){
  const n=document.createElement("div");n.className="toast";n.textContent=msg;document.body.appendChild(n);
  setTimeout(()=>n.remove(),2200);
}
/* ============ first run + settings ============ */
let welcomeOpen=false;
function welcomeModal(){
  welcomeOpen=true;
  el("modalRoot").innerHTML='<div class="scrim"><div class="modal narrow welcome" role="dialog" aria-modal="true" aria-label="Welcome">'+
    '<div class="wel-top"><span class="brand-mark" style="width:44px;height:44px;border-radius:15px">'+icon("i-orbit","ic-18")+'</span>'+
    '<h2>Everyday Orbit</h2>'+
    '<p>A calendar, a task board, an Eisenhower matrix, routines and notes — all sharing one set of categories, so a task you write once shows up wherever you look for it.</p></div>'+
    '<div class="mbody">'+
    field("What should the sidebar call this planner?",'<input class="inp" id="ownerName" placeholder="Your name" maxlength="24">')+
    '<div class="wel-choice">'+
      '<button class="btn btn-primary" data-act="welcome-sample">'+icon("i-sparkle")+'Load a sample week</button>'+
      '<button class="btn" data-act="welcome-empty">Start empty</button>'+
    '</div>'+
    '<p class="wel-fine">The sample fills a week with example tasks and routines plus a short guide note, so you can see how each view behaves. Clear it any time from Settings.</p>'+
    '<p class="wel-fine">Coming from another computer? <button class="linkish" data-act="import">Restore a backup file</button> instead.</p>'+
    '</div>'+
    '<div class="mfoot"><span class="wel-fine" style="margin:0">Everything you enter stays in this browser on this device. Use the backup icon in the sidebar to save a copy or move it to another computer.</span></div>'+
    '</div></div>';
  const f=el("ownerName");if(f)setTimeout(function(){f.focus();},60);
}
function closeWelcome(){if(welcomeOpen){welcomeOpen=false;closeModal();}}
function startWith(state){
  const nm=(el("ownerName")&&el("ownerName").value||"").trim();
  S=state;S.prefs.owner=nm;S.prefs.setup=true;
  KEYS.forEach(function(k){touched[k]=true;save(k);});
  welcomeOpen=false;closeModal();render();
}
function settingsModal(){
  const n=S.tasks.length+S.routines.length+S.notes.length;
  openModal('<div class="modal narrow" role="dialog" aria-modal="true" aria-label="Settings">'+
    '<div class="mhead2">'+icon("i-settings","ic-18")+'<h2>Settings</h2><button class="icon-btn" data-act="close" aria-label="Close">'+icon("i-x")+'</button></div>'+
    '<div class="mbody">'+
    field("Planner name in the sidebar",'<input class="inp" id="ownerName2" value="'+esc(S.prefs.owner||"")+'" placeholder="Your name" maxlength="24">')+
    '<div>'+
      '<div class="sec-label" style="margin-bottom:6px">Your data</div>'+
      '<p style="margin:0 0 10px;color:var(--ink-2)">'+n+' item'+(n===1?"":"s")+' saved in this browser'+(db?", synced to your account":"")+'. Back it up before clearing your browsing data, or to move it to another computer.</p>'+
      '<div style="display:flex;gap:7px;flex-wrap:wrap">'+
        '<button class="btn btn-sm" data-act="export">'+icon("i-download","ic-14")+'Back up to a file</button>'+
        '<button class="btn btn-sm" data-act="import">'+icon("i-upload","ic-14")+'Restore a backup</button>'+
        (n===0?'<button class="btn btn-sm" data-act="load-sample">'+icon("i-sparkle","ic-14")+'Load the sample week</button>':"")+
      '</div>'+
    '</div>'+
    '<div>'+
      '<div class="sec-label" style="margin-bottom:6px">Start over</div>'+
      '<p style="margin:0 0 10px;color:var(--ink-2)">Clears every task, routine and note and returns the categories to their defaults. Back up first if you might want any of it.</p>'+
      '<button class="btn btn-sm btn-danger" data-act="reset-all">'+icon("i-trash","ic-14")+'Clear everything</button>'+
    '</div>'+
    '</div><div class="mfoot"><span style="color:var(--muted);font-size:12px">Everyday Orbit · version 1.0</span>'+
    '<div class="spacer" style="flex:1"></div><button class="btn btn-primary" data-act="settings-save">Save</button></div></div>');
}

/* ============ backup + restore ============ */
let pendingImport=null;
function exportData(){
  const payload={app:"everyday-orbit",version:1,exported:new Date().toISOString(),data:{}};
  KEYS.forEach(k=>{payload.data[k]=S[k];});
  const text=JSON.stringify(payload,null,2);
  const name="everyday-orbit-"+TODAY()+".json";
  function viaBlob(){
    try{
      const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
      const a=document.createElement("a");a.href=url;a.download=name;a.style.display="none";
      document.body.appendChild(a);a.click();
      setTimeout(function(){a.remove();URL.revokeObjectURL(url);},1500);
      toast("Backup saved to your downloads");
    }catch(e){toast("Couldn't save the file here — try the local copy");}
  }
  let p=null;
  try{p=window.claude&&claude.use?claude.use("downloads"):null;}catch(e){p=null;}
  if(!p){viaBlob();return;}
  Promise.resolve(p).then(function(d){
    if(!d||!d.save)return viaBlob();
    return d.save({filename:name,data:text}).then(function(){toast("Backup saved");},function(){viaBlob();});
  },function(){viaBlob();});
}
function importPicked(file){
  if(!file)return;
  const r=new FileReader();
  r.onerror=function(){toast("Couldn't read that file");};
  r.onload=function(){
    let o=null;
    try{o=JSON.parse(String(r.result));}catch(e){toast("That file isn't valid JSON");return;}
    const d=o&&o.data?o.data:o;
    if(!d||!Array.isArray(d.tasks)||!Array.isArray(d.categories)){toast("That doesn't look like an Everyday Orbit backup");return;}
    pendingImport=d;
    openModal('<div class="modal narrow" role="dialog" aria-modal="true" aria-label="Restore backup">'+
      '<div class="mhead2">'+icon("i-upload","ic-18")+'<h2>Restore this backup?</h2><button class="icon-btn" data-act="close" aria-label="Close">'+icon("i-x")+'</button></div>'+
      '<div class="mbody"><p style="margin:0;color:var(--ink-2)">The file holds '+
        '<b>'+d.tasks.length+'</b> tasks, <b>'+((d.routines||[]).length)+'</b> routines, <b>'+((d.notes||[]).length)+'</b> notes and <b>'+d.categories.length+'</b> categories'+
        (o&&o.exported?', backed up on '+esc(new Date(o.exported).toLocaleDateString(undefined,{day:"numeric",month:"long",year:"numeric"})):"")+'.</p>'+
      '<p style="margin:0;color:var(--danger);font-weight:600">This replaces everything currently in the planner.</p></div>'+
      '<div class="mfoot"><div class="spacer" style="flex:1"></div><button class="btn" data-act="close">Cancel</button>'+
      '<button class="btn btn-primary" data-act="import-apply">'+icon("i-check")+'Restore</button></div></div>');
  };
  r.readAsText(file);
}
function applyImport(){
  const d=pendingImport;if(!d)return;
  KEYS.forEach(function(k){
    if(k==="completions"){S.completions=(d.completions&&typeof d.completions==="object")?d.completions:{};}
    else if(k==="prefs"){S.prefs=Object.assign({hidden:[],scratch:""},d.prefs||{});}
    else if(Array.isArray(d[k]))S[k]=d[k];
  });
  hiddenCats();S.prefs.setup=true;pendingImport=null;V.noteId=null;welcomeOpen=false;
  KEYS.forEach(function(k){touched[k]=true;save(k);});
  closeModal();render();toast("Backup restored");
}
function taskModal(id,preset){
  const t=id?taskById(id):Object.assign({id:"",title:"",desc:"",due:"",cat:S.categories[0].id,status:"backlog",urgent:null,important:null,subtasks:[]},preset||{});
  if(!t)return;
  const subs=t.subtasks||[];
  openModal('<div class="modal" role="dialog" aria-modal="true" aria-label="Task">'+
    '<div class="mhead2"><h2>'+(id?"Edit task":"New task")+'</h2>'+
    (id?'<button class="btn btn-sm btn-ghost btn-danger" data-act="task-delete" data-id="'+id+'">'+icon("i-trash","ic-14")+'Delete</button>':"")+
    '<button class="icon-btn" data-act="close" aria-label="Close">'+icon("i-x")+'</button></div>'+
    '<div class="mbody">'+
    field("Task","<input class=\"inp\" id=\"tTitle\" value=\""+esc(t.title)+"\" placeholder=\"What needs doing?\">")+
    field("Description",'<textarea class="inp" id="tDesc" rows="3" placeholder="Any detail worth keeping">'+esc(t.desc)+'</textarea>')+
    '<div class="grid3">'+
      field("Due date",'<input class="inp" type="date" id="tDue" value="'+esc(t.due||"")+'">')+
      field("Status",'<select class="inp" id="tStatus">'+STATUSES.map(s=>'<option value="'+s.id+'"'+(t.status===s.id?" selected":"")+'>'+esc(s.name)+'</option>').join("")+'</select>')+
      field("Category",'<select class="inp" id="tCat">'+S.categories.map(c=>'<option value="'+c.id+'"'+(t.cat===c.id?" selected":"")+'>'+esc(c.name)+'</option>').join("")+'</select>')+
    '</div>'+
    field("Priority — this places it in the Eisenhower matrix",'<div class="pickers" id="tPrio">'+
      QUADS.map(Q=>'<button class="pick '+Q.cls+(quadOf(t)===Q.id?" on":"")+'" style="--c:var(--q)" data-act="t-quad" data-v="'+Q.id+'">'+icon(Q.icon)+esc(Q.name)+' <span style="color:var(--muted);font-weight:500">'+esc(Q.tag)+'</span></button>').join("")+
      '<button class="pick'+(quadOf(t)?"":" on")+'" data-act="t-quad" data-v="">Not prioritised</button></div>')+
    field("Subtasks",'<div id="tSubs">'+subs.map(s=>subRow(s)).join("")+'</div>'+
      '<button class="btn btn-sm" data-act="sub-add" style="margin-top:8px">'+icon("i-plus","ic-14")+'Add subtask</button>')+
    '</div>'+
    '<div class="mfoot"><span style="color:var(--muted);font-size:12px">'+(id?"Changes save when you hit save":"Added to your board, list and calendar")+'</span>'+
    '<div class="spacer" style="flex:1"></div><button class="btn" data-act="close">Cancel</button>'+
    '<button class="btn btn-primary" data-act="task-save" data-id="'+(id||"")+'">'+icon("i-check")+'Save task</button></div></div>');
  el("modalRoot").dataset.quad=quadOf(t)||"";
}
function quadName(t){const q=quadOf(t);return q?QUADS.find(x=>x.id===q).name:"Not prioritised";}
function subRow(s){return '<div class="sub-row'+(s.d?" done":"")+'" data-sid="'+(s.id||uid("s"))+'">'+
  '<button class="tick'+(s.d?" on":"")+'" data-act="sub-toggle" aria-label="Toggle subtask">'+icon("i-check")+'</button>'+
  '<span class="t"><input value="'+esc(s.t)+'" placeholder="Subtask"></span>'+
  '<button class="rowbtn" style="opacity:1" data-act="sub-del" aria-label="Remove subtask">'+icon("i-x","ic-14")+'</button></div>';}
function routineModal(id){
  const r=id?routineById(id):{id:"",title:"",cat:S.categories[0].id,freq:"weekly",days:[1,2,3,4,5],every:2,time:"09:00",dur:30,start:TODAY(),end:"",active:true,note:""};
  if(!r)return;
  openModal('<div class="modal" role="dialog" aria-modal="true" aria-label="Routine">'+
    '<div class="mhead2"><h2>'+(id?"Edit routine":"New routine")+'</h2>'+
    (id?'<button class="btn btn-sm btn-ghost btn-danger" data-act="routine-delete" data-id="'+id+'">'+icon("i-trash","ic-14")+'Delete</button>':"")+
    '<button class="icon-btn" data-act="close" aria-label="Close">'+icon("i-x")+'</button></div>'+
    '<div class="mbody">'+
    field("Routine",'<input class="inp" id="rTitle" value="'+esc(r.title)+'" placeholder="Skincare routine, stand-up, weekly review…">')+
    '<div class="grid3">'+
      field("Category",'<select class="inp" id="rCat">'+S.categories.map(c=>'<option value="'+c.id+'"'+(r.cat===c.id?" selected":"")+'>'+esc(c.name)+'</option>').join("")+'</select>')+
      field("Time",'<input class="inp" type="time" id="rTime" value="'+esc(r.time)+'">')+
      field("Minutes",'<input class="inp" type="number" min="5" step="5" id="rDur" value="'+(r.dur||30)+'">')+
    '</div>'+
    field("Repeats",'<div class="pickers" id="rFreq">'+
      ['daily|Every day','weekdays|Weekdays','weekly|Chosen days','interval|Every N days'].map(o=>{const[v,l]=o.split("|");
        const on=(v==="daily"&&r.freq==="weekly"&&(r.days||[]).length===7)||(v==="weekdays"&&r.freq==="weekly"&&(r.days||[]).length===5&&[1,2,3,4,5].every(x=>r.days.indexOf(x)>-1))||(v==="weekly"&&r.freq==="weekly"&&!((r.days||[]).length===7||((r.days||[]).length===5&&[1,2,3,4,5].every(x=>r.days.indexOf(x)>-1))))||(v==="interval"&&r.freq==="interval");
        return '<button class="pick'+(on?" on":"")+'" data-act="r-freq" data-v="'+v+'">'+l+'</button>';}).join("")+'</div>')+
    '<div class="grid2"><div class="field" id="rDaysWrap"><label>Days of the week</label><div class="dow-pick" id="rDays">'+
      [1,2,3,4,5,6,0].map((d,i)=>'<button class="'+((r.days||[]).indexOf(d)>-1?"on":"")+'" data-act="r-day" data-v="'+d+'">'+DOWS[i][0]+'</button>').join("")+'</div></div>'+
      field("Every N days",'<input class="inp" type="number" min="1" max="60" id="rEvery" value="'+(r.every||2)+'">')+'</div>'+
    '<div class="grid2">'+field("Starts",'<input class="inp" type="date" id="rStart" value="'+esc(r.start||TODAY())+'">')+
      field("Ends (optional)",'<input class="inp" type="date" id="rEnd" value="'+esc(r.end||"")+'">')+'</div>'+
    field("Active",'<div class="pickers"><button class="pick'+(r.active?" on":"")+'" data-act="r-active">'+icon("i-repeat")+'<span id="rActiveLbl">'+(r.active?"Running":"Paused")+'</span></button></div>')+
    '</div><div class="mfoot"><div class="spacer" style="flex:1"></div><button class="btn" data-act="close">Cancel</button>'+
    '<button class="btn btn-primary" data-act="routine-save" data-id="'+(id||"")+'">'+icon("i-check")+'Save routine</button></div></div>');
  const M=el("modalRoot");M.dataset.freq=r.freq;M.dataset.active=String(!!r.active);
}
function catsModal(){
  openModal('<div class="modal narrow" role="dialog" aria-modal="true" aria-label="Categories">'+
    '<div class="mhead2"><h2>Categories</h2><button class="icon-btn" data-act="close" aria-label="Close">'+icon("i-x")+'</button></div>'+
    '<div class="mbody"><div class="cat-manage">'+S.categories.map(c=>
      '<div class="cm-row" style="--c:'+c.color+'"><span class="ravatar" style="width:28px;height:28px;border-radius:9px">'+icon(c.icon,"ic-14")+'</span>'+
      '<span class="t">'+esc(c.name)+'</span>'+
      '<span class="chip num" style="color:var(--muted)">'+(function(k){return k+(k===1?" task":" tasks");})(S.tasks.filter(t=>t.cat===c.id).length)+'</span>'+
      '<button class="tgl'+(visibleCat(c.id)?" on":"")+'" data-act="cat-toggle" data-id="'+c.id+'" title="Show or hide across every view">'+(visibleCat(c.id)?"Shown":"Hidden")+'</button>'+
      '<button class="rowbtn" style="opacity:1" data-act="cat-only" data-id="'+c.id+'" title="Show only this category">'+icon("i-target","ic-14")+'</button>'+
      '<button class="rowbtn" style="opacity:1" data-act="cat-edit" data-id="'+c.id+'" aria-label="Edit">'+icon("i-edit","ic-14")+'</button>'+
      '<button class="rowbtn" style="opacity:1;color:var(--danger)" data-act="cat-del" data-id="'+c.id+'" aria-label="Delete">'+icon("i-trash","ic-14")+'</button></div>').join("")+
    '</div></div><div class="mfoot"><button class="btn btn-primary" data-act="cat-edit" data-id="">'+icon("i-plus")+'New category</button>'+
    '<div class="spacer" style="flex:1"></div><button class="btn" data-act="close">Done</button></div></div>');
}
function catEditModal(id){
  const c=id?cat(id):{id:"",name:"",icon:"i-star",color:CAT_COLORS[Math.floor(Math.random()*CAT_COLORS.length)]};
  openModal('<div class="modal narrow" role="dialog" aria-modal="true" aria-label="Category">'+
    '<div class="mhead2"><h2>'+(id?"Edit category":"New category")+'</h2><button class="icon-btn" data-act="close" aria-label="Close">'+icon("i-x")+'</button></div>'+
    '<div class="mbody">'+field("Name",'<input class="inp" id="cName" value="'+esc(c.name)+'" placeholder="Category name">')+
    field("Colour",'<div class="swatches" id="cColors">'+CAT_COLORS.map(x=>'<button class="sw-btn'+(x===c.color?" on":"")+'" style="--c:'+x+'" data-act="c-color" data-v="'+x+'" aria-label="'+x+'"></button>').join("")+'</div>')+
    field("Icon",'<div class="icon-pick" id="cIcons">'+CAT_ICONS.map(i=>'<button class="'+(i===c.icon?"on":"")+'" data-act="c-icon" data-v="'+i+'" aria-label="'+i+'">'+icon(i)+'</button>').join("")+'</div>')+
    '</div><div class="mfoot"><div class="spacer" style="flex:1"></div><button class="btn" data-act="cats-back">Back</button>'+
    '<button class="btn btn-primary" data-act="cat-save" data-id="'+(id||"")+'">Save category</button></div></div>');
  const M=el("modalRoot");M.dataset.color=c.color;M.dataset.icon=c.icon;
}
function peekModal(date){
  const ts=tasksFor(date),evs=eventsFor(parseD(date));
  openModal('<div class="modal narrow" role="dialog" aria-modal="true" aria-label="Day">'+
    '<div class="mhead2"><h2>'+esc(parseD(date).toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"}))+'</h2>'+
    '<button class="icon-btn" data-act="close" aria-label="Close">'+icon("i-x")+'</button></div><div class="mbody">'+
    (ts.length?'<div><div class="sec-label" style="margin-bottom:6px">Tasks</div>'+ts.map(t=>'<div class="qrow" data-act="task" data-id="'+t.id+'">'+tickBtn(t)+'<div class="t"><b>'+esc(t.title)+'</b></div>'+catChip(t.cat)+'</div>').join("")+'</div>':"")+
    (evs.length?'<div><div class="sec-label" style="margin-bottom:6px">Routines</div>'+evs.map(e=>'<div class="qrow"><button class="tick'+(e.done?" on":"")+'" data-act="routine-done" data-id="'+e.r.id+'" data-date="'+date+'" aria-label="Toggle">'+icon("i-check")+'</button><div class="t"><b>'+esc(e.r.title)+'</b></div><span class="chip num">'+esc(fmtTime(e.r.time))+'</span></div>').join("")+'</div>':"")+
    (!ts.length&&!evs.length?'<div class="empty">'+icon("i-calendar")+'<p>Nothing scheduled. A clear day.</p></div>':"")+
    '</div><div class="mfoot"><button class="btn btn-primary" data-act="new-task" data-date="'+date+'">'+icon("i-plus")+'Add task</button><div class="spacer" style="flex:1"></div><button class="btn" data-act="close">Close</button></div></div>');
}
function scratchModal(){
  openModal('<div class="modal" role="dialog" aria-modal="true" aria-label="Scratch pad">'+
    '<div class="mhead2">'+icon("i-bolt","ic-18")+'<h2>Scratch pad</h2><button class="icon-btn" data-act="close" aria-label="Close">'+icon("i-x")+'</button></div>'+
    '<div class="rte-bar">'+["bold|B","italic|I","insertUnorderedList|•"].map(o=>{const[c,l]=o.split("|");return '<button data-act="rte" data-cmd="'+c+'" data-scratch="1">'+l+'</button>';}).join("")+'</div>'+
    '<div class="rte" id="scratchPad" contenteditable="true" data-ph="Anything you need out of your head…" style="min-height:280px">'+(S.prefs.scratch||"")+'</div>'+
    '<div class="mfoot"><span style="color:var(--muted);font-size:12px">Saves as you type</span><div class="spacer" style="flex:1"></div><button class="btn btn-primary" data-act="close">Done</button></div></div>');
}

/* ============ render ============ */
function renderView(){
  const vp=el("viewport"),flush=(V.view==="calendar"||V.view==="notes");
  vp.className="viewport"+(flush?" flush":"");
  if(V.view==="calendar")vp.innerHTML=viewCalendar();
  else if(V.view==="tasks")vp.innerHTML=V.taskMode==="board"?viewBoard():viewList();
  else if(V.view==="matrix")vp.innerHTML=viewMatrix();
  else if(V.view==="routines")vp.innerHTML=viewRoutines();
  else vp.innerHTML=viewNotes();
  const gs=el("gridScroll");if(gs)gs.scrollTop=Math.max(0,(7-H0)*PX-8);
}
function render(){renderRail();renderTopbar();renderView();}

/* ============ actions ============ */
function setQuad(t,q){
  if(!q){t.urgent=null;t.important=null;return;}
  t.urgent=(q==="do"||q==="delegate");t.important=(q==="do"||q==="decide");
}
function toggleTaskDone(id){
  const t=taskById(id);if(!t)return;
  if(t.status==="completed"){t.status="planned";t.completedAt=null;}
  else{t.status="completed";t.completedAt=TODAY();}
  save("tasks");render();
}
function readSubs(){
  return Array.prototype.map.call(el("modalRoot").querySelectorAll(".sub-row"),row=>({
    id:row.dataset.sid,t:row.querySelector("input").value.trim(),d:row.querySelector(".tick").classList.contains("on")
  })).filter(s=>s.t);
}
function saveTask(id){
  const M=el("modalRoot"),title=el("tTitle").value.trim();
  if(!title){el("tTitle").focus();toast("Give the task a name first");return;}
  const data={title:title,desc:el("tDesc").value.trim(),due:el("tDue").value||"",status:el("tStatus").value,cat:el("tCat").value,subtasks:readSubs()};
  let t=id?taskById(id):null;
  if(t)Object.assign(t,data);
  else{t=Object.assign({id:uid("t"),created:TODAY(),completedAt:null,urgent:null,important:null},data);S.tasks.push(t);}
  setQuad(t,M.dataset.quad||"");
  if(t.status==="completed"&&!t.completedAt)t.completedAt=TODAY();
  if(t.status!=="completed")t.completedAt=null;
  save("tasks");closeModal();render();toast(id?"Task updated":"Task added");
}
function saveRoutine(id){
  const M=el("modalRoot"),title=el("rTitle").value.trim();
  if(!title){el("rTitle").focus();toast("Give the routine a name first");return;}
  const days=Array.prototype.map.call(M.querySelectorAll("#rDays button.on"),b=>Number(b.dataset.v));
  const freq=M.dataset.freq==="interval"?"interval":"weekly";
  const data={title:title,cat:el("rCat").value,time:el("rTime").value||"09:00",dur:Math.max(5,Number(el("rDur").value)||30),
    freq:freq,days:freq==="interval"?[]:days,every:Math.max(1,Number(el("rEvery").value)||2),
    start:el("rStart").value||TODAY(),end:el("rEnd").value||"",active:M.dataset.active!=="false"};
  if(freq==="weekly"&&!days.length){toast("Pick at least one day");return;}
  let r=id?routineById(id):null;
  if(r)Object.assign(r,data);else S.routines.push(Object.assign({id:uid("r"),note:""},data));
  save("routines");closeModal();render();toast(id?"Routine updated":"Routine added");
}
function saveCat(id){
  const M=el("modalRoot"),name=el("cName").value.trim();
  if(!name){el("cName").focus();toast("Name the category first");return;}
  if(id){const c=cat(id);c.name=name;c.color=M.dataset.color;c.icon=M.dataset.icon;}
  else S.categories.push({id:uid("c"),name:name,color:M.dataset.color,icon:M.dataset.icon});
  save("categories");catsModal();renderRail();renderView();
}
function delCat(id){
  const n=S.tasks.filter(t=>t.cat===id).length+S.routines.filter(r=>r.cat===id).length+S.notes.filter(x=>x.cat===id).length;
  if(S.categories.length<2){toast("Keep at least one category");return;}
  const fbc=S.categories.find(c=>c.id!==id),fb=fbc.id;
  S.tasks.forEach(t=>{if(t.cat===id)t.cat=fb;});S.routines.forEach(r=>{if(r.cat===id)r.cat=fb;});S.notes.forEach(x=>{if(x.cat===id)x.cat=fb;});
  S.categories=S.categories.filter(c=>c.id!==id);
  S.prefs.hidden=S.prefs.hidden.filter(x=>x!==id);
  save("categories");save("tasks");save("routines");save("notes");save("prefs");catsModal();render();
  toast(n?n+" item"+(n===1?"":"s")+" moved to "+fbc.name:"Category deleted");
}
function addAction(nid){
  const n=noteById(nid);if(!n)return;
  const txt=el("aiText").value.trim();if(!txt){el("aiText").focus();return;}
  const due=el("aiDate").value||"";
  const t={id:uid("t"),title:txt,desc:"From note: "+n.title,due:due,cat:n.cat,status:"planned",urgent:null,important:null,subtasks:[],created:TODAY(),completedAt:null,noteId:n.id};
  S.tasks.push(t);
  n.actions=n.actions||[];n.actions.push({id:uid("a"),t:txt,done:false,taskId:t.id});
  n.updated=Date.now();
  save("tasks");save("notes");render();
  const f=el("aiText");if(f)f.focus();
  toast("Added to your tasks and calendar");
}

/* ============ events ============ */
document.addEventListener("click",function(e){
  let t=e.target;
  if(t&&t.nodeType===3)t=t.parentNode;
  while(t&&!t.closest)t=t.parentNode||t.host;
  if(!t||!t.closest)return;
  if(t.dataset&&t.dataset.scrim==="1"){closeModal();return;}
  const n=t.closest("[data-act]");
  if(!n)return;
  const a=n.dataset.act,id=n.dataset.id,M=el("modalRoot");
  try{
  switch(a){
    case "rail":document.body.classList.toggle("rail-open");break;
    case "view":V.view=n.dataset.view;V.q="";closeRail();render();break;
    case "cat-toggle":toggleCat(id);break;
    case "cat-all":hiddenCats().length=0;touched.prefs=true;save("prefs");render();refreshCatsModal();break;
    case "cat-none":S.prefs.hidden=S.categories.map(c=>c.id);touched.prefs=true;save("prefs");render();refreshCatsModal();break;
    case "cat-only":S.prefs.hidden=S.categories.filter(c=>c.id!==id).map(c=>c.id);touched.prefs=true;save("prefs");render();refreshCatsModal();break;
    case "cal-prev":V.anchor=V.calMode==="week"?addDays(V.anchor,-7):new Date(V.anchor.getFullYear(),V.anchor.getMonth()-1,1);renderTopbar();renderView();break;
    case "cal-next":V.anchor=V.calMode==="week"?addDays(V.anchor,7):new Date(V.anchor.getFullYear(),V.anchor.getMonth()+1,1);renderTopbar();renderView();break;
    case "cal-today":V.anchor=today();renderTopbar();renderView();break;
    case "cal-mode":V.calMode=n.dataset.mode;V.anchor=today();renderTopbar();renderView();break;
    case "od-toggle":V.odOpen=!V.odOpen;renderView();break;
    case "peek":peekModal(n.dataset.date);break;
    case "task-mode":V.taskMode=n.dataset.mode;renderTopbar();renderView();break;
    case "quick":V.f.quick=n.dataset.v;renderView();break;
    case "adv-toggle":V.adv=!V.adv;renderView();break;
    case "filter-clear":V.f={quick:V.f.quick,status:"",cat:"",quad:"",from:"",to:"",sort:"due"};renderView();break;
    case "task":if(id)taskModal(id);break;
    case "task-done":toggleTaskDone(id);break;
    case "new-task":taskModal(null,{due:n.dataset.date||"",status:n.dataset.status||"backlog"});break;
    case "task-save":saveTask(id||null);break;
    case "task-delete":if(arm(n,"Delete for good?")){S.tasks=S.tasks.filter(t=>t.id!==id);S.notes.forEach(x=>{x.actions=(x.actions||[]).filter(y=>y.taskId!==id);});save("tasks");save("notes");closeModal();render();toast("Task deleted");}break;
    case "t-quad":M.dataset.quad=n.dataset.v;M.querySelectorAll('[data-act="t-quad"]').forEach(b=>b.classList.toggle("on",b.dataset.v===n.dataset.v));break;
    case "sub-add":{const w=el("tSubs");w.insertAdjacentHTML("beforeend",subRow({id:uid("s"),t:"",d:false}));w.lastElementChild.querySelector("input").focus();break;}
    case "sub-toggle":n.classList.toggle("on");n.closest(".sub-row").classList.toggle("done");break;
    case "sub-del":n.closest(".sub-row").remove();break;
    case "mx-set":{const t=taskById(id),k=n.dataset.k;
      if(t[k]==null){t[k]=true;const o=k==="urgent"?"important":"urgent";if(t[o]==null)t[o]=false;}
      else t[k]=!t[k];
      save("tasks");render();break;}
    case "new-routine":routineModal(null);break;
    case "routine":case "routine-edit":routineModal(id);break;
    case "routine-save":saveRoutine(id||null);break;
    case "routine-delete":if(arm(n,"Delete for good?")){S.routines=S.routines.filter(r=>r.id!==id);save("routines");closeModal();render();toast("Routine deleted");}break;
    case "routine-done":{const k=id+"|"+n.dataset.date;if(S.completions[k])delete S.completions[k];else S.completions[k]=true;save("completions");render();break;}
    case "r-freq":{const v=n.dataset.v;M.dataset.freq=v==="interval"?"interval":"weekly";
      M.querySelectorAll('[data-act="r-freq"]').forEach(b=>b.classList.toggle("on",b===n));
      const days=M.querySelectorAll("#rDays button");
      if(v==="daily")days.forEach(b=>b.classList.add("on"));
      if(v==="weekdays")days.forEach(b=>b.classList.toggle("on",["1","2","3","4","5"].indexOf(b.dataset.v)>-1));
      el("rDaysWrap").style.opacity=v==="interval"?".4":"1";break;}
    case "r-day":n.classList.toggle("on");break;
    case "r-active":{const on=M.dataset.active!=="false";M.dataset.active=String(!on);n.classList.toggle("on",!on);el("rActiveLbl").textContent=!on?"Running":"Paused";break;}
    case "manage-cats":catsModal();break;
    case "cat-edit":catEditModal(id||null);break;
    case "cats-back":catsModal();break;
    case "cat-save":saveCat(id||null);break;
    case "cat-del":if(arm(n,"Delete?"))delCat(id);break;
    case "c-color":M.dataset.color=n.dataset.v;M.querySelectorAll('[data-act="c-color"]').forEach(b=>b.classList.toggle("on",b===n));break;
    case "c-icon":M.dataset.icon=n.dataset.v;M.querySelectorAll('[data-act="c-icon"]').forEach(b=>b.classList.toggle("on",b===n));break;
    case "new-note":{const nn={id:uid("n"),title:"",cat:S.categories[0].id,tags:[],pinned:false,html:"",actions:[],updated:Date.now()};
      S.notes.unshift(nn);V.view="notes";V.noteId=nn.id;V.q="";save("notes");render();const ti=el("noteTitle");if(ti)ti.focus();break;}
    case "note-open":V.noteId=id;renderView();break;
    case "note-tag":V.noteTag=n.dataset.v;renderView();break;
    case "note-pin":{const x=noteById(id);x.pinned=!x.pinned;x.updated=Date.now();save("notes");renderView();break;}
    case "note-delete":if(arm(n,"Delete note?")){S.notes=S.notes.filter(x=>x.id!==id);V.noteId=null;save("notes");render();toast("Note deleted — tasks it created stay");}break;
    case "ai-add":addAction(n.dataset.nid);break;
    case "ai-done":{const x=noteById(n.dataset.nid);if(!x)break;
      const it=(x.actions||[]).find(y=>y.id===id);if(!it)break;
      if(it.taskId&&taskById(it.taskId))toggleTaskDone(it.taskId);else{it.done=!it.done;x.updated=Date.now();save("notes");render();}break;}
    case "ai-del":{const x=noteById(n.dataset.nid);if(!x)break;
      const it=(x.actions||[]).find(y=>y.id===id);
      if(it&&it.taskId)S.tasks=S.tasks.filter(t=>t.id!==it.taskId);
      x.actions=(x.actions||[]).filter(y=>y.id!==id);x.updated=Date.now();save("notes");save("tasks");render();toast("Action item and its task removed");break;}
    case "welcome-sample":startWith(sampleState());toast("Sample week loaded — clear it any time from Settings");break;
    case "welcome-empty":startWith(blankState());toast("Ready — add your first task");break;
    case "settings":settingsModal();break;
    case "settings-save":{const v=(el("ownerName2").value||"").trim();S.prefs.owner=v;save("prefs");closeModal();render();toast("Settings saved");break;}
    case "load-sample":{const nm=S.prefs.owner;S=sampleState();S.prefs.owner=nm;KEYS.forEach(function(k){touched[k]=true;save(k);});closeModal();render();toast("Sample week loaded");break;}
    case "reset-all":if(arm(n,"Clear everything?")){const nm=S.prefs.owner;S=blankState();S.prefs.owner=nm;S.prefs.setup=true;
      KEYS.forEach(function(k){touched[k]=true;save(k);});V.noteId=null;closeModal();render();toast("Cleared — a fresh start");}break;
    case "export":exportData();break;
    case "import":el("importFile").value="";el("importFile").click();break;
    case "import-apply":applyImport();break;
    case "scratch":scratchModal();break;
    case "rte":document.execCommand(n.dataset.cmd,false,n.dataset.v||null);
      if(n.dataset.scratch){S.prefs.scratch=el("scratchPad").innerHTML;save("prefs");}
      else{const x=noteById(V.noteId);if(x){x.html=el("rte").innerHTML;x.updated=Date.now();save("notes");}}break;
    case "rte-link":linkBar(n.closest(".rte-bar"));break;
    case "rte-link-cancel":closeLinkBar();break;
    case "rte-link-apply":{const u=(el("linkUrl").value||"").trim();closeLinkBar();
      if(!u)break;
      if(!restoreSel()){toast("Select the words you want to link first");break;}
      document.execCommand("createLink",false,u);
      const x=noteById(V.noteId);if(x){x.html=el("rte").innerHTML;x.updated=Date.now();save("notes");}break;}
    case "close":closeModal();break;
  }
  }catch(err){if(window.console)console.error(err);
    toast("Couldn't do that: "+((err&&err.message)||"unknown error")+" · action "+a);}
});
document.addEventListener("mousedown",function(e){
  const t=e.target;if(!t||!t.closest)return;
  const b=t.closest('[data-act="rte"],[data-act="rte-link"]');
  if(b){saveSel();e.preventDefault();}
});
document.addEventListener("selectionchange",function(){
  const a=document.activeElement;if(a&&(a.id==="rte"||a.id==="scratchPad"))saveSel();
});
document.addEventListener("input",function(e){
  const t=e.target;
  if(t.id==="q"){V.q=t.value;renderView();return;}
  if(t.id==="rte"){const x=noteById(V.noteId);if(x){x.html=t.innerHTML;x.updated=Date.now();save("notes");}return;}
  if(t.id==="scratchPad"){S.prefs.scratch=t.innerHTML;save("prefs");return;}
  if(t.id==="noteTitle"){const x=noteById(V.noteId);if(x){x.title=t.value;x.updated=Date.now();save("notes");
    const li=document.querySelector(".nitem.on b");if(li)li.textContent=(x.pinned?"📌 ":"")+(t.value||"Untitled note");}return;}
  if(t.id==="aiText"&&e.inputType==="insertLineBreak")addAction(t.closest(".ai-add").querySelector('[data-act="ai-add"]').dataset.nid);
});
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&el("modalRoot").innerHTML&&!welcomeOpen){closeModal();return;}
  if(e.key==="Escape"&&document.body.classList.contains("rail-open")){closeRail();return;}
  if(e.key==="Enter"&&e.target.id==="linkUrl"){e.preventDefault();
    const b=document.querySelector('[data-act="rte-link-apply"]');if(b)b.click();return;}
  if(e.key==="Enter"&&e.target.id==="aiText"){e.preventDefault();
    const b=document.querySelector('[data-act="ai-add"]');if(b)addAction(b.dataset.nid);return;}
  if(e.key==="Enter"&&(e.target.id==="tTitle"||e.target.id==="rTitle")){e.preventDefault();
    const b=document.querySelector('[data-act="task-save"],[data-act="routine-save"]');if(b)b.click();}
});
document.addEventListener("change",function(e){
  const t=e.target;
  if(t.id==="importFile"){importPicked(t.files&&t.files[0]);return;}
  if(t.dataset&&t.dataset.act==="f"){V.f[t.dataset.k]=t.value;renderView();return;}
  if(t.id==="noteCat"){const x=noteById(V.noteId);if(x){x.cat=t.value;x.updated=Date.now();save("notes");render();}return;}
  if(t.id==="noteTags"){const x=noteById(V.noteId);if(x){x.tags=t.value.split(",").map(s=>s.trim().replace(/^#/,"")).filter(Boolean);x.updated=Date.now();save("notes");renderView();}return;}
});
let dragId=null;
document.addEventListener("dragstart",function(e){const c=e.target.closest&&e.target.closest(".tcard");if(!c)return;
  dragId=c.dataset.id;c.classList.add("dragging");e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",dragId);}catch(_){}});
document.addEventListener("dragend",function(e){const c=e.target.closest&&e.target.closest(".tcard");if(c)c.classList.remove("dragging");
  document.querySelectorAll(".col.over").forEach(x=>x.classList.remove("over"));dragId=null;});
document.addEventListener("dragover",function(e){const col=e.target.closest&&e.target.closest(".col");if(!col||!dragId)return;
  e.preventDefault();e.dataTransfer.dropEffect="move";col.classList.add("over");});
document.addEventListener("dragleave",function(e){const col=e.target.closest&&e.target.closest(".col");
  if(col&&!col.contains(e.relatedTarget))col.classList.remove("over");});
document.addEventListener("drop",function(e){const col=e.target.closest&&e.target.closest(".col");if(!col||!dragId)return;
  e.preventDefault();col.classList.remove("over");
  const t=taskById(dragId);
  if(t&&t.status!==col.dataset.col){t.status=col.dataset.col;t.completedAt=t.status==="completed"?TODAY():null;save("tasks");render();}
  dragId=null;});

/* ============ init ============ */
window.addEventListener("error",function(e){
  if(!e||!e.message||(e.target&&e.target!==window))return;
  toast("Page error: "+e.message);
});
window.addEventListener("unhandledrejection",function(e){
  const m=e&&e.reason&&(e.reason.message||e.reason.code);
  if(m)toast("Sync issue: "+m);
});
let welcomeShown=false;
function maybeWelcome(){
  if(welcomeShown||welcomeOpen)return;
  if(S.prefs.setup||S.tasks.length||S.routines.length||S.notes.length)return;
  welcomeShown=true;welcomeModal();
}
const hadLocal=loadLocal();
render();
if(hadLocal)saveLocal();
/* In the hosted copy, wait for the cloud check before offering a fresh start,
   so a slow connection can never invite someone to overwrite existing data. */
if(window.claude&&window.claude.use)connect().then(maybeWelcome,maybeWelcome);
else{maybeWelcome();connect();}
setInterval(()=>{if(V.view==="calendar"&&V.calMode==="week"&&!el("modalRoot").innerHTML)renderView();},60000);
})();
