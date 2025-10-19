import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  compose, 
  withCors, 
  withAuth, 
  successResponse,
  errorResponse,
  Handler,
  HandlerContext 
} from "../_shared/middleware.ts";
import { logger } from "../_shared/logger.ts";

const handler: Handler = async (req, ctx: HandlerContext) => {
  const { user, supabaseClient, adminClient } = ctx;

  // Check if user is admin using admin client to bypass RLS
  const { data: adminCheck } = await adminClient!
    .from('admin_roles')
    .select('role')
    .eq('user_id', user!.id)
    .eq('role', 'admin')
    .single();

  if (!adminCheck) {
    logger.error('❌ User is not admin:', user!.email);
    return errorResponse('Admin access required', 403);
  }

  logger.log('✅ Admin user authenticated:', user!.email);

  // Admin user to keep (bruno-dias@outlook.com)
  const adminUserId = '0a3bc1b2-0d00-412e-a6da-5554abc42aaf';
  const adminEmail = 'bruno-dias@outlook.com';

  // Get all users from auth.users
  const { data: allUsers, error: usersError } = await adminClient!.auth.admin.listUsers();
  
  if (usersError) {
    logger.error('❌ Error fetching users:', usersError);
    return errorResponse('Failed to fetch users', 500);
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
      
      const { error: deleteError } = await adminClient!.auth.admin.deleteUser(userToDelete.id);
      
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

  return successResponse({
    message: 'User cleanup completed',
    summary: {
      totalUsers: allUsers.users.length,
      usersToDelete: usersToDelete.length,
      successfulDeletions: successCount,
      failedDeletions: failCount,
      adminUserKept: adminEmail
    },
    results: deletionResults
  });
};

const composedHandler = compose(
  withCors,
  withAuth
)(handler);

serve(composedHandler);
