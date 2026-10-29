import {createDispatchSite,releases} from './dispatch-site.mjs';
const site=await createDispatchSite({port:4217});
console.log(`DispatchDesk before: ${site.origin+releases.before}\nDispatchDesk after: ${site.origin+releases.after}`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await site.close();process.exit(0);});
