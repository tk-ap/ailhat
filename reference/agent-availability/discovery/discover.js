// Agent Control domain discovery endpoint.
// Stage 1: crawl same-domain pages and extract evidence.
// Stage 2: infer an agent profile from the evidence without inventing unknowns.
const MAX_PAGES = 12;
const MAX_LINKS_PER_PAGE = 40;
const TIMEOUT_MS = 8000;

const absolute = (base, href) => { try { return new URL(href, base).href.split('#')[0]; } catch { return null; } };
const sameOrigin = (a,b) => { try { return new URL(a).origin === new URL(b).origin; } catch { return false; } };
const clean = s => String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
const titleOf = html => (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.trim() || '';
const meta = (html,name) => ((html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))||[])[1]||'').trim();
const textSignals = text => { const t=text.toLowerCase(); const keys=['ai','agent','assistant','automation','api','integration','workflow','knowledge base','support','analytics','recommend','search','summarize','classify','security','authorization','dashboard','customer']; return keys.filter(k=>t.includes(k)); };
const extractLinks = (html,base) => [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)].map(m=>absolute(base,m[1])).filter(u=>u&&sameOrigin(u,base)&&!u.match(/\.(png|jpg|jpeg|gif|svg|pdf|zip|mp4|webp)(\?|$)/i));

async function fetchPage(url){
  const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try { const r=await fetch(url,{redirect:'follow',cache:'no-store',signal:controller.signal,headers:{'user-agent':'Agent-Control-Discovery/1.0'}}); const html=await r.text(); return {url:r.url,status:r.status,ok:r.ok,html}; }
  catch(e){ return {url,status:null,ok:false,html:'',error:String(e?.message||e)}; }
  finally{clearTimeout(timer)}
}

function infer(evidence, domain){
  const corpus=evidence.map(x=>x.text).join(' ').toLowerCase();
  const hits=(terms)=>terms.reduce((n,t)=>n+(corpus.includes(t)?1:0),0);
  const capabilityMap=[
    ['Search',['search','find information','query']],['Summarize',['summarize','summary']],['Analyze',['analytics','analy','insight','report']],['Recommend',['recommend','recommendation','personalized']],['Automate',['automation','automate','workflow']],['Communicate',['chat','assistant','support','conversation']],['Execute',['execute','action','trigger']],['Monitor',['monitor','monitoring','alerts']],['Generate',['generate','generation','create content']],['Classify',['classify','classification','categorize']]
  ];
  const capabilities=capabilityMap.filter(([,terms])=>hits(terms)>0).map(([name,terms])=>({value:name,confidence:Math.min(0.96,0.55+hits(terms)*0.08),evidence:evidence.filter(x=>terms.some(t=>x.text.toLowerCase().includes(t))).slice(0,3).map(x=>x.url)}));
  const toolTerms=['api','integration','webhook','connect','crm','slack','github','database','stripe','salesforce','hubspot'];
  const tools=evidence.flatMap(x=>toolTerms.filter(t=>x.text.toLowerCase().includes(t)).map(t=>({value:t,evidence:x.url}))).filter((v,i,a)=>a.findIndex(x=>x.value===v.value)===i);
  const agentish=hits(['ai','agent','assistant','automation'])>0;
  const identityConfidence=Math.min(0.95,0.45+Math.min(5,evidence.length)*0.07+(agentish?0.15:0));
  const primaryFunction=agentish ? (hits(['support','customer'])>0?'Customer support automation':hits(['sales','lead'])>0?'Sales automation':hits(['research','knowledge'])>0?'Research and knowledge work':hits(['security','authorization'])>0?'Security and authorization':hits(['workflow','automation'])>0?'Workflow automation':'AI-assisted workflow') : 'Insufficient evidence to define primary function';
  const contextConfidence=Math.min(0.95,0.25+Math.min(7,evidence.length)*0.06+(hits(['documentation','knowledge base','help center','docs'])>0?0.2:0));
  const objectiveConfidence=Math.min(0.9,0.25+(primaryFunction!=='Insufficient evidence to define primary function'?0.45:0));
  return {identity:{name:titleOf(evidence[0]?.raw||'')||domain,primaryFunction,confidence:identityConfidence},capabilities,tools,context:{knownSources:evidence.filter(x=>/docs|documentation|knowledge|help|about|product/i.test(x.url+' '+x.text)).slice(0,8).map(x=>x.url),confidence:contextConfidence},objective:{inferred:primaryFunction,confidence:objectiveConfidence},unknowns:[tools.length?'':'Tool execution authority',evidence.length>2?'':'Operational context',capabilities.length?'':'Concrete capabilities','Reliability / failure performance'].filter(Boolean)};
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'POST required'});
  const input=String(req.body?.domain||'').trim(); if(!input) return res.status(400).json({ok:false,error:'domain is required'});
  let root; try { root=new URL(/^https?:\/\//i.test(input)?input:`https://${input}`); } catch { return res.status(400).json({ok:false,error:'Invalid domain'}); }
  const queue=[root.href], seen=new Set(), evidence=[];
  while(queue.length && evidence.length<MAX_PAGES){
    const url=queue.shift(); if(seen.has(url)) continue; seen.add(url);
    const page=await fetchPage(url); if(!page.ok) continue;
    const text=clean(page.html); const item={url:page.url,title:titleOf(page.html),description:meta(page.html,'description')||meta(page.html,'og:description'),signals:textSignals(text),text:text.slice(0,12000),raw:page.html}; evidence.push(item);
    for(const link of extractLinks(page.html,page.url).slice(0,MAX_LINKS_PER_PAGE)) if(!seen.has(link)&&queue.length<MAX_PAGES*3) queue.push(link);
  }
  const profile=infer(evidence,root.hostname);
  return res.status(200).json({ok:true,stage:'discovered-and-profiled',domain:root.origin,pages:evidence.map(({url,title,description,signals,text})=>({url,title,description,signals,excerpt:text.slice(0,600)})),profile,scannedAt:new Date().toISOString(),pageCount:evidence.length});
}
