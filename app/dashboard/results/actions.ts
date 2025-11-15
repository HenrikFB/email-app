'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Deletes an analyzed email record
 * @param id - The UUID of the analyzed email to delete
 * @returns Success status and optional error message
 */
export async function deleteAnalyzedEmail(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('analyzed_emails')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting analyzed email:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/results')
  return { success: true }
}

