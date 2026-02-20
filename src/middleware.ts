import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
    // We are delegating Auth checks to the Layout (Server Components) 
    // via @logto/next getLogtoContext/getSession to avoid Edge Runtime compatibility issues
    // and simplify the stack.
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
