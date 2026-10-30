// Run with chrome-devtools-axi run < tests/browser-ui.js against the local server.
await page.open('http://127.0.0.1:4317');
const initial=await page.eval(()=>({input:!!document.querySelector('#wallets'),form:!!document.querySelector('#wallet-form'),results:document.querySelector('#results')?.hidden,externalScripts:document.querySelectorAll('script[src],link[rel="stylesheet"]').length}));
if(!initial.input || !initial.form)throw Error('Wallet input and calculator form must exist on the landing page');
if(initial.results!==true)throw Error('Results must stay hidden before a calculation');
if(initial.externalScripts!==0)throw Error('The site must be self-contained');
await page.fill('#wallets','vitalik.eth');await page.click('#calculate');
const invalid=await page.eval(()=>({text:document.querySelector('#form-error').textContent,invalid:document.querySelector('#wallets').getAttribute('aria-invalid')}));
if(!/address/i.test(invalid.text) || invalid.invalid!=='true')throw Error('Malformed input needs accessible validation feedback');
console.log('PASS: self-contained landing form and invalid-address feedback');
