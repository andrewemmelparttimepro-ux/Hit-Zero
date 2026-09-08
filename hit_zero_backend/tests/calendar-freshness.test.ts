Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','private-test-only');
const realFetch=globalThis.fetch;const realNow=Date.now;let clock=new Date('2026-09-08T12:00:00Z').getTime();Date.now=()=>clock;
const ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:private-fixture\r\nDTSTART:20260909T120000Z\r\nDTEND:20260909T130000Z\r\nSUMMARY:Private fixture\r\nEND:VEVENT\r\nEND:VCALENDAR';
let sourceCalls=0;let writes=0;let failure=false;
globalThis.fetch=async(input:any,init:any={})=>{
 if(String(input).includes('calendar.google.com')){sourceCalls++;return new Response(failure?'not an ICS feed':ics,{status:200});}
 if(init.method==='POST'){writes++;return new Response(null,{status:201});}
 return Response.json({ics_text:ics,source_fetched_at:new Date(clock-60000).toISOString()});
};
const {handleRequest}=await import('../functions/mca-calendar-v1/index.ts');
Deno.test('forced refresh awaits source; failed refresh preserves last good calendar and disables HTTP caching',async()=>{
 try{
  const url='https://example.test/calendar?from=2026-09-08&to=2026-09-12';
  const cached=await handleRequest(new Request(url));if((await cached.json()).events.length!==1 || Number(sourceCalls)!==0)throw new Error('Fresh shared calendar was not reused');
  const forced=await handleRequest(new Request(url+'&refresh=1'));const fresh=await forced.json();if(fresh.stale || Number(sourceCalls)!==1 || Number(writes)!==1 || forced.headers.get('cache-control')!=='no-store')throw new Error('Refresh did not await the live feed');
  clock+=11000;failure=true;const fallback=await handleRequest(new Request(url+'&refresh=2'));const stale=await fallback.json();if(!stale.stale || !stale.refreshError || stale.events.length!==1 || Number(writes)!==1 || fallback.headers.get('cache-control')!=='no-store')throw new Error('Invalid source replaced good dates or looked fresh');
 }finally{globalThis.fetch=realFetch;Date.now=realNow;}
});

Deno.test('recurrence cancellations and all-day exclusive ends survive expansion',async()=>{
 const {expandCalendar}=await import('../functions/mca-calendar-v1/index.ts');
 const feed=['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT','UID:recurring-fixture','DTSTART:20260909T120000Z','DTEND:20260909T130000Z','RRULE:FREQ=DAILY;COUNT=3','EXDATE:20260910T120000Z','SUMMARY:Private recurrence','END:VEVENT','BEGIN:VEVENT','UID:recurring-fixture','RECURRENCE-ID:20260911T120000Z','DTSTART:20260911T120000Z','DTEND:20260911T130000Z','STATUS:CANCELLED','END:VEVENT','BEGIN:VEVENT','UID:day-fixture','DTSTART;VALUE=DATE:20260909','DTEND;VALUE=DATE:20260911','SUMMARY:Private closure','END:VEVENT','END:VCALENDAR'].join('\r\n');
 const result=expandCalendar(feed,new Date('2026-09-08'),new Date('2026-09-12'));
 if(result.events.length!==2 || !result.events.some(e=>e.allDay && e.end==='2026-09-11T00:00:00.000Z') || result.events.filter(e=>e.recurring).length!==1)throw new Error('Cancelled occurrence or exclusive all-day end changed');
});
