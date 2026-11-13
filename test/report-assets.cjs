const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=new Set(['healthcheck-report-layout.js','healthcheck-report-layout.css','paged-0.4.3.min.js','pretendard-variable-1.3.9.woff2']);
async function routeReportAssets(context){
 await context.route('**/*',r=>{const name=new URL(r.request().url()).pathname.split('/').pop();if(!files.has(name))return r.continue();return r.fulfill({body:fs.readFileSync(path.join(root,name)),contentType:name.endsWith('.css')?'text/css':name.endsWith('.woff2')?'font/woff2':'application/javascript',headers:{'Access-Control-Allow-Origin':'*'}});});
}
module.exports={routeReportAssets};
