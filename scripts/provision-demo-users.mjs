import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const projectUrl = process.env.VITE_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!projectUrl || !serviceRoleKey) {
  throw new Error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the root .env file.');
}

if (!serviceRoleKey.startsWith('sb_secret_')) {
  const payload = serviceRoleKey.split('.')[1];
  let role;
  try {
    role = payload ? JSON.parse(Buffer.from(payload, 'base64url').toString()).role : null;
  } catch {
    role = null;
  }
  if (role !== 'service_role') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be a Supabase secret/service_role key, never the anon key.');
  }
}

const usersToCreate = [
  { email: 'citizen@vayugati.gov.in', fullName: 'Citizen Observer', role: 'citizen' },
  { email: 'officer@vayugati.gov.in', fullName: 'Duty Officer', role: 'officer' },
  { email: 'admin@vayugati.gov.in', fullName: 'Administrator', role: 'admin' },
];

const supabase = createClient(projectUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findExistingUsers() {
  const existing = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data.users || [];
    existing.push(...users.filter((user) => usersToCreate.some((entry) => entry.email === user.email?.toLowerCase())));
    if (users.length < 1000) break;
  }
  return existing;
}

async function provisionUsers() {
  const existing = await findExistingUsers();
  if (existing.length) {
    throw new Error(`These accounts already exist; no changes were made: ${existing.map((user) => user.email).join(', ')}. Reset existing passwords in Supabase Auth instead.`);
  }

  const credentials = usersToCreate.map((user) => ({
    ...user,
    password: randomBytes(24).toString('base64url'),
  }));
  const createdUserIds = [];

  try {
    const profiles = [];
    for (const account of credentials) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName },
      });
      if (error) throw error;
      createdUserIds.push(data.user.id);
      profiles.push({
        id: data.user.id,
        email: account.email,
        full_name: account.fullName,
        role: account.role,
      });
    }

    const { error: profileError } = await supabase.from('users').upsert(profiles, { onConflict: 'id' });
    if (profileError) throw profileError;

    console.log('Save these one-time generated credentials securely:');
    console.log(JSON.stringify(credentials, null, 2));
  } catch (error) {
    for (const userId of createdUserIds.reverse()) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteError) console.error(`Could not roll back newly created user ${userId}: ${deleteError.message}`);
    }
    throw error;
  }
}

provisionUsers().catch((error) => {
  console.error(`Account provisioning failed: ${error.message}`);
  process.exitCode = 1;
});