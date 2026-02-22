import './globals.css';
import { Helvetica } from 'next/font/google';

const inter = Helvetica({ subsets: ['latin'] });

export const metadata = {
    title: 'Qarvon CRM',
    description: 'CRM do Varejo',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>{children}</body>
        </html>
    );
}
