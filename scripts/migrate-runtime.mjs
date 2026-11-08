import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {local,evidence,ownedNames,connect,runFile} from './db-common.mjs';
if(!fs.existsSync(path.join(local,'db-owned.json')))throw new Error('Missing database ownership record');
const backups=path.join(local,'backups');fs.mkdirSync(backups,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const dump=path.join(backups,`before-g1-${stamp}.sql`);
const run=spawnSync('C:/xampp/mysql/bin/mysqldump.exe',['--host=127.0.0.1','--port=3306','--user=root','--single-transaction','--databases',...ownedNames,`--result-file=${dump}`],{env:{...process.env,MYSQL_PWD:process.env.SA_DB_ADMIN_PASSWORD||''},encoding:'utf8',windowsHide:true});
if(run.status!==0)throw new Error('Database backup did not finish; migration was not started');
for(const name of ownedNames){const c=await connect(name,true);try{await runFile(c,'002-runtime.sql');}finally{await c.end();}}
const marker=path.join(local,'runtime-token-migration.json');
if(!fs.existsSync(marker)){
  const c=await connect(ownedNames[0],true);
  try{await c.beginTransaction();const [links]=await c.query('SELECT link_id,token FROM access_link FOR UPDATE');const examples=[];for(const l of links){const token=l.token;await c.execute('UPDATE access_link SET token=? WHERE link_id=?',[crypto.createHash('sha256').update(token).digest('hex'),l.link_id]);examples.push({link_id:l.link_id,url:`${process.env.APP_URL}/access?token=${token}`});}await c.commit();fs.writeFileSync(path.join(local,'customer-demo-links.json'),JSON.stringify({note:'Synthetic seed links only; raw tokens remain local and are never logged',links:examples},null,2)+'\n');fs.writeFileSync(marker,JSON.stringify({applied_at:new Date().toISOString(),database:ownedNames[0]},null,2)+'\n');}catch(e){await c.rollback();throw e;}finally{await c.end();}
}
const creds=JSON.parse(fs.readFileSync(path.join(local,'demo-credentials.json'),'utf8'));
fs.writeFileSync(path.join(local,'LOGIN.md'),'# บัญชีสมมติสำหรับตรวจระบบ\n\nเก็บไฟล์นี้ไว้เฉพาะเครื่อง ไม่ใช้กับข้อมูลจริง\n\n| รหัส | สิทธิ์ | รหัสผ่าน | เปิดใช้ |\n|---|---|---|---|\n'+creds.employees.map(e=>`| ${e.employee_id} | ${e.role} | ${e.password} | ${e.is_active?'ใช่':'ไม่ใช่'} |`).join('\n')+'\n');
fs.writeFileSync(path.join(evidence,'runtime-migration.json'),JSON.stringify({applied_at:new Date().toISOString(),status:'PASS',backup:'Local private backup created before migration; path omitted',databases:ownedNames,technical_tables:['app_session'],business_tables:9,token_storage:'SHA-256 digest, dev seed migrated exactly once'},null,2)+'\n');
console.log('Runtime session migration applied to owned databases. Private backup and local test-login files created; no credentials printed.');
