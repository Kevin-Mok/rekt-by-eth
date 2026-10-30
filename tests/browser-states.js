// fixture, prices, wallets are injected by scripts/browser-check.py from saved public evidence.
function check(condition,message){if(!condition)throw Error(message);}
async function state(){return JSON.parse(await page.eval(()=>JSON.stringify({resultsVisible:!document.querySelector('#results').hidden,error:document.querySelector('#form-error').textContent,busy:document.querySelector('#calculate').disabled,wei:document.querySelector('#exact-wei').textContent,eth:document.querySelector('#total-eth').textContent,usd:document.querySelector('#total-usd').textContent,quality:document.querySelector('#quality').textContent,label:document.querySelector('#usd-label').textContent,rows:document.querySelectorAll('#wallet-rows tr').length,resume:!document.querySelector('#resume-row').hidden,history:document.querySelector('#completeness').textContent,failed:document.querySelector('#failed-line').textContent,storage:document.querySelector('#storage-note').textContent})));}
async function waitDone(){await page.wait('#calculate:not([disabled])',30000);}
async function install(mode='normal'){
  const setup={fixture,prices,wallets,mode};
  await page.eval('() => { const data='+JSON.stringify(setup)+'; window.__calls=[]; window.__capture=null; document.addEventListener("gas-results",e=>window.__capture=e.detail); const original=window.fetch; window.fetch=async(url,options={})=>{ const u=new URL(url);window.__calls.push(u.href);if(u.pathname.endsWith("/blocks"))return new Response(JSON.stringify({items:[{height:data.wallets.small_failed.cutoff_block}]}));if(u.pathname.includes("/addresses/")){ if(data.mode==="slow")return new Promise((resolve,reject)=>{options.signal.addEventListener("abort",()=>reject(new DOMException("cancelled","AbortError")),{once:true});}); const small=u.pathname.toLowerCase().includes(data.wallets.small_failed.address.toLowerCase());return new Response(JSON.stringify({items:small?data.fixture.response.items:[],next_page_params:null}));}if(u.hostname==="api.exchange.coinbase.com"){if(data.mode==="missing")return new Response("[]");const rows=Object.entries(data.prices).map(([day,price])=>[Date.parse(day)/1000,1,1,1,Number(price),1]);return new Response(JSON.stringify(rows));}return original(url,options);}; }');
}
await page.open('http://127.0.0.1:4317');
await page.eval(()=>{localStorage.removeItem(Gas.JOB_KEY);localStorage.removeItem(Gas.PRICE_KEY);});
await page.open('http://127.0.0.1:4317');
await install();
await page.fill('#wallets',wallets.small_failed.address+'\n'+wallets.empty.address+'\n'+wallets.small_failed.address.toLowerCase());
await page.click('#calculate');await waitDone();
let result=await state();
check(result.rows===2,'Deduplicated multiple-wallet results must have two rows');
check(result.wei.startsWith(wallets.small_failed.fee_wei+' wei'),'Captured exact fee must match page');
check(result.failed.startsWith('10 failed transactions'),'Failed subset must be shown');
check(result.label.includes('incomplete') && result.usd==='$92.42','Missing current-day quotes must produce an explicit priced subtotal');
check(result.history==='History complete','Terminal complete history must be labelled');
console.log('PASS: captured multiple/failed/empty wallets, exact wei, missing USD and duplicate inputs');
await page.open('http://127.0.0.1:4317');
check((await state()).resume,'Reload must offer validated saved snapshot without fetching');
await install();await page.click('#resume');await waitDone();
result=await state();check(result.wei.startsWith(wallets.small_failed.fee_wei+' wei'),'Resume must not double count fees');
const requests=JSON.parse(await page.eval(()=>JSON.stringify(window.__calls)));
check(!requests.some(url=>url.includes('/addresses/')),'Completed wallet snapshot must resume without refetching history');
console.log('PASS: reload/resume restores snapshot without duplicate fees or address requests');
await page.eval(()=>localStorage.setItem(Gas.PRICE_KEY,'malformed cache'));
await install('missing');await page.fill('#wallets',wallets.empty.address);await page.click('#calculate');await waitDone();
result=await state();check(result.eth==='0' && result.usd==='$0.00','Empty wallet must show zero ETH and USD');
console.log('PASS: empty wallet and malformed price cache');
await install('slow');await page.fill('#wallets',wallets.small_failed.address);await page.click('#calculate');
await page.wait('#cancel:not([hidden])');await page.click('#cancel');await waitDone();
result=await state();check(result.history==='Partial history' && /cancelled/i.test(result.quality),'Cancel must preserve a visibly incomplete snapshot');
console.log('PASS: cancellation is partial and resumable');
await page.eval(()=>localStorage.setItem(Gas.JOB_KEY,'{"version":99}'));
await page.open('http://127.0.0.1:4317');
result=await state();check(/could not be validated/i.test(result.storage),'Malformed persisted snapshot needs a clear recovery message');
await page.click('#clear-data');
check(await page.eval(()=>localStorage.getItem(Gas.JOB_KEY)===null && localStorage.getItem(Gas.PRICE_KEY)===null),'Clear local data must remove app keys');
console.log('PASS: corrupt snapshot recovery and clear-local-data control');
await install();
await page.eval(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota full','QuotaExceededError');};});
await page.fill('#wallets',wallets.small_failed.address);await page.click('#calculate');await waitDone();
result=await state();check(result.wei.startsWith(wallets.small_failed.fee_wei+' wei') && /memory/i.test(result.storage),'Quota errors must preserve in-memory results and warn about persistence');
console.log('PASS: quota errors retain results in memory with an explicit storage warning');

// Snapshot regressions found by independent UI review.
await page.open('http://127.0.0.1:4317');await install();
await page.fill('#wallets',wallets.small_failed.address);await page.click('#calculate');await waitDone();
const goodJob=JSON.parse(await page.eval(()=>localStorage.getItem(Gas.JOB_KEY)));
const failures=[];
const arrayJob={...goodJob,wallets:[]};
await page.eval('() => localStorage.setItem(Gas.JOB_KEY,'+JSON.stringify(JSON.stringify(arrayJob))+')');
await page.open('http://127.0.0.1:4317');
if((await state()).resume)failures.push('saved wallet map arrays must be rejected');
const mismatch=JSON.parse(JSON.stringify(goodJob));Object.values(mismatch.wallets)[0].asOf='2035-01-01T00:00:00.000Z';
await page.eval('() => localStorage.setItem(Gas.JOB_KEY,'+JSON.stringify(JSON.stringify(mismatch))+')');
await page.open('http://127.0.0.1:4317');
if((await state()).resume)failures.push('checkpoint asOf must match containing job');
await page.eval('() => localStorage.setItem(Gas.JOB_KEY,'+JSON.stringify(JSON.stringify(goodJob))+')');
await page.open('http://127.0.0.1:4317');
await page.eval(()=>{window.fetch=async()=>new Response('{}',{status:400});});
await page.fill('#wallets',wallets.empty.address);await page.click('#calculate');await waitDone();
result=await state();
if(result.resultsVisible || !/400|cutoff|source/i.test(result.error))failures.push('failed fresh lookup must not paint old snapshot as requested results');
check(failures.length===0,failures.join('; '));
console.log('PASS: aggregate snapshot metadata validation and fresh-request failure isolation');
await page.eval('() => localStorage.setItem(Gas.JOB_KEY,'+JSON.stringify(JSON.stringify(goodJob))+')');
await page.open('http://127.0.0.1:4317');
await page.eval(()=>{window.fetch=async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true}));});
await page.fill('#wallets',wallets.empty.address);await page.click('#calculate');await page.click('#cancel');await waitDone();
result=await state();check(!result.resultsVisible && /cancel/i.test(result.error),'Cancelled fresh block lookup must not paint a prior snapshot');
console.log('PASS: cancellation during a fresh snapshot lookup keeps old results out of view');
