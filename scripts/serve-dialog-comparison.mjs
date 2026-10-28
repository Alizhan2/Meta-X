import {createDialogComparisonSite} from './dialog-comparison-site.mjs';
const app=await createDialogComparisonSite({port:4207});
console.log(`Before: ${app.origin}/before\nAfter:  ${app.origin}/after\nOpener: #open-details\nDialog: #details-dialog`);
process.on('SIGINT',async()=>{await app.close();process.exit(0);});
process.on('SIGTERM',async()=>{await app.close();process.exit(0);});
