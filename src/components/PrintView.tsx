import { PlanGrid, CurriculumData, StudentInfo } from '@/lib/types';

interface PrintViewProps {
    step: number;
    student: StudentInfo;
    curriculum: CurriculumData | null;
    planGrid: PlanGrid;
    achieved: Set<string>;
}

export default function PrintView({ step, student, curriculum, planGrid, achieved }: PrintViewProps) {
    if (step !== 2 || !curriculum) return <div className="hidden"></div>;

    const { name, number, coach, date } = student;
    const opl = curriculum.studiepaden ? 'Informatica ICT' : 'Opleiding'; // naive fallback for display

    const plannedRows: any[] = [];
    const commentsList: { y: number; p: number; comment: string }[] = [];
    const achievedItems: { code: string; mod: any; out: any }[] = [];

    const isOfferedInPeriod = (moduleCode: string, period: number): boolean => {
        const mod = curriculum.modules.find(m => m.code === moduleCode);
        if (!mod || !mod.periodes || mod.periodes.length === 0) return true;
        // After parseJSON, periodes is stored as [[1,2]] (wrapped array)
        const flatPeriodes = (mod.periodes as unknown as number[][]).flat();
        if (flatPeriodes.length === 0) return true;
        // Also allow the period directly after an offered period (4 wraps to 1)
        const prevPeriod = ((period - 2 + 4) % 4) + 1;
        return flatPeriodes.includes(period) || flatPeriodes.includes(prevPeriod);
    };

    // Verzamelen geplande items en opmerkingen
    for (let y = 1; y <= 4; y++) {
        for (let p = 1; p <= 4; p++) {
            const key = `${y}_${p}`;
            const cell = planGrid[key];
            if (!cell) continue;

            if (cell.comment?.trim()) {
                commentsList.push({ y, p, comment: cell.comment.trim() });
            }

            const pendingItems = cell.items.filter(item => !achieved.has(`${item.code}|${item.idx}`));
            if (pendingItems.length > 0) {
                const ec = pendingItems.reduce((sum, item) => {
                    const out = curriculum.modules.find(m => m.code === item.code)?.outcomes?.[item.idx];
                    return sum + (out?.studiepunten || 0);
                }, 0);
                plannedRows.push({ y, p, items: pendingItems, ec });
            }
        }
    }

    // Verzamelen behaalde items
    Array.from(achieved).forEach(key => {
        const [code, idxStr] = key.split('|');
        const idx = parseInt(idxStr, 10);
        const mod = curriculum.modules.find(m => m.code === code);
        const out = mod?.outcomes?.[idx];
        if (mod && out) {
            achievedItems.push({ code, mod, out });
        }
    });

    return (
        <div className="hidden print:block font-sans text-[10pt] text-black bg-white leading-relaxed">
            <h1 className="text-center text-[18pt] font-extrabold mb-6 tracking-wider text-gray-900 border-b-2 border-black pb-2">PERSOONLIJK STUDIEPLAN</h1>

            <table className="w-full mb-8 text-[11pt]">
                <tbody>
                    <tr>
                        <td className="w-[15%] font-bold text-gray-700 pb-2">Naam:</td>
                        <td className="w-[35%] border-b border-gray-400 pb-2">{name || '\u00A0'}</td>
                        <td className="w-[15%] font-bold text-gray-700 pb-2 pl-4">Studentnummer:</td>
                        <td className="w-[35%] border-b border-gray-400 pb-2">{number || '\u00A0'}</td>
                    </tr>
                    <tr>
                        <td className="font-bold text-gray-700 py-2">Opleiding:</td>
                        <td className="border-b border-gray-400 py-2">{opl}</td>
                        <td className="font-bold text-gray-700 py-2 pl-4">Datum:</td>
                        <td className="border-b border-gray-400 py-2">{date || '\u00A0'}</td>
                    </tr>
                    <tr>
                        <td className="font-bold text-gray-700 pt-2">Studiecoach:</td>
                        <td className="border-b border-gray-400 pt-2">{coach || '\u00A0'}</td>
                        <td colSpan={2}></td>
                    </tr>
                </tbody>
            </table>

            {/* 1. Geplande leeruitkomsten */}
            <div className="mb-8 break-inside-avoid-page">
                <h2 className="font-bold text-[13pt] mb-3 text-gray-800 border-l-4 border-gray-800 pl-2 bg-gray-100 py-1">1. Geplande Leeruitkomsten</h2>
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border-b-2 border-gray-800 p-2 text-left w-1/5 font-bold text-gray-700">Periode</th>
                            <th className="border-b-2 border-gray-800 p-2 text-left w-[25%] font-bold text-gray-700">Module</th>
                            <th className="border-b-2 border-gray-800 p-2 text-left font-bold text-gray-700">Leeruitkomst</th>
                            <th className="border-b-2 border-gray-800 p-2 text-center w-[8%] font-bold text-gray-700">EC</th>
                        </tr>
                    </thead>
                    <tbody>
                        {plannedRows.length === 0 ? (
                            <tr><td colSpan={4} className="text-center text-gray-500 italic py-4 border-b border-gray-300">Geen leeruitkomsten ingepland</td></tr>
                        ) : (
                            plannedRows.map((row, rIdx) => (
                                row.items.map((item: any, i: number) => {
                                    const mod = curriculum.modules.find(m => m.code === item.code);
                                    const out = mod?.outcomes?.[item.idx];
                                    const offeredHere = isOfferedInPeriod(item.code, row.p);
                                    return (
                                        <tr key={`${row.y}_${row.p}_${item.code}_${item.idx}`} className={offeredHere ? 'odd:bg-gray-50' : 'bg-orange-50'}>
                                            {i === 0 && (
                                                <td rowSpan={row.items.length} className="border-b border-gray-300 p-2 font-semibold text-gray-800 align-top">
                                                    Jaar {row.y}, Periode {row.p}
                                                </td>
                                            )}
                                            <td className={`p-2 text-gray-800 ${i === row.items.length - 1 ? 'border-b border-gray-300' : ''}`}>[{item.code}] {mod?.naam}</td>
                                            <td className={`p-2 text-gray-800 ${i === row.items.length - 1 ? 'border-b border-gray-300' : ''}`}>
                                                {out?.name}
                                                {!offeredHere && (
                                                    <span className="ml-2 inline-flex items-center gap-1 text-orange-700 font-semibold text-[8pt]">
                                                        ⚠ Niet aangeboden in periode {row.p} — goedkeuring examencommissie vereist
                                                    </span>
                                                )}
                                            </td>
                                            {i === 0 && (
                                                <td rowSpan={row.items.length} className="border-b border-gray-300 p-2 font-bold text-center text-gray-800 align-top">
                                                    {row.ec}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 2. Toelichtingen */}
            {commentsList.length > 0 && (
                <div className="mb-8 break-inside-avoid-page">
                    <h2 className="font-bold text-[13pt] mb-3 text-gray-800 border-l-4 border-gray-800 pl-2 bg-gray-100 py-1">2. Toelichtingen & Opmerkingen</h2>
                    <div className="border border-gray-300 rounded p-4 bg-gray-50">
                        {commentsList.map((c, i) => (
                            <div key={i} className={`mb-3 pb-3 ${i !== commentsList.length - 1 ? 'border-b border-gray-200' : ''}`}>
                                <div className="font-bold text-gray-700 mb-1">Jaar {c.y}, Periode {c.p}:</div>
                                <div className="text-gray-900 italic">"{c.comment}"</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Behaalde leeruitkomsten */}
            <div className="mb-8 break-inside-avoid-page">
                <h2 className="font-bold text-[13pt] mb-3 text-gray-800 border-l-4 border-gray-800 pl-2 bg-gray-100 py-1">3. Reeds Behaalde Leeruitkomsten</h2>
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border-b-2 border-gray-800 p-2 text-left w-[20%] font-bold text-gray-700">Code</th>
                            <th className="border-b-2 border-gray-800 p-2 text-left w-[35%] font-bold text-gray-700">Module</th>
                            <th className="border-b-2 border-gray-800 p-2 text-left font-bold text-gray-700">Leeruitkomst</th>
                            <th className="border-b-2 border-gray-800 p-2 text-center w-[8%] font-bold text-gray-700">EC</th>
                        </tr>
                    </thead>
                    <tbody>
                        {achievedItems.length === 0 ? (
                            <tr><td colSpan={4} className="text-center text-gray-500 italic py-4 border-b border-gray-300">Nog geen leeruitkomsten geregistreerd als behaald.</td></tr>
                        ) : (
                            achievedItems.map((item, i) => (
                                <tr key={i} className="border-b border-gray-200 even:bg-gray-50">
                                    <td className="p-2 font-mono text-gray-600">[{item.code}]</td>
                                    <td className="p-2 text-gray-800">{item.mod.naam}</td>
                                    <td className="p-2 text-gray-800">{item.out.name}</td>
                                    <td className="p-2 text-center font-bold text-gray-800">{item.out.studiepunten}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 4. Ondertekening */}
            <div className="mt-12 pt-8 break-inside-avoid-page">
                <h2 className="font-bold text-[13pt] mb-6 text-gray-800 border-l-4 border-gray-800 pl-2 bg-gray-100 py-1">Akkoord</h2>
                <div className="flex gap-16 justify-between px-4">
                    <div className="flex-1">
                        <div className="text-[11pt] font-semibold text-gray-700 mb-10">Handtekening Student:</div>
                        <div className="border-b-2 border-gray-400"></div>
                        <div className="mt-2 text-[9pt] text-gray-500">Naam: {name}</div>
                        <div className="text-[9pt] text-gray-500">Datum:</div>
                    </div>
                    <div className="flex-1">
                        <div className="text-[11pt] font-semibold text-gray-700 mb-10">Handtekening Studiecoach:</div>
                        <div className="border-b-2 border-gray-400"></div>
                        <div className="mt-2 text-[9pt] text-gray-500">Naam: {coach}</div>
                        <div className="text-[9pt] text-gray-500">Datum:</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
