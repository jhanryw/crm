import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();

    try {
        // Basic connection check: read one row from 'organizations' (even if empty, query should succeed)
        // We use count just to check connectivity without needing data.
        const { error, count } = await supabase
            .from('organizations')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Supabase health check failed:', error);
            return NextResponse.json(
                { status: 'error', message: 'Database connection failed', error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { status: 'ok', message: 'System operational', db_check: 'passed' },
            { status: 200 }
        );
    } catch (err: any) {
        console.error('Unexpected health check error:', err);
        return NextResponse.json(
            { status: 'error', message: 'Internal server error', error: err.message },
            { status: 500 }
        );
    }
}
