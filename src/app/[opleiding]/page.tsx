import { notFound, redirect } from 'next/navigation';
import OpleidingClient from './OpleidingClient';
import { BASE_PATH } from '@/lib/constants';

const OPLEIDING_MAP: Record<string, { displayName: string; jsonUrl: string }> = {
    ict: {
        displayName: 'ICT — Informatica',
        jsonUrl: `${BASE_PATH}/leeruitkomsten/Leeruitkomsten-ICT.json`,
    },
    cmd: {
        displayName: 'CMD — Communication & Multimedia Design',
        jsonUrl: `${BASE_PATH}/leeruitkomsten/Leeruitkomsten-CMD.json`,
    },
    com: {
        displayName: 'COM — Communicatie',
        jsonUrl: `${BASE_PATH}/leeruitkomsten/Leeruitkomsten-COM.json`,
    },
};

export function generateStaticParams() {
    return Object.keys(OPLEIDING_MAP).flatMap((opleiding) => [
        { opleiding: opleiding.toLowerCase() },
        { opleiding: opleiding.toUpperCase() },
        { opleiding: opleiding.charAt(0).toUpperCase() + opleiding.slice(1).toLowerCase() },
    ]);
}

export default async function OpleidingPage({ params }: { params: Promise<{ opleiding: string }> }) {
    const { opleiding } = await params;
    const lowerOpleiding = opleiding.toLowerCase();
    const meta = OPLEIDING_MAP[lowerOpleiding];

    if (!meta) notFound();

    if (opleiding !== lowerOpleiding) {
        redirect(`/${lowerOpleiding}`);
    }

    return <OpleidingClient opleiding={lowerOpleiding} displayName={meta.displayName} jsonUrl={meta.jsonUrl} />;
}
