import {createFixtureServer} from '../src/server.mjs';
import {createRunManager} from '../src/runs.mjs';
const runs=await createRunManager();
const app=await createFixtureServer({port:Number(process.env.PORT||3000),runs});
const stop=async()=>{await runs.close();await app.close();};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
console.log(`TabProof console: ${app.origin}`);
