import {createFixtureServer} from '../src/server.mjs';
import {createRunManager} from '../src/runs.mjs';
const runs=await createRunManager();
const app=await createFixtureServer({port:Number(process.env.PORT||3000),runs});
const stop=async()=>{
  try{await runs.close();await app.close();}
  catch(error){console.error(`Shutdown failed: ${error.message}`);process.exitCode=1;}
};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
console.log(`TabProof console: ${app.origin}`);
