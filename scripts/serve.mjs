#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const args=process.argv.slice(2),plain=args.includes('--plain'),icon=plain?'[serve]':'🌐';
if(args.includes('--help')){console.log(`${icon} Serve the self-contained site locally\nUsage: node scripts/serve.mjs [--port 4317] [--plain]\nRetries occupied ports automatically. Only / and /index.html are served.`);process.exit(0);}
let port=args.includes('--port')?Number(args[args.indexOf('--port')+1]):4317;
if(!Number.isInteger(port)||port<1||port>65535){console.error(`${icon} Choose a port from 1 to 65535.`);process.exit(1);}
const firstPort=port;
const server=createServer(async(req,res)=>{
  if(!['/','/index.html','/favicon.ico'].includes(req.url?.split('?')[0])){res.writeHead(404);res.end('Not found');return;}
  if(req.url?.split('?')[0]==='/favicon.ico'){res.writeHead(204);res.end();return;}
  try{const html=await readFile(new URL('../index.html',import.meta.url));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(html);}
  catch{res.writeHead(500);res.end('Site unavailable; check index.html.');}
});
server.on('error',error=>{
  if(error.code==='EADDRINUSE'&&port<65535&&port-firstPort<100){console.log(`${icon} Port ${port} is occupied; trying ${port+1}.`);port++;server.listen(port,'127.0.0.1');}
  else{console.error(`${icon} Cannot start local server: ${error.message}`);process.exit(1);}
});
server.on('listening',()=>console.log(`${icon} Wallet gas ready: http://127.0.0.1:${port}\n${icon} Press Ctrl+C to stop. No install or build needed.`));
server.listen(port,'127.0.0.1');
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
