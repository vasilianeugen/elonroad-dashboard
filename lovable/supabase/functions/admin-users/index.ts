import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://its.elonroadinsights.com",
  "https://itselonroadinsightscom.lovable.app",
  "https://id-preview--751305cd-b929-4d88-ab3f-f8906d53d017.lovable.app",
  "https://751305cd-b929-4d88-ab3f-f8906d53d017.lovableproject.com",
  "http://localhost:8080",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  };
}

function validateDisplayName(name: string | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (trimmed.length > 100) {
    throw new Error("Display name must be 100 characters or less");
  }
  if (!/\S/.test(trimmed)) return "";
  return trimmed;
}

function sanitizeError(error: any): string {
  if (error?.code === "23505") return "This record already exists";
  if (error?.code === "23503") return "Referenced record not found";
  if (error?.code === "weak_password") return "Password is too weak or has been found in a data breach. Please choose a different password.";
  if (error?.message?.includes("duplicate key")) return "A user with this email already exists";
  if (error?.message?.includes("rate limit")) return "Too many requests. Please try again later";
  return "An internal error occurred. Please try again later.";
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = { id: claimsData.claims.sub as string };

    // Check admin role using service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const method = req.method;
    const url = new URL(req.url);

    if (method === "GET") {
      // List all users
      const { data: { users }, error } = await adminClient.auth.admin.listUsers();
      if (error) throw error;

      // Get roles for all users
      const { data: roles } = await adminClient.from("user_roles").select("*");

      // Get profiles
      const { data: profiles } = await adminClient.from("profiles").select("*");

      const enrichedUsers = users.map((u) => {
        const userRoles = roles?.filter((r) => r.user_id === u.id).map((r) => r.role) || [];
        const profile = profiles?.find((p) => p.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          display_name: profile?.display_name || null,
          roles: userRoles,
        };
      });

      return new Response(JSON.stringify({ users: enrichedUsers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST") {
      const body = await req.json();
      const { action } = body;

      // Reset password action
      if (action === "reset_password") {
        const { userId, newPassword } = body;
        if (!userId || !newPassword) {
          return new Response(JSON.stringify({ error: "userId and newPassword required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Enforce password policy server-side
        const hasUpper = /[A-Z]/.test(newPassword);
        const hasLower = /[a-z]/.test(newPassword);
        const hasDigit = /[0-9]/.test(newPassword);
        const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
        if (newPassword.length < 8 || !hasUpper || !hasLower || !hasDigit || !hasSpecial) {
          return new Response(JSON.stringify({ error: "Password must be 8+ chars with uppercase, lowercase, number, and special character" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
          password: newPassword,
        });
        if (updateError) throw updateError;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create user (default action)
      const { email, password, display_name, role } = body;

      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email and password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Enforce password policy server-side
      const hasPwUpper = /[A-Z]/.test(password);
      const hasPwLower = /[a-z]/.test(password);
      const hasPwDigit = /[0-9]/.test(password);
      const hasPwSpecial = /[^A-Za-z0-9]/.test(password);
      if (password.length < 8 || !hasPwUpper || !hasPwLower || !hasPwDigit || !hasPwSpecial) {
        return new Response(JSON.stringify({ error: "Password must be 8+ chars with uppercase, lowercase, number, and special character" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: validateDisplayName(display_name), must_change_password: true },
      });

      if (createError) throw createError;

      if (role && newUser.user) {
        await adminClient.from("user_roles").insert({
          user_id: newUser.user.id,
          role: role,
        });
      }

      return new Response(JSON.stringify({ user: newUser.user }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PATCH") {
      const { userId, role, display_name } = await req.json();
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle role change
      if (role) {
        if (userId === user.id) {
          return new Response(JSON.stringify({ error: "Cannot change your own role" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await adminClient.from("user_roles").delete().eq("user_id", userId);
        const { error: roleError } = await adminClient.from("user_roles").insert({
          user_id: userId,
          role: role,
        });
        if (roleError) throw roleError;
      }

      // Handle display name change
      if (display_name !== undefined) {
        const validatedName = validateDisplayName(display_name);
        const { error: profileError } = await adminClient
          .from("profiles")
          .update({ display_name: validatedName })
          .eq("user_id", userId);
        if (profileError) throw profileError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE") {
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-deletion
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin API Error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: sanitizeError(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
