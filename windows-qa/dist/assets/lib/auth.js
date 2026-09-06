import { supabase } from './supabase.js';
export async function loadAuthContext() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError)
        throw sessionError;
    const session = sessionData.session;
    if (!session)
        return null;
    const { data: member, error: memberError } = await supabase
        .from('business_members').select('business_id,role,display_name')
        .eq('user_id', session.user.id).eq('active', true).limit(1).maybeSingle();
    if (memberError)
        throw memberError;
    if (!member)
        throw new Error('No active TuinBooks business membership was found for this user.');
    const { data: business, error: businessError } = await supabase
        .from('businesses').select('id,name').eq('id', member.business_id).single();
    if (businessError)
        throw businessError;
    return {
        userId: session.user.id,
        email: session.user.email ?? '',
        membership: { businessId: member.business_id, role: member.role, displayName: member.display_name ?? '' },
        business: { id: business.id, name: business.name }
    };
}
//# sourceMappingURL=auth.js.map