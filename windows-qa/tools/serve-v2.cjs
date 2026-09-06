const http=require('http');
const fs=require('fs');
const path=require('path');
const root=path.resolve(process.argv[2]||'dist');
const port=Number(process.argv[3]||5178);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.map':'application/json'};
const server=http.createServer((req,res)=>{
  try{
    const u=new URL(req.url,'http://127.0.0.1');
    let pathname=decodeURIComponent(u.pathname);
    if(pathname==='/'||pathname==='') pathname='/index.html';
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end('Forbidden');return;}
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  }catch(e){res.writeHead(500);res.end(String(e));}
});
server.listen(port,'127.0.0.1',()=>console.log(`TUINBOOKS V2 QA SERVER http://127.0.0.1:${port}`));
