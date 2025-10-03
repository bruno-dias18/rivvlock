import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Client for regular operations
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);

    // Verify user is authenticated and admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      logger.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin using admin client to bypass RLS
    const { data: adminCheck } = await supabaseAdmin
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!adminCheck) {
      logger.error('❌ User is not admin:', user.email);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.log('✅ Admin user authenticated:', user.email);

    // Admin user to keep (bruno-dias@outlook.com)
    const adminUserId = '0a3bc1b2-0d00-412e-a6da-5554abc42aaf';
    const adminEmail = 'bruno-dias@outlook.com';

    // Get all users from auth.users
    const { data: allUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      logger.error('❌ Error fetching users:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.log(`📊 Found ${allUsers.users.length} users total`);

    // Filter users to delete (all except admin)
    const usersToDelete = allUsers.users.filter(u => 
      u.id !== adminUserId && u.email !== adminEmail
    );

    logger.log(`🗑️ Users to delete: ${usersToDelete.length}`);
    
    const deletionResults = [];
    
    // Delete each user
    for (const userToDelete of usersToDelete) {
      try {
        logger.log(`🗑️ Deleting user: ${userToDelete.email} (${userToDelete.id})`);
        
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
        
        if (deleteError) {
          logger.error(`❌ Failed to delete user ${userToDelete.email}:`, deleteError);
          deletionResults.push({
            email: userToDelete.email,
            id: userToDelete.id,
            success: false,
            error: deleteError.message
          });
        } else {
          logger.log(`✅ Successfully deleted user: ${userToDelete.email}`);
          deletionResults.push({
            email: userToDelete.email,
            id: userToDelete.id,
            success: true
          });
        }
        } catch (error) {
          logger.error(`❌ Exception deleting user ${userToDelete.email}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          deletionResults.push({
            email: userToDelete.email,
            id: userToDelete.id,
            success: false,
            error: errorMessage
        });
      }
    }

    // Summary
    const successCount = deletionResults.filter(r => r.success).length;
    const failCount = deletionResults.filter(r => !r.success).length;

    logger.log(`✅ Cleanup completed: ${successCount} deleted, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'User cleanup completed',
        summary: {
          totalUsers: allUsers.users.length,
          usersToDelete: usersToDelete.length,
          successfulDeletions: successCount,
          failedDeletions: failCount,
          adminUserKept: adminEmail
        },
        results: deletionResults
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logger.error('❌ Function error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
