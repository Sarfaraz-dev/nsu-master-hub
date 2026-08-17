const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SESSION_KEY = 'nsu-master-hub-supabase-session';

export const cloud = {
  configured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),

  get storedSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  },

  setSession(session) {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  },

  async request(path, options = {}) {
    if (!this.configured) {
      throw new Error(
        'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }

    const session = this.storedSession;

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const res = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers,
    });

    const text = await res.text();

    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      throw new Error(
        data?.message ||
        data?.error_description ||
        data?.hint ||
        text ||
        `Supabase error ${res.status}`
      );
    }

    return data;
  },

  async signIn(email, password) {
    const data = await this.request(
      '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );

    this.setSession(data);

    return data.user;
  },

  async signUp(email, password) {
    const data = await this.request(
      '/auth/v1/signup',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );

    if (data?.access_token) {
      this.setSession(data);
    }

    return data.user || null;
  },

  async signOut() {
    try {
      if (this.storedSession) {
        await this.request('/auth/v1/logout', {
          method: 'POST',
        });
      }
    } finally {
      this.setSession(null);
    }
  },

  async getUser() {
    if (!this.storedSession?.access_token) {
      return null;
    }

    try {
      return await this.request('/auth/v1/user', {
        method: 'GET',
      });
    } catch {
      this.setSession(null);
      return null;
    }
  },

  async isAdmin(userId) {
    if (!userId) {
      return false;
    }

    const rows = await this.request(
      `/rest/v1/app_admins?select=user_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`
    );

    return Array.isArray(rows) && rows.length > 0;
  },

  async loadUserState(userId) {
    const rows = await this.request(
      `/rest/v1/user_states?select=snapshot&user_id=eq.${encodeURIComponent(userId)}&limit=1`
    );

    return rows?.[0]?.snapshot || null;
  },

  async saveUserState(userId, snapshot) {
    return this.request('/rest/v1/user_states', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        snapshot,
        updated_at: new Date().toISOString(),
      }),
    });
  },

  async listResources() {
    return this.request(
      '/rest/v1/resources?select=*&order=name.asc'
    );
  },

  async createResource(resource) {
    const rows = await this.request(
      '/rest/v1/resources',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(resource),
      }
    );

    return rows?.[0] || null;
  },

  async updateResource(id, resource) {
    const rows = await this.request(
      `/rest/v1/resources?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          ...resource,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    return rows?.[0] || null;
  },

  async deleteResource(id) {
    return this.request(
      `/rest/v1/resources?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          Prefer: 'return=minimal',
        },
      }
    );
  },
};