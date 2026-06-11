type SupabaseAuthUser = {
  id?: string;
  email?: string;
};

export async function verifySupabaseUserId(authorization?: string) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const token = authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  const user = (await response.json()) as SupabaseAuthUser;
  return user.id ?? null;
}
