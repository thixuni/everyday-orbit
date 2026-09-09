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
/* "9–9:45am" — the trailing am/pm is dropped from the start when both ends
   share it, which is how calendars write a range. */
const fmtRange=(t,dur)=>{
  if(!t)return"";
  const[h,m]=t.split(":").map(Number),s=h*60+m;
  if(!dur)return fmtTime(t);
  const e=s+dur,eh=Math.floor(e/60)%24,em=e%60;
  const a=fmtTime(t),b=fmtTime(pad(eh)+":"+pad(em));
  return((h<12)===(eh<12)?a.replace(/(am|pm)$/,""):a)+"–"+b;
};
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
    activity:[],docs:[],sessions:[],
    prefs:{hidden:[],scratch:"",owner:"",setup:false,vault:"",
      timer:{pomo:false,work:60,brk:15},running:null}};
}
/* Tasks gained fields over time; older saved tasks predate them. Read through
   these rather than assuming the field is there. */
const tStart=t=>t.start||"";
const tTags=t=>Array.isArray(t.tags)?t.tags:[];
const tLinks=t=>Array.isArray(t.links)?t.links:[];
const tFiles=t=>Array.isArray(t.attachments)?t.attachments:[];
const tEst=t=>Number(t.est)||0;
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
const KEYS=["categories","tasks","routines","notes","completions","prefs","activity","docs","sessions"];
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
const V={view:"calendar",calMode:"week",anchor:today(),taskMode:"board",q:"",odOpen:true,adv:false,sheet:null,range:"week",
  f:{quick:"open",status:"",cat:"",quad:"",from:"",to:"",sort:"due"},noteId:null,noteTag:""};

/* ============ rail + topbar ============ */
const NAV=[{id:"calendar",name:"Calendar",icon:"i-calendar"},{id:"tasks",name:"Tasks",icon:"i-board"},
 {id:"matrix",name:"Matrix",icon:"i-grid"},{id:"routines",name:"Routines",icon:"i-repeat"},{id:"notes",name:"Notes",icon:"i-note"},
 {id:"time",name:"Time",icon:"i-chart"}];
function navCount(id){
  if(id==="calendar"){const o=overdueItems();return o.tasks.length+o.miss.length;}
  if(id==="tasks")return S.tasks.filter(isOpen).length;
  if(id==="matrix")return S.tasks.filter(t=>isOpen(t)&&quadOf(t)==="do").length;
  if(id==="routines")return S.routines.filter(r=>routineOn(r,today())&&!doneR(r,TODAY())).length;
  if(id==="notes")return S.notes.length;
  if(id==="time")return 0;
  return 0;
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
  }else if(V.view==="time"){
    const tot=sessionsIn(V.range||"week").reduce((n,x)=>n+x.secs,0);
    title="Time";sub=fmtDur(tot)+" tracked · "+((RANGES.find(x=>x.id===(V.range||"week"))||RANGES[0]).name.toLowerCase());
    right=topSearch("Search tasks");
  }else{
    title="Notes";sub=S.notes.length+" notes · action items land in your tasks and calendar";
    right=topSearch("Search notes")+'<button class="btn" data-act="scratch">'+icon("i-bolt")+'Scratch pad</button>'+
      '<button class="btn btn-primary" data-act="new-note">'+icon("i-plus")+'New note</button>';
  }
  const hid=hiddenCats().length;
  const notice=hid?'<button class="filter-pill on" data-act="cat-all" title="Show all categories again">'+icon("i-filter")+hid+(hid===1?" category":" categories")+' hidden'+icon("i-x","ic-14")+'</button>':"";
  const menu='<button class="rail-toggle" data-act="rail" aria-label="Show the sidebar" title="Sidebar">'+icon("i-menu","ic-18")+'</button>';
  el("topbar").innerHTML=menu+'<div class="title-wrap"><h1>'+title+'</h1><p>'+esc(sub)+'</p></div><div class="spacer"></div>'+timerBar()+notice+right;
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
      // A task, not an event: a tick box you can complete straight from the
      // calendar, then the title. Two buttons so both stay keyboard reachable.
      const done=t.status==="completed";
      return '<div class="tchip'+(done?" done":"")+(isOverdue(t)?" over":"")+'" style="--c:'+c.color+'">'+
        '<button class="tchip-tick" data-act="task-done" data-id="'+t.id+'" role="checkbox" aria-checked="'+done+'" aria-label="'+(done?"Mark not done":"Mark complete")+'">'+icon("i-check")+'</button>'+
        '<button class="tchip-body" data-act="task" data-id="'+t.id+'">'+icon(c.icon,"ic-14")+'<span>'+esc(t.title)+'</span></button>'+
        '</div>';}).join("")+'</div>';}).join("")+'</div>';
  let hours="";for(let h=H0;h<H1;h++)hours+='<div class="hourlab num">'+fmtTime(pad(h)+":00")+'</div>';
  const cols=days.map(d=>{
    const s=ymd(d);let lines="";for(let h=H0;h<H1;h++)lines+='<div class="hourline"></div>';
    const evs=layoutEvents(eventsFor(d).filter(e=>!V.q||e.r.title.toLowerCase().indexOf(V.q.toLowerCase())>-1||cat(e.r.cat).name.toLowerCase().indexOf(V.q.toLowerCase())>-1));
    const body=evs.map(e=>{
      const c=cat(e.r.cat),top=(e.start/60-H0)*PX,ht=Math.max(20,(e.dur/60)*PX-2);
      const w=100/e._n,left=e._c*w;
      // A stacked title and time needs about 40px. Shorter blocks put them on
      // one line, and show only the start time there so the full range does
      // not eat the room the title needs.
      const compact=ht<40;
      const when=compact?fmtTime(e.r.time):fmtRange(e.r.time,e.r.dur);
      return '<button class="ev'+(e.done?" done":"")+(compact?" sm":"")+'" style="--c:'+c.color+';top:'+top.toFixed(1)+'px;height:'+ht.toFixed(1)+'px;left:calc('+left+'% + 3px);width:calc('+w+'% - 6px)" data-act="routine" data-id="'+e.r.id+'" data-date="'+s+'" title="'+esc(e.r.title+" · "+fmtRange(e.r.time,e.r.dur))+'"><b>'+esc(e.r.title)+'</b><i class="num">'+esc(when)+'</i></button>';}).join("");
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
    (hasDesktop()?'<div>'+
      '<div class="sec-label" style="margin-bottom:6px">Obsidian vault</div>'+
      '<p style="margin:0 0 10px;color:var(--ink-2)">'+(vaultPath()
        ? 'Documents are mirrored into <b>'+esc(vaultPath())+'/Everyday Orbit</b>. Edits you make in Obsidian come back here.'
        : 'Pick your vault and every document is written there as a .md file, both ways.')+'</p>'+
      '<div style="display:flex;gap:7px;flex-wrap:wrap">'+
        '<button class="btn btn-sm" data-act="vault-pick">'+icon("i-folder","ic-14")+(vaultPath()?"Change vault":"Connect a vault")+'</button>'+
        (vaultPath()?'<button class="btn btn-sm" data-act="vault-open">'+icon("i-pop","ic-14")+'Open the folder</button>':"")+
        (vaultPath()?'<button class="btn btn-sm btn-danger" data-act="vault-forget">Disconnect</button>':"")+
      '</div>'+
    '</div>':"")+
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
/* The priority section is two either/or pairs shown as four boxes, in the
   order they appear on the matrix table: urgency and importance each stay
   unset until one of their two boxes is ticked. */
const PRIO_OPTS=[
 {k:"urgent",   v:"1",name:"Urgent"},
 {k:"important",v:"1",name:"Important"},
 {k:"important",v:"0",name:"Not Important"},
 {k:"urgent",   v:"0",name:"Not Urgent"}];

const flagVal=b=>b==null?"":(b?"1":"0");
function quadFromFlags(u,i){
  if(u===""||i==="")return null;
  const U=u==="1",I=i==="1";
  if(U&&I)return "do";
  if(!U&&I)return "decide";
  if(U&&!I)return "delegate";
  return "drop";
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
  else if(V.view==="time")vp.innerHTML=viewTime();
  else vp.innerHTML=viewNotes();
  const gs=el("gridScroll");if(gs)gs.scrollTop=Math.max(0,(7-H0)*PX-8);
}
function render(){renderRail();renderTopbar();renderView();}

/* ============ actions ============ */
function toggleTaskDone(id){
  const t=taskById(id);if(!t)return;
  if(t.status==="completed"){t.status="planned";t.completedAt=null;logAct(id,"reopened","Reopened the task");}
  else{t.status="completed";t.completedAt=TODAY();logAct(id,"done","Completed the task");}
  save("tasks");render();
}

function readSheetSubs(){
  const w=el("shSubs");if(!w)return null;
  return Array.prototype.map.call(w.querySelectorAll(".sub-row"),row=>({
    id:row.dataset.sid,t:row.querySelector("input").value.trim(),
    d:row.querySelector(".tick").classList.contains("on")})).filter(x=>x.t);
}
function commitSubs(){
  const subs=readSheetSubs(),sh=V.sheet;
  if(!subs||!sh)return;
  if(!sh.id){patchDraft({subtasks:subs});return;}
  const t=taskById(sh.id);
  if(t&&JSON.stringify(t.subtasks||[])!==JSON.stringify(subs)){t.subtasks=subs;save("tasks");render();}
}

/* Deleting a task takes its history, documents and sessions with it. */
function deleteTask(id){
  const t=taskById(id);if(!t)return;
  docsFor(id).forEach(removeDocFromVault);
  S.tasks=S.tasks.filter(x=>x.id!==id);
  S.notes.forEach(x=>{x.actions=(x.actions||[]).filter(y=>y.taskId!==id);});
  S.tasks.forEach(x=>{if(Array.isArray(x.links))x.links=x.links.filter(l=>l!==id);});
  S.docs=S.docs.filter(d=>d.task!==id);
  S.activity=S.activity.filter(a=>a.task!==id);
  S.sessions=S.sessions.filter(x=>x.task!==id);
  if(running()&&running().task===id){S.prefs.running=null;syncTimerWindow();}
  ["tasks","notes","docs","activity","sessions","prefs"].forEach(save);
  closeSheet();render();toast("Task deleted");
}

const fmtBytes=n=>{n=Number(n)||0;return n<1024?n+" B":n<1048576?Math.round(n/1024)+" KB":(n/1048576).toFixed(1)+" MB";};
function pickAttachment(){
  if(!hasDesktop()){toast("Attaching files needs the desktop app");return;}
  let inp=el("orbitFile");
  if(!inp){inp=document.createElement("input");inp.type="file";inp.id="orbitFile";
    inp.style.display="none";document.body.appendChild(inp);}
  inp.value="";inp.click();
}
function takeAttachment(file){
  const t=sheetTask();if(!file||!t||!V.sheet||!V.sheet.id)return;
  const o=desktop(),rec={id:uid("f"),name:file.name,size:fmtBytes(file.size),type:file.type||""};
  /* Electron 32 dropped File.path, so the preload hands back the real path. */
  const src=o&&o.pathFor?o.pathFor(file):file.path;
  if(o&&o.saveFile&&src){
    try{const saved=o.saveFile({path:src,name:file.name,task:t.id});if(saved&&saved.path)rec.path=saved.path;}catch(e){}
  }
  patchCurrent({attachments:tFiles(t).concat([rec])});
}
function popOutTimer(){
  const o=desktop();
  if(o&&o.popTimer){try{o.popTimer();}catch(e){}syncTimerWindow();return;}
  toast("The floating timer needs the desktop app");
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
    case "task":if(id)openSheet(id);break;
    case "sh-open":if(id)openSheet(id);break;
    case "task-done":toggleTaskDone(id);break;
    case "new-task":openSheet(null,{due:n.dataset.date||"",status:n.dataset.status||"backlog"});break;
    case "task-delete":if(arm(n,"Delete for good?")){S.tasks=S.tasks.filter(t=>t.id!==id);S.notes.forEach(x=>{x.actions=(x.actions||[]).filter(y=>y.taskId!==id);});save("tasks");save("notes");closeModal();render();toast("Task deleted");}break;
    case "sh-sub-add":{const w=el("shSubs");w.insertAdjacentHTML("beforeend",subRow({id:uid("s"),t:"",d:false}));w.lastElementChild.querySelector("input").focus();break;}
    case "sub-toggle":n.classList.toggle("on");n.closest(".sub-row").classList.toggle("done");commitSubs();break;
    case "sub-del":n.closest(".sub-row").remove();commitSubs();break;

    /* ---- task detail sheet ---- */
    case "sheet-close":closeSheet();break;
    case "sh-create":createFromDraft();break;
    case "sh-tab":V.sheet.tab=n.dataset.v;renderSheet();break;
    case "sh-done":{const t=sheetTask();if(t&&V.sheet.id)toggleTaskDone(t.id),renderSheet();break;}
    case "sh-delete":if(arm(n,"Delete for good?"))deleteTask(V.sheet.id);break;
    case "sh-flag":{const t=sheetTask();if(!t)break;
      const k=n.dataset.k,cur=flagVal(t[k]);
      patchCurrent({[k]:cur===n.dataset.v?null:n.dataset.v==="1"});break;}
    case "sh-tag-del":{const t=sheetTask();if(!t)break;
      patchCurrent({tags:tTags(t).filter(x=>x!==n.dataset.v)});break;}
    case "sh-link-del":{const t=sheetTask();if(!t)break;
      patchCurrent({links:tLinks(t).filter(x=>x!==n.dataset.v)});break;}
    case "sh-file-add":pickAttachment();break;
    case "sh-file-open":{const t=sheetTask(),o=desktop();if(!t||!o||!o.openFile)break;
      const f=tFiles(t).find(x=>x.id===n.dataset.v);
      if(f&&f.path)o.openFile(f.path);break;}
    case "sh-file-del":{const t=sheetTask();if(!t)break;
      patchCurrent({attachments:tFiles(t).filter(f=>f.id!==n.dataset.v)});break;}
    case "sh-timer":{const t=sheetTask();if(t&&V.sheet.id)toggleTimer(t.id,n.dataset.mode);break;}

    /* ---- timer ---- */
    case "timer-toggle":toggleTimer(id||(running()||{}).task);break;
    case "timer-stop":stopTimer();break;
    case "timer-pop":popOutTimer();break;

    /* ---- comments and documents ---- */
    case "comment-add":{const box=el("shComment"),t=sheetTask();
      if(!box||!t||!V.sheet.id)break;
      const txt=box.value.trim();
      if(!txt){box.focus();break;}
      logAct(t.id,"comment",txt);box.value="";renderSheet();break;}
    case "act-del":if(arm(n,"Delete?")){S.activity=S.activity.filter(a=>a.id!==id);save("activity");renderSheet();}break;
    case "doc-new":{const t=sheetTask();if(t&&V.sheet.id)docModal(null,t.id);break;}
    case "doc-open":docModal(id);break;
    case "doc-save":{const title=(el("dcTitle").value||"").trim()||"Untitled",md=el("dcMd").value;
      saveDoc(n.dataset.id||null,n.dataset.task||null,title,md);
      closeModal();renderSheet();toast("Document saved");break;}
    case "doc-del":if(arm(n,"Delete for good?")){deleteDoc(id);closeModal();renderSheet();toast("Document deleted");}break;

    /* ---- analytics ---- */
    case "an-range":V.range=n.dataset.v;renderView();break;
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
    case "vault-pick":{const o=desktop();if(!o)break;
      Promise.resolve(o.chooseVault()).then(function(pth){
        if(!pth)return;
        S.prefs.vault=pth;save("prefs");
        S.docs.forEach(pushDocToVault);               // seed the folder with what exists
        settingsModal();toast("Vault connected");
      });break;}
    case "vault-open":{const o=desktop();if(o&&o.openVault)o.openVault();break;}
    case "vault-forget":if(arm(n,"Disconnect?")){const o=desktop();
      if(o&&o.forgetVault)Promise.resolve(o.forgetVault()).then(function(){
        S.prefs.vault="";save("prefs");settingsModal();toast("Vault disconnected");});}
      break;
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
document.addEventListener("input",function(e){
  if(e.target&&e.target.id==="dcMd"){
    const prev=el("dcPrev");
    if(prev)prev.innerHTML=mdToHtml(e.target.value);
  }
});
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&el("modalRoot").innerHTML&&!welcomeOpen){closeModal();return;}
  if(e.key==="Escape"&&V.sheet&&!el("modalRoot").innerHTML){closeSheet();return;}
  if(e.key==="Escape"&&document.body.classList.contains("rail-open")){closeRail();return;}
  if(e.key==="Enter"&&e.target.id==="linkUrl"){e.preventDefault();
    const b=document.querySelector('[data-act="rte-link-apply"]');if(b)b.click();return;}
  if(e.key==="Enter"&&e.target.id==="aiText"){e.preventDefault();
    const b=document.querySelector('[data-act="ai-add"]');if(b)addAction(b.dataset.nid);return;}
  if(e.key==="Enter"&&e.target.id==="rTitle"){e.preventDefault();
    const b=document.querySelector('[data-act="routine-save"]');if(b)b.click();return;}
  /* The sheet has no save button: leaving the field is what commits it. */
  if(e.key==="Enter"&&e.target.id==="shTitle"){e.preventDefault();e.target.blur();}
});
document.addEventListener("keydown",function(e){
  if(e.key!=="Enter")return;
  const t=e.target;
  if(t&&t.id==="shTag"){
    e.preventDefault();
    const v=t.value.trim().replace(/^#/,""),cur=sheetTask();
    if(v&&cur&&tTags(cur).indexOf(v)===-1)patchCurrent({tags:tTags(cur).concat([v])});
    else t.value="";
    return;
  }
  if(t&&t.id==="shComment"&&(e.metaKey||e.ctrlKey)){
    e.preventDefault();
    const btn=document.querySelector('[data-act="comment-add"]');
    if(btn)btn.click();
  }
});
document.addEventListener("change",function(e){
  const t=e.target;
  if(t.id==="importFile"){importPicked(t.files&&t.files[0]);return;}
  if(t.dataset&&t.dataset.act==="f"){V.f[t.dataset.k]=t.value;renderView();return;}
  if(t.dataset&&t.dataset.act==="sh-set"){
    const k=t.dataset.k;let v=t.value;
    if(k==="est")v=Math.max(0,parseInt(v,10)||0);
    if(k==="title"){v=v.trim();if(!v){const cur=sheetTask();t.value=cur?cur.title:"";return;}}
    // Re-rendering while the caret is in a text field would throw it away.
    patchCurrent({[k]:v},k!=="title"&&k!=="desc");
    return;
  }
  if(t.dataset&&t.dataset.act==="sh-link-add"&&t.value){
    const cur=sheetTask();
    if(cur)patchCurrent({links:tLinks(cur).concat([t.value])});
    return;
  }
  if(t.id==="shSubs"||(t.closest&&t.closest("#shSubs"))){commitSubs();return;}
  if(t.id==="orbitFile"){takeAttachment(t.files&&t.files[0]);return;}
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
/* ============ activity log ============ */
/* Everything that happens to a task lands here: comments and documents you
   write, plus an automatic entry for every field that changes. */
const FIELD_LABEL={title:"Title",desc:"Description",due:"Due date",start:"Start date",
  status:"Status",cat:"Category",est:"Estimate",urgent:"Urgent",important:"Important",
  tags:"Tags",links:"Linked tasks",subtasks:"Subtasks",attachments:"Attachments"};

const actFor=id=>S.activity.filter(a=>a.task===id).sort((a,b)=>a.at-b.at);

function logAct(taskId,kind,text,meta){
  if(!Array.isArray(S.activity))S.activity=[];
  S.activity.push({id:uid("a"),task:taskId,at:Date.now(),kind:kind,text:text||"",meta:meta||null});
  save("activity");
}

/* Render a field value the way a person would say it, not the way it is stored. */
function fieldText(k,v){
  if(v==null||v===""||(Array.isArray(v)&&!v.length))return "empty";
  if(k==="status")return ST(v).name;
  if(k==="cat")return cat(v).name;
  if(k==="due"||k==="start")return fmtDate(v);
  if(k==="est")return fmtMins(Number(v)||0);
  if(k==="urgent"||k==="important")return v?"yes":"no";
  if(k==="tags")return v.join(", ");
  if(k==="links")return v.length+(v.length===1?" task":" tasks");
  if(k==="subtasks"||k==="attachments")return v.length+" item"+(v.length===1?"":"s");
  return String(v);
}
const sameVal=(a,b)=>JSON.stringify(a==null?"":a)===JSON.stringify(b==null?"":b);

/* One entry per changed field, so the thread reads as a history. */
function logChanges(id,before,after){
  Object.keys(FIELD_LABEL).forEach(k=>{
    if(sameVal(before[k],after[k]))return;
    if(k==="subtasks"||k==="attachments"){
      if((before[k]||[]).length===(after[k]||[]).length)return;   // ticking a subtask is not a field change
    }
    logField(id,k,before[k],after[k]);
  });
}

/* Still-warm edits to the same field fold into the entry already there, so a
   run of fiddling reads as one change. Land back where you started and the
   entry goes away entirely rather than recording a round trip. */
const FOLD_MS=10*60*1000;
function logField(id,k,from,to){
  const now=Date.now();
  let prev=null;
  for(let i=S.activity.length-1;i>=0;i--){
    const a=S.activity[i];
    if(a.task!==id||now-a.at>FOLD_MS)continue;
    if(a.kind==="field"&&a.meta&&a.meta.f===k){prev=a;break;}
  }
  if(prev){
    if(sameVal(prev.meta.from,to)){
      S.activity=S.activity.filter(a=>a.id!==prev.id);
      save("activity");return;
    }
    prev.meta.to=to;prev.at=now;
    prev.text=FIELD_LABEL[k]+": "+fieldText(k,prev.meta.from)+" → "+fieldText(k,to);
    save("activity");return;
  }
  logAct(id,"field",FIELD_LABEL[k]+": "+fieldText(k,from)+" → "+fieldText(k,to),{f:k,from:from,to:to});
}

/* ============ time tracking ============ */
/* Two modes. Countdown runs against the task's estimate and keeps going once
   it passes zero, so overtime is visible rather than hidden. Stopwatch just
   counts up, for work you cannot estimate yet. Either way each run is stored
   as a session, and a task's total is the sum of its sessions. */
const sessionsFor=id=>S.sessions.filter(s=>s.task===id).sort((a,b)=>b.start-a.start);
const trackedSecs=id=>S.sessions.reduce((n,s)=>n+(s.task===id?(s.secs||0):0),0);
const running=()=>(S.prefs&&S.prefs.running)||null;

function fmtDur(secs){
  const s=Math.max(0,Math.round(secs)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;
  return (h?h+":"+pad(m):m)+":"+pad(ss);
}
function fmtMins(m){
  m=Math.round(Number(m)||0);
  if(!m)return "none";
  const h=Math.floor(m/60),mm=m%60;
  return (h?h+"h":"")+(h&&mm?" ":"")+(mm||!h?mm+"m":"");
}
/* Seconds on the clock right now, including the run in progress. */
function liveSecs(){
  const r=running();if(!r)return 0;
  return (r.acc||0)+(r.since?Math.floor((Date.now()-r.since)/1000):0);
}
function startTimer(taskId,mode){
  const r=running();
  if(r&&r.task!==taskId)stopTimer();          // one task at a time
  const cur=running();
  S.prefs.running=cur&&cur.task===taskId
    ? Object.assign({},cur,{since:Date.now()})
    : {task:taskId,mode:mode||"countdown",acc:0,since:Date.now(),began:Date.now()};
  save("prefs");syncTimerWindow();render();renderSheet();
}
function pauseTimer(){
  const r=running();if(!r||!r.since)return;
  S.prefs.running=Object.assign({},r,{acc:liveSecs(),since:0});
  save("prefs");syncTimerWindow();render();renderSheet();
}
function stopTimer(){
  const r=running();if(!r)return;
  const secs=liveSecs();
  S.prefs.running=null;
  if(secs>=5){                                 // a five second run is a misclick, not work
    S.sessions.push({id:uid("s"),task:r.task,mode:r.mode,start:r.began,end:Date.now(),secs:secs});
    save("sessions");
    logAct(r.task,"time","Tracked "+fmtDur(secs),{secs:secs,mode:r.mode});
  }
  save("prefs");syncTimerWindow();render();renderSheet();
}
function toggleTimer(taskId,mode){
  const r=running();
  if(r&&r.task===taskId&&r.since)pauseTimer();
  else startTimer(taskId,mode);
}

/* The strip that sits in the top bar whenever a timer exists. */
function timerBar(){
  const r=running();if(!r)return "";
  const t=taskById(r.task);if(!t)return "";
  const c=cat(t.cat),secs=liveSecs(),est=tEst(t)*60;
  const over=r.mode==="countdown"&&est&&secs>est;
  const shown=r.mode==="countdown"&&est?Math.abs(est-secs):secs;
  return '<div class="tbar'+(over?" over":"")+(r.since?"":" held")+'" style="--c:'+c.color+'">'+
    '<button class="tbar-btn" data-act="timer-toggle" data-id="'+t.id+'" aria-label="'+(r.since?"Pause":"Resume")+'">'+icon(r.since?"i-pause":"i-play","ic-14")+'</button>'+
    '<span class="tbar-name">'+esc(t.title)+'</span>'+
    '<span class="tbar-time num">'+(over?"+":"")+fmtDur(shown)+'</span>'+
    '<button class="tbar-btn" data-act="timer-stop" aria-label="Stop and log">'+icon("i-stop","ic-14")+'</button>'+
    '<button class="tbar-btn" data-act="timer-pop" aria-label="Pop out the timer" title="Pop out">'+icon("i-pop","ic-14")+'</button>'+
    '</div>';
}

/* ============ documents ============ */
/* Documents are markdown, so they can live in an Obsidian vault unchanged. */
const docsFor=id=>S.docs.filter(d=>d.task===id).sort((a,b)=>b.updated-a.updated);
const docById=id=>S.docs.find(d=>d.id===id);

/* A deliberately small markdown renderer for the preview: headings, emphasis,
   code, quotes, lists, task boxes, rules and links. Everything is escaped
   before any markup is added. */
function mdToHtml(md){
  const lines=String(md||"").split(/\r?\n/),out=[];
  let list=null,fence=false,buf=[];
  const inline=s=>esc(s)
    .replace(/`([^`]+)`/g,"<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>")
    .replace(/(^|[^*])\*([^*]+)\*/g,"$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const shut=()=>{if(list){out.push("</"+list+">");list=null;}};
  const open=tag=>{if(list!==tag){shut();out.push("<"+tag+">");list=tag;}};
  lines.forEach(raw=>{
    const l=raw.replace(/\s+$/,"");
    if(/^```/.test(l)){
      if(fence){out.push("<pre><code>"+esc(buf.join("\n"))+"</code></pre>");buf=[];fence=false;}
      else{shut();fence=true;}
      return;
    }
    if(fence){buf.push(raw);return;}
    if(!l.trim()){shut();return;}
    let m;
    if(/^---+$/.test(l)){shut();out.push("<hr>");return;}
    if((m=l.match(/^(#{1,4})\s+(.*)$/))){shut();const n=Math.min(m[1].length+1,5);out.push("<h"+n+">"+inline(m[2])+"</h"+n+">");return;}
    if((m=l.match(/^&gt;\s?(.*)$/))||(m=l.match(/^>\s?(.*)$/))){shut();out.push("<blockquote>"+inline(m[1])+"</blockquote>");return;}
    if((m=l.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/))){open("ul");
      out.push('<li class="md-task"><span class="md-box'+(m[1]===" "?"":" on")+'"></span>'+inline(m[2])+"</li>");return;}
    if((m=l.match(/^[-*]\s+(.*)$/))){open("ul");out.push("<li>"+inline(m[1])+"</li>");return;}
    if((m=l.match(/^\d+[.)]\s+(.*)$/))){open("ol");out.push("<li>"+inline(m[1])+"</li>");return;}
    shut();out.push("<p>"+inline(l)+"</p>");
  });
  if(fence&&buf.length)out.push("<pre><code>"+esc(buf.join("\n"))+"</code></pre>");
  shut();
  return out.join("");
}

/* A filename Obsidian is happy with, stable for a given document. */
function docFile(d){
  const base=String(d.title||"Untitled").replace(/[\\/:*?"<>|#^[\]]/g,"").replace(/\s+/g," ").trim().slice(0,80);
  return (base||"Untitled")+" "+d.id.slice(-6)+".md";
}
/* What actually gets written to the vault: front matter Obsidian can read,
   then the body. */
function docFileBody(d){
  const t=taskById(d.task),c=t?cat(t.cat):null;
  return "---\ntitle: "+JSON.stringify(String(d.title||"Untitled"))+
    "\ntask: "+JSON.stringify(t?t.title:"")+
    (c?"\ncategory: "+JSON.stringify(c.name):"")+
    "\nupdated: "+new Date(d.updated||Date.now()).toISOString()+
    "\norbit-id: "+d.id+
    "\n---\n\n"+String(d.md||"");
}
/* The inverse, for changes coming back from the vault. */
function stripFrontMatter(text){
  const m=String(text||"").match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m?String(text).slice(m[0].length).replace(/^\r?\n/,""):String(text||"");
}

function saveDoc(id,taskId,title,md){
  let d=id?docById(id):null;
  const now=Date.now();
  if(d){
    const changed=d.md!==md||d.title!==title;
    d.title=title;d.md=md;d.updated=now;
    if(changed)logAct(d.task,"doc-edit","Edited the document “"+title+"”",{doc:d.id});
  }else{
    d={id:uid("d"),task:taskId,title:title,md:md,created:now,updated:now};
    S.docs.push(d);
    logAct(taskId,"doc","Added the document “"+title+"”",{doc:d.id});
  }
  save("docs");pushDocToVault(d);
  return d;
}
function deleteDoc(id){
  const d=docById(id);if(!d)return;
  S.docs=S.docs.filter(x=>x.id!==id);
  save("docs");logAct(d.task,"doc-del","Deleted the document “"+d.title+"”");
  removeDocFromVault(d);
}


/* ============ task detail panel ============ */
/* A sheet over the right-hand side rather than a full screen: the task's
   fields at the top, its history underneath. Fields save as you leave them,
   so there is no save button to forget. */

function openSheet(id,preset){
  if(id&&!taskById(id))return;
  V.sheet={id:id||null,tab:"details",
    draft:id?null:Object.assign({title:"",desc:"",due:"",start:"",cat:S.categories[0].id,
      status:"backlog",urgent:null,important:null,est:0,tags:[],links:[],subtasks:[],attachments:[]},preset||{})};
  renderSheet();
}
function closeSheet(){V.sheet=null;renderSheet();}

/* The task being shown, or the unsaved draft for a new one. */
const sheetTask=()=>{const s=V.sheet;return s?(s.id?taskById(s.id):s.draft):null;};

function patchTask(id,patch,redraw){
  const t=taskById(id);if(!t)return;
  const before=JSON.parse(JSON.stringify(t));
  Object.assign(t,patch);
  if(t.status==="completed"&&!t.completedAt)t.completedAt=TODAY();
  if(t.status!=="completed")t.completedAt=null;
  logChanges(id,before,t);
  save("tasks");render();
  if(redraw!==false)renderSheet();
}
/* A draft has no id yet, so edits are held until it is created. */
function patchDraft(patch){
  if(V.sheet&&V.sheet.draft)Object.assign(V.sheet.draft,patch);
}
function patchCurrent(patch,redraw){
  const s=V.sheet;if(!s)return;
  if(s.id)patchTask(s.id,patch,redraw);
  else{patchDraft(patch);if(redraw!==false)renderSheet();}
}
function createFromDraft(){
  const s=V.sheet;if(!s||!s.draft)return;
  const d=s.draft;
  if(!d.title.trim()){toast("Give the task a name first");const n=el("shTitle");if(n)n.focus();return;}
  const t=Object.assign({id:uid("t"),created:TODAY(),completedAt:null},d);
  S.tasks.push(t);save("tasks");
  logAct(t.id,"created","Created this task");
  V.sheet={id:t.id,tab:"activity",draft:null};
  render();renderSheet();toast("Task added");
}

const metaRow=(label,inner,ic)=>'<div class="mrow"><div class="mlab">'+(ic?icon(ic,"ic-14"):"")+esc(label)+'</div><div class="mval">'+inner+'</div></div>';

function sheetPrio(t){
  const st={urgent:flagVal(t.urgent),important:flagVal(t.important)};
  const q=quadFromFlags(st.urgent,st.important),Q=q?QUADS.find(x=>x.id===q):null;
  return '<div class="prio-mini">'+PRIO_OPTS.map(o=>{
      const on=st[o.k]===o.v;
      return '<button class="pick flag sm'+(on?" on":"")+'" data-act="sh-flag" data-k="'+o.k+'" data-v="'+o.v+
        '" role="switch" aria-checked="'+on+'"><span class="flag-box">'+icon("i-check")+'</span>'+esc(o.name)+'</button>';
    }).join("")+'</div>'+
    (Q?'<span class="chip chip-q '+Q.cls+'" style="margin-top:7px">'+icon(Q.icon,"ic-14")+esc(Q.name)+'</span>'
      :'<span class="chip" style="margin-top:7px">Not prioritised</span>');
}

function sheetTime(t,isNew){
  if(isNew)return '<span class="mnone">Available once the task exists</span>';
  const r=running(),live=r&&r.task===t.id,secs=trackedSecs(t.id)+(live?liveSecs():0);
  const est=tEst(t);
  return '<div class="tm">'+
    '<div class="tm-controls">'+
      '<button class="btn btn-sm'+(live&&r.since?" btn-primary":"")+'" data-act="sh-timer" data-mode="countdown">'+
        icon(live&&r.since?"i-pause":"i-play","ic-14")+(live&&r.since?"Pause":(est?"Blitz it":"Start"))+'</button>'+
      '<button class="btn btn-sm" data-act="sh-timer" data-mode="stopwatch" title="Count up instead">'+icon("i-timer","ic-14")+'Stopwatch</button>'+
      (live?'<button class="btn btn-sm btn-danger" data-act="timer-stop">'+icon("i-stop","ic-14")+'Stop</button>':"")+
    '</div>'+
    '<div class="tm-read">'+
      '<span class="num"><b>'+fmtDur(secs)+'</b> tracked</span>'+
      (est?'<span class="num'+(secs>est*60?" over":"")+'">'+fmtMins(est)+' estimated'+(secs>est*60?" · over by "+fmtDur(secs-est*60):"")+'</span>':"")+
    '</div></div>';
}

function sheetTags(t){
  const tags=tTags(t);
  return '<div class="tagbox">'+tags.map(x=>'<span class="chip chip-tag">'+esc(x)+
      '<button data-act="sh-tag-del" data-v="'+esc(x)+'" aria-label="Remove tag">'+icon("i-x","ic-14")+'</button></span>').join("")+
    '<input class="tag-in" id="shTag" placeholder="'+(tags.length?"Add":"Add a tag")+'" aria-label="Add a tag">'+
    '</div>';
}

function sheetLinks(t,isNew){
  if(isNew)return '<span class="mnone">Available once the task exists</span>';
  const ids=tLinks(t),others=S.tasks.filter(x=>x.id!==t.id&&ids.indexOf(x.id)===-1);
  return '<div class="linkbox">'+
    ids.map(id=>{const o=taskById(id);if(!o)return "";
      return '<div class="linkrow"><button class="lk" data-act="sh-open" data-id="'+o.id+'">'+icon(cat(o.cat).icon,"ic-14")+
        '<span>'+esc(o.title)+'</span></button>'+
        '<button class="rowx" data-act="sh-link-del" data-v="'+o.id+'" aria-label="Unlink">'+icon("i-x","ic-14")+'</button></div>';}).join("")+
    (others.length?'<select class="inp inp-sm" data-act="sh-link-add"><option value="">Link a task…</option>'+
      others.slice(0,200).map(o=>'<option value="'+o.id+'">'+esc(o.title)+'</option>').join("")+'</select>':"")+
    '</div>';
}

function sheetFiles(t,isNew){
  if(isNew)return '<span class="mnone">Available once the task exists</span>';
  const files=tFiles(t);
  return '<div class="filebox">'+
    files.map(f=>'<div class="filerow">'+icon("i-clip","ic-14")+
      (f.path?'<button class="fname lk-inline" data-act="sh-file-open" data-v="'+esc(f.id)+'" title="Open">'+esc(f.name)+'</button>'
             :'<span class="fname">'+esc(f.name)+'</span>')+
      '<span class="fsize num">'+esc(f.size)+'</span>'+
      '<button class="rowx" data-act="sh-file-del" data-v="'+f.id+'" aria-label="Remove">'+icon("i-x","ic-14")+'</button></div>').join("")+
    (hasDesktop()
      ? '<button class="btn btn-sm" data-act="sh-file-add">'+icon("i-plus","ic-14")+'Attach a file</button>'
      : '<span class="mnone">Attaching files needs the desktop app</span>')+
    '</div>';
}

/* ---- activity feed ---- */
const ACT_ICON={created:"i-plus",comment:"i-chat",doc:"i-doc","doc-edit":"i-doc","doc-del":"i-trash",
  field:"i-edit",time:"i-timer",done:"i-check",reopened:"i-repeat"};

function relTime(ms){
  const d=Math.floor((Date.now()-ms)/1000);
  if(d<60)return "just now";
  if(d<3600)return Math.floor(d/60)+"m ago";
  if(d<86400)return Math.floor(d/3600)+"h ago";
  const dt=new Date(ms);
  return fmtDate(ymd(dt))+" at "+fmtTime(pad(dt.getHours())+":"+pad(dt.getMinutes()));
}

/* Documents sit with the task's working material, not its history. */
const histCount=t=>S.activity.reduce((n,a)=>n+(a.task===t.id&&a.kind!=="comment"?1:0),0);

function docsSection(t,isNew){
  if(isNew)return "";
  const ds=docsFor(t.id);
  return '<div class="sh-sec"><label class="sec-label">Documents'+(ds.length?' <span class="num">'+ds.length+'</span>':"")+'</label>'+
    (ds.length?'<div class="doclist">'+ds.map(d=>
      '<button class="doccard" data-act="doc-open" data-id="'+d.id+'">'+icon("i-doc","ic-14")+
      '<span class="dc-t">'+esc(d.title)+'</span>'+
      '<span class="dc-m">'+esc(relTime(d.updated))+'</span></button>').join("")+'</div>'
      :'<p class="mnone" style="margin:0 0 8px">Markdown, so your vault can read them.</p>')+
    '<button class="btn btn-sm" data-act="doc-new">'+icon("i-plus","ic-14")+'New document</button></div>';
}

/* Comments live with the details, where the work is. */
function commentsPane(t,isNew){
  if(isNew)return "";
  const who=(S.prefs&&S.prefs.owner)||"You";
  const list=actFor(t.id).filter(a=>a.kind==="comment");
  return '<div class="sh-sec"><label class="sec-label">Comments'+(list.length?' <span class="num">'+list.length+'</span>':"")+'</label>'+
    (list.length?'<div class="feed">'+list.map(a=>
      '<div class="act act-comment"><div class="act-top"><b>'+esc(who)+'</b><span>'+esc(relTime(a.at))+'</span>'+
      '<button class="rowx" data-act="act-del" data-id="'+a.id+'" aria-label="Delete comment">'+icon("i-x","ic-14")+'</button></div>'+
      '<div class="act-body">'+mdToHtml(a.text)+'</div></div>').join("")+'</div>':"")+
    '<div class="composer">'+
      '<textarea class="inp" id="shComment" rows="2" placeholder="Write a comment… markdown works"></textarea>'+
      '<div class="composer-foot">'+
        '<span class="mnone">Ctrl+Enter to post</span>'+
        '<div class="spacer" style="flex:1"></div>'+
        '<button class="btn btn-sm btn-primary" data-act="comment-add">'+icon("i-send","ic-14")+'Comment</button>'+
      '</div></div></div>';
}

/* The history: what happened to the task, without the conversation. */
function historyPane(t){
  const items=actFor(t.id).filter(a=>a.kind!=="comment");
  if(!items.length)return '<div class="act-empty">Nothing has happened to this task yet.</div>';

  /* Runs of bookkeeping that happened at the same moment become one block
     under one timestamp, instead of a stack of near-identical rows. */
  const blocks=[];
  items.forEach(a=>{
    const when=relTime(a.at),last=blocks[blocks.length-1];
    if(last&&last.when===when)last.list.push(a);
    else blocks.push({when:when,list:[a]});
  });
  const line=a=>{
    const d=a.meta&&a.meta.doc?docById(a.meta.doc):null;
    const text=d?'<button class="lk lk-inline" data-act="doc-open" data-id="'+d.id+'">'+esc(a.text)+'</button>':esc(a.text);
    return '<div class="ag-line">'+icon(ACT_ICON[a.kind]||"i-dot-grid","ic-14")+'<span>'+text+'</span></div>';
  };
  return '<div class="feed">'+blocks.map(b=>
    '<div class="act-group"><div class="ag-when">'+esc(b.when)+'</div>'+
    '<div class="ag-lines">'+b.list.map(line).join("")+'</div></div>').join("")+'</div>';
}

function renderSheet(){
  const root=el("sheetRoot");if(!root)return;
  const s=V.sheet;
  if(!s){root.innerHTML="";document.body.classList.remove("sheet-open");return;}
  const t=sheetTask();
  if(!t){root.innerHTML="";document.body.classList.remove("sheet-open");V.sheet=null;return;}
  document.body.classList.add("sheet-open");
  const isNew=!s.id,c=cat(t.cat),done=t.status==="completed";
  const subs=t.subtasks||[],dn=subs.filter(x=>x.d).length;

  root.innerHTML='<div class="sheet-scrim" data-act="sheet-close"></div>'+
  '<aside class="sheet" role="dialog" aria-modal="true" aria-label="Task detail">'+
    '<header class="sh-head">'+
      '<button class="tick'+(done?" on":"")+'" data-act="sh-done" aria-label="Mark complete"'+(isNew?" disabled":"")+'>'+icon("i-check")+'</button>'+
      '<select class="inp inp-sm sh-status" data-act="sh-set" data-k="status">'+
        STATUSES.map(x=>'<option value="'+x.id+'"'+(t.status===x.id?" selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select>'+
      '<div class="spacer" style="flex:1"></div>'+
      (isNew?"":'<button class="icon-btn btn-sm" data-act="sh-timer" data-mode="countdown" title="Start the timer" aria-label="Start the timer">'+icon(running()&&running().task===t.id&&running().since?"i-pause":"i-play","ic-14")+'</button>')+
      (isNew?"":'<button class="icon-btn btn-sm btn-danger" data-act="sh-delete" title="Delete" aria-label="Delete task">'+icon("i-trash","ic-14")+'</button>')+
      '<button class="icon-btn btn-sm" data-act="sheet-close" aria-label="Close">'+icon("i-x","ic-14")+'</button>'+
    '</header>'+

    '<div class="sh-body">'+
      '<input class="sh-title" id="shTitle" value="'+esc(t.title)+'" placeholder="What needs doing?" data-act="sh-set" data-k="title">'+

      (isNew?"":'<div class="seg sh-tabs">'+
        '<button data-act="sh-tab" data-v="details" aria-pressed="'+(s.tab!=="activity")+'">'+icon("i-list","ic-14")+'Details</button>'+
        '<button data-act="sh-tab" data-v="activity" aria-pressed="'+(s.tab==="activity")+'">'+icon("i-clock","ic-14")+'Activity'+
          (histCount(t)?' <span class="num">'+histCount(t)+'</span>':"")+'</button></div>')+

      (s.tab==="activity"?historyPane(t):'<div class="sh-meta">'+
        metaRow("Dates",'<div class="dpair">'+
          '<input class="inp inp-sm" type="date" value="'+esc(tStart(t))+'" data-act="sh-set" data-k="start" aria-label="Start date">'+
          '<span class="arrow">'+icon("i-chev-r","ic-14")+'</span>'+
          '<input class="inp inp-sm" type="date" value="'+esc(t.due||"")+'" data-act="sh-set" data-k="due" aria-label="Due date">'+
          '</div>',"i-calendar")+
        metaRow("Category",'<select class="inp inp-sm" data-act="sh-set" data-k="cat">'+
          S.categories.map(x=>'<option value="'+x.id+'"'+(t.cat===x.id?" selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select>',c.icon)+
        metaRow("Priority",sheetPrio(t),"i-flag")+
        metaRow("Estimate",'<input class="inp inp-sm est-in" type="number" min="0" step="5" value="'+(tEst(t)||"")+'" placeholder="minutes" data-act="sh-set" data-k="est" aria-label="Time estimate in minutes">',"i-timer")+
        metaRow("Time",sheetTime(t,isNew),"i-clock")+
        metaRow("Tags",sheetTags(t),"i-tag")+
        metaRow("Linked",sheetLinks(t,isNew),"i-link")+
        metaRow("Files",sheetFiles(t,isNew),"i-clip")+
      '</div>'+

      '<div class="sh-sec"><label class="sec-label">Description</label>'+
        '<textarea class="inp" id="shDesc" rows="3" placeholder="Any detail worth keeping" data-act="sh-set" data-k="desc">'+esc(t.desc||"")+'</textarea></div>'+

      '<div class="sh-sec"><label class="sec-label">Subtasks'+(subs.length?' <span class="num">'+dn+'/'+subs.length+'</span>':"")+'</label>'+
        '<div id="shSubs">'+subs.map(x=>subRow(x)).join("")+'</div>'+
        '<button class="btn btn-sm" data-act="sh-sub-add" style="margin-top:8px">'+icon("i-plus","ic-14")+'Add subtask</button></div>'+
      docsSection(t,isNew)+
      commentsPane(t,isNew))+

      (isNew?'<div class="sh-create"><button class="btn btn-primary" data-act="sh-create">'+icon("i-check")+'Create task</button>'+
          '<span class="mnone">Comments, documents and the timer open up once it exists.</span></div>':"")+
    '</div>'+
  '</aside>';
}

/* ---- document editor ---- */
function docModal(id,taskId){
  const d=id?docById(id):null;
  openModal('<div class="modal modal-wide" role="dialog" aria-modal="true" aria-label="Document">'+
    '<div class="mhead2"><h2>'+(d?"Document":"New document")+'</h2>'+
      (d?'<button class="btn btn-sm btn-ghost btn-danger" data-act="doc-del" data-id="'+d.id+'">'+icon("i-trash","ic-14")+'Delete</button>':"")+
      '<button class="icon-btn" data-act="close" aria-label="Close">'+icon("i-x")+'</button></div>'+
    '<div class="mbody">'+
      '<input class="inp doc-title" id="dcTitle" value="'+esc(d?d.title:"")+'" placeholder="Document title">'+
      '<div class="doc-split">'+
        '<textarea class="inp doc-md" id="dcMd" spellcheck="true" placeholder="# Heading&#10;&#10;Write in markdown. It is saved as a .md file.">'+esc(d?d.md:"")+'</textarea>'+
        '<div class="doc-prev" id="dcPrev">'+mdToHtml(d?d.md:"")+'</div>'+
      '</div>'+
      '<p class="mnone">'+(vaultPath()?'Saved to your vault as '+esc(d?docFile(d):"a .md file"):'Saved inside the planner. Connect a vault in Settings to mirror it into Obsidian.')+'</p>'+
    '</div>'+
    '<div class="mfoot"><div class="spacer" style="flex:1"></div>'+
      '<button class="btn" data-act="close">Cancel</button>'+
      '<button class="btn btn-primary" data-act="doc-save" data-id="'+(d?d.id:"")+'" data-task="'+esc(taskId||(d?d.task:""))+'">'+icon("i-check")+'Save</button>'+
    '</div></div>');
}


/* ============ the desktop bridge ============ */
/* main.js exposes window.orbit through a preload script. In a plain browser
   it is absent, so every one of these is a no-op and the features that need
   a real filesystem or a floating window simply do not appear. */
const desktop=()=>(typeof window!=="undefined"&&window.orbit)||null;
const hasDesktop=()=>!!desktop();
const vaultPath=()=>(S.prefs&&S.prefs.vault)||"";

function pushDocToVault(d){
  const o=desktop();if(!o||!vaultPath()||!d)return;
  try{o.writeDoc({file:docFile(d),body:docFileBody(d),id:d.id});}catch(e){}
}
function removeDocFromVault(d){
  const o=desktop();if(!o||!vaultPath()||!d)return;
  try{o.deleteDoc({file:docFile(d),id:d.id});}catch(e){}
}
function syncTimerWindow(){
  const o=desktop();if(!o||!o.timer)return;
  const r=running();
  if(!r){try{o.timer({state:"idle"});}catch(e){}return;}
  const t=taskById(r.task);if(!t)return;
  const est=tEst(t)*60,secs=liveSecs();
  try{o.timer({state:r.since?"running":"paused",title:t.title,mode:r.mode,
    secs:secs,est:est,colour:cat(t.cat).color,over:r.mode==="countdown"&&est>0&&secs>est});}catch(e){}
}

/* ============ time analytics ============ */
const RANGES=[{id:"week",name:"This week"},{id:"7",name:"Last 7 days"},{id:"month",name:"This month"},{id:"all",name:"Everything"}];

function rangeStart(id){
  if(id==="week")return startOfWeek(today());
  if(id==="7")return addDays(today(),-6);
  if(id==="month")return new Date(today().getFullYear(),today().getMonth(),1);
  return new Date(1970,0,1);
}
function sessionsIn(id){
  const from=rangeStart(id).getTime();
  return S.sessions.filter(s=>s.start>=from&&visibleCat((taskById(s.task)||{}).cat));
}
/* A bar row, used for both the category and the task breakdown. */
function barRow(label,secs,max,colour,right){
  const w=max?Math.max(1.5,secs/max*100):0;
  return '<div class="brow"><div class="blab">'+label+'</div>'+
    '<div class="btrack"><div class="bfill" style="width:'+w.toFixed(1)+'%;--c:'+(colour||"var(--accent)")+'"></div></div>'+
    '<div class="bval num">'+esc(right||fmtDur(secs))+'</div></div>';
}

function viewTime(){
  const r=V.range||"week",ss=sessionsIn(r);
  const total=ss.reduce((n,s)=>n+s.secs,0);
  const taskIds=[];ss.forEach(s=>{if(taskIds.indexOf(s.task)===-1)taskIds.push(s.task);});

  /* by category */
  const byCat={};ss.forEach(s=>{const t=taskById(s.task);if(!t)return;byCat[t.cat]=(byCat[t.cat]||0)+s.secs;});
  const catRows=Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]);
  const catMax=catRows.length?byCat[catRows[0]]:0;

  /* by task, with the estimate alongside so over-runs are obvious */
  const byTask={};ss.forEach(s=>{byTask[s.task]=(byTask[s.task]||0)+s.secs;});
  const taskRows=Object.keys(byTask).sort((a,b)=>byTask[b]-byTask[a]).slice(0,12);
  const taskMax=taskRows.length?byTask[taskRows[0]]:0;

  /* by day across the range */
  const days=[],from=rangeStart(r),span=r==="all"
    ? Math.min(30,Math.max(1,Math.round((Date.now()-(ss.length?Math.min.apply(null,ss.map(s=>s.start)):Date.now()))/864e5)+1))
    : Math.round((today()-from)/864e5)+1;
  for(let i=span-1;i>=0;i--){const d=addDays(today(),-i),k=ymd(d);
    days.push({k:k,d:d,secs:ss.reduce((n,s)=>n+(ymd(new Date(s.start))===k?s.secs:0),0)});}
  const dayMax=Math.max.apply(null,days.map(d=>d.secs).concat([1]));

  const estTotal=taskIds.reduce((n,id)=>{const t=taskById(id);return n+(t?tEst(t)*60:0);},0);

  const tiles='<div class="tiles">'+
    '<div class="tile"><span class="tl">Tracked</span><b class="num">'+fmtDur(total)+'</b></div>'+
    '<div class="tile"><span class="tl">Sessions</span><b class="num">'+ss.length+'</b></div>'+
    '<div class="tile"><span class="tl">Tasks worked</span><b class="num">'+taskIds.length+'</b></div>'+
    '<div class="tile"><span class="tl">Estimated</span><b class="num">'+(estTotal?fmtDur(estTotal):"—")+'</b></div>'+
    '</div>';

  const dayChart='<div class="card pad"><h3 class="sec-label">By day</h3><div class="daybars">'+
    days.map(d=>'<div class="dbar" title="'+esc(fmtDate(d.k)+" · "+fmtDur(d.secs))+'">'+
      '<div class="dbar-track"><div class="dbar-fill" style="height:'+(d.secs/dayMax*100).toFixed(1)+'%"></div></div>'+
      '<span class="dbar-lab">'+(span<=14?DOWS[(d.d.getDay()+6)%7].slice(0,1):(d.d.getDate()%5===0?d.d.getDate():""))+'</span></div>').join("")+
    '</div></div>';

  const catCard='<div class="card pad"><h3 class="sec-label">By category</h3>'+
    (catRows.length?catRows.map(id=>barRow(icon(cat(id).icon,"ic-14")+esc(cat(id).name),byCat[id],catMax,cat(id).color)).join("")
      :'<p class="mnone">Nothing tracked in this range.</p>')+'</div>';

  const taskCard='<div class="card pad"><h3 class="sec-label">By task</h3>'+
    (taskRows.length?taskRows.map(id=>{const t=taskById(id);if(!t)return "";
        const est=tEst(t)*60,over=est&&byTask[id]>est;
        return barRow('<button class="lk lk-inline" data-act="task" data-id="'+id+'">'+esc(t.title)+'</button>',
          byTask[id],taskMax,cat(t.cat).color,
          fmtDur(byTask[id])+(est?(over?" · over "+fmtDur(byTask[id]-est):" of "+fmtDur(est)):""));}).join("")
      :'<p class="mnone">Nothing tracked in this range.</p>')+'</div>';

  const recent=ss.slice().sort((a,b)=>b.start-a.start).slice(0,14);
  const log='<div class="card pad"><h3 class="sec-label">Recent sessions</h3>'+
    (recent.length?'<div class="slist">'+recent.map(s=>{const t=taskById(s.task);
        return '<div class="srow"><span class="sdot" style="--c:'+(t?cat(t.cat).color:"var(--faint)")+'"></span>'+
          '<span class="stitle">'+esc(t?t.title:"Deleted task")+'</span>'+
          '<span class="smode">'+esc(s.mode==="countdown"?"Blitz":"Stopwatch")+'</span>'+
          '<span class="swhen">'+esc(relTime(s.start))+'</span>'+
          '<span class="ssecs num">'+fmtDur(s.secs)+'</span></div>';}).join("")+'</div>'
      :'<p class="mnone">No sessions yet. Start a timer from any task.</p>')+'</div>';

  return '<div class="an">'+
    '<div class="seg an-range">'+RANGES.map(x=>'<button data-act="an-range" data-v="'+x.id+'" aria-pressed="'+(r===x.id)+'">'+esc(x.name)+'</button>').join("")+'</div>'+
    tiles+dayChart+'<div class="an-two">'+catCard+taskCard+'</div>'+log+'</div>';
}


const hadLocal=loadLocal();
render();
if(hadLocal)saveLocal();

/* A document edited inside Obsidian arrives here. The planner never writes
   back in response, so the two sides cannot ping-pong. */
function applyVaultChange(d){
  if(!d||!d.id)return;
  const doc=docById(d.id);if(!doc)return;
  const sameText=doc.md===d.md,sameTitle=!d.title||doc.title===d.title;
  if(sameText&&sameTitle)return;
  doc.md=d.md;
  if(d.title)doc.title=d.title;
  doc.updated=Date.now();
  save("docs");
  logAct(doc.task,"doc-edit","Updated “"+doc.title+"” from the vault",{doc:doc.id});
  renderSheet();
  toast("Updated “"+doc.title+"” from your vault");
}

(function bindDesktop(){
  const o=desktop();if(!o)return;
  if(o.onTimerCmd)o.onTimerCmd(function(d){
    if(!d||!d.cmd)return;
    const r=running();
    if(d.cmd==="toggle"&&r)toggleTimer(r.task);
    else if(d.cmd==="stop")stopTimer();
  });
  if(o.onVaultChange)o.onVaultChange(applyVaultChange);
  /* Keep the shell in step with the path the planner remembers. */
  if(o.useVault&&vaultPath())try{o.useVault(vaultPath());}catch(e){}
})();

/* In the hosted copy, wait for the cloud check before offering a fresh start,
   so a slow connection can never invite someone to overwrite existing data. */
if(window.claude&&window.claude.use)connect().then(maybeWelcome,maybeWelcome);
else{maybeWelcome();connect();}
setInterval(()=>{if(V.view==="calendar"&&V.calMode==="week"&&!el("modalRoot").innerHTML)renderView();},60000);

/* The clock ticks in place. A full render every second would fight anything
   being typed, so only the two readouts are touched. */
setInterval(function(){
  const r=running();
  if(!r||!r.since)return;
  const t=taskById(r.task);if(!t)return;
  const secs=liveSecs(),est=tEst(t)*60;
  const over=r.mode==="countdown"&&est&&secs>est;
  const bar=document.querySelector(".tbar-time");
  if(bar){
    bar.textContent=(over?"+":"")+fmtDur(r.mode==="countdown"&&est?Math.abs(est-secs):secs);
    const wrap=bar.closest(".tbar");if(wrap)wrap.classList.toggle("over",!!over);
  }
  const read=document.querySelector(".tm-read b");
  if(read&&V.sheet&&V.sheet.id===r.task)read.textContent=fmtDur(trackedSecs(r.task)+secs);
  syncTimerWindow();
},1000);

/* A timer left running when the app closed keeps its accumulated seconds but
   does not keep counting through time the app was not open. */
(function resumeTimer(){
  const r=running();
  if(r&&r.since){S.prefs.running=Object.assign({},r,{acc:liveSecs(),since:0});save("prefs");}
  syncTimerWindow();
})();
})();
