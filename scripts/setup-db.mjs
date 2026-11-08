import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {app,local,evidence,ownedNames,connect,runFile} from './db-common.mjs';

const admin=await connect(undefined,true);
try{
  const [existing]=await admin.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (?,?)',ownedNames);
  const proof=path.join(local,'db-owned.json');
  if(existing.length){
    if(!fs.existsSync(proof))throw new Error('A P1 database name already exists without our ownership record; no existing data was changed');
    console.log('Owned P1 databases already exist; setup did not reset or modify them.');
  }else{
    const [accounts]=await admin.query("SELECT User FROM mysql.user WHERE User='sa_web_p1' AND Host='127.0.0.1'");
    if(accounts.length)throw new Error('P1 app account name is already used; no account was overwritten');
    fs.mkdirSync(local,{recursive:true});
    const password=crypto.randomBytes(32).toString('hex');
    for(const name of ownedNames)await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await admin.query("CREATE USER 'sa_web_p1'@'127.0.0.1' IDENTIFIED BY ?",[password]);
    for(const name of ownedNames)await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${name}\`.* TO 'sa_web_p1'@'127.0.0.1'`);
    fs.writeFileSync(path.join(app,'.env.local'),`DB_HOST=127.0.0.1\nDB_PORT=3306\nDB_USER=sa_web_p1\nDB_PASSWORD=${password}\nDB_NAME=sa_web_dev_p1\nDB_TEST_NAME=sa_web_test_p1\nAPP_URL=http://localhost:3000\nSESSION_SECRET=${crypto.randomBytes(32).toString('hex')}\nNEXT_TELEMETRY_DISABLED=1\n`);
    fs.writeFileSync(proof,JSON.stringify({created_at:new Date().toISOString(),scope:'Isolated P1 candidate only; pending G1',databases:ownedNames,account:'sa_web_p1@127.0.0.1'},null,2)+'\n');
    for(const name of ownedNames){const c=await connect(name,true);try{await runFile(c,'001-p1-candidate.sql');await runFile(c,'seed-p1.sql');}finally{await c.end();}}
    const c=await connect(ownedNames[0],true);
    const credentials=[];
    try{const [employees]=await c.query('SELECT employee_id, role, is_active FROM employee');for(const e of employees){const demoPassword=crypto.randomBytes(12).toString('base64url');await c.execute('UPDATE employee SET password_hash=? WHERE employee_id=?',[await bcrypt.hash(demoPassword,12),e.employee_id]);credentials.push({...e,password:demoPassword});}}finally{await c.end();}
    fs.writeFileSync(path.join(local,'demo-credentials.json'),JSON.stringify({note:'Synthetic local demo accounts only, no real team member accounts; login implementation is P2',employees:credentials},null,2)+'\n');
    console.log('Created two isolated P1 databases and a scoped app account. Credentials written locally, not printed.');
  }
  const c=await connect(ownedNames[0],true);
  try{
    const [[version]]=await c.query('SELECT VERSION() AS database_version, @@port AS port, @@character_set_database AS charset, @@collation_database AS collation');
    const [tables]=await c.execute("SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME",[ownedNames[0]]);
    fs.writeFileSync(path.join(evidence,'environment.json'),JSON.stringify({recorded_at:new Date().toISOString(),...version,node:process.version,databases:ownedNames,tables,scope:'P1 scratch candidate, not production; no original databases changed'},null,2)+'\n');
    console.log(JSON.stringify({database_version:version.database_version,databases:ownedNames,business_tables:tables.filter(t=>t.TABLE_TYPE==='BASE TABLE').length}));
  }finally{await c.end();}
}finally{await admin.end();}
