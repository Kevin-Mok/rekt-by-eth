await page.open('http://127.0.0.1:4317');
await page.click('#clear-data');await page.fill('#wallets','bad-address');await page.press('Tab');await page.press('Enter');
const state=JSON.parse(await page.eval(()=>JSON.stringify({active:document.activeElement.id,invalid:document.querySelector('#wallets').getAttribute('aria-invalid'),error:document.querySelector('#form-error').textContent,overflow:document.documentElement.scrollWidth>innerWidth,role:document.querySelector('#form-error').getAttribute('role'),label:document.querySelector('label[for="wallets"]').textContent})));
if(state.active!=='wallets'||state.invalid!=='true'||state.role!=='alert')throw Error('Keyboard validation must announce errors and return focus to input');
if(state.overflow)throw Error('Page must not overflow horizontally');
console.log('PASS: keyboard form submission, focused accessible validation and viewport containment');
