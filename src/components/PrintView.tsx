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

    const allRows: any[] = [];
    for (let y = 1; y <= 4; y++) {
        for (let p = 1; p <= 4; p++) {
            const key = `${y}_${p}`;
            const cell = planGrid[key];
            if (!cell) continue;
            const pendingItems = cell.items.filter(item => !achieved.has(`${item.code}|${item.idx}`));
            if (pendingItems.length === 0) continue;

            const ec = pendingItems.reduce((sum, item) => {
                const out = curriculum.modules.find(m => m.code === item.code)?.outcomes?.[item.idx];
                return sum + (out?.studiepunten || 0);
            }, 0);

            allRows.push({ y, p, items: pendingItems, comment: cell.comment, ec });
        }
    }

    return (
        <div className="hidden print:block font-sans text-[10.5pt] text-black">
            <div className="text-center text-[16pt] font-bold mb-4 tracking-wide">STUDIEPLAN</div>
            <table className="w-full border-collapse mb-5">
                <tbody>
                    <tr>
                        <td className="border border-gray-400 p-2"><strong>Naam:</strong> {name || '\u00A0'.repeat(30)}</td>
                        <td className="border border-gray-400 p-2"><strong>Studentnummer:</strong> {number || '\u00A0'.repeat(25)}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-400 p-2"><strong>Opleiding:</strong> {opl}</td>
                        <td className="border border-gray-400 p-2"><strong>Datum:</strong> {date || '\u00A0'.repeat(25)}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-400 p-2"><strong>Studiecoach:</strong> {coach || '\u00A0'.repeat(30)}</td>
                        <td className="border border-gray-400 p-2"></td>
                    </tr>
                </tbody>
            </table>

            <div className="font-bold text-[11pt] mt-5 mb-2 border-b-[1.5pt] border-gray-800 pb-1">Overzicht te behalen leeruitkomsten per periode</div>
            <table className="w-full border-collapse mb-6">
                <thead>
                    <tr>
                        <th className="bg-gray-200 border border-gray-500 p-2 text-left w-1/5">Jaar / Periode</th>
                        <th className="bg-gray-200 border border-gray-500 p-2 text-left w-[28%]">Module</th>
                        <th className="bg-gray-200 border border-gray-500 p-2 text-left">Te behalen leeruitkomst</th>
                        <th className="bg-gray-200 border border-gray-500 p-2 text-left w-[8%]">EC</th>
                    </tr>
                </thead>
                <tbody>
                    {allRows.length === 0 ? (
                        <tr><td colSpan={4} className="text-center text-gray-600 italic py-4">Geen leeruitkomsten ingepland</td></tr>
                    ) : (
                        allRows.map(row => (
                            row.items.map((item: any, i: number) => {
                                const mod = curriculum.modules.find(m => m.code === item.code);
                                const out = mod?.outcomes?.[item.idx];
                                return (
                                    <tr key={`${row.y}_${row.p}_${item.code}_${item.idx}`}>
                                        {i === 0 && (
                                            <td rowSpan={row.items.length} className="border border-gray-400 p-2 font-semibold bg-gray-100 whitespace-nowrap">
                                                Jaar {row.y}, Per {row.p}
                                                {row.comment && (
                                                    <div className="text-[9pt] font-normal text-gray-600 mt-1 pb-1">({row.comment})</div>
                                                )}
                                            </td>
                                        )}
                                        <td className="border border-gray-400 p-2 font-semibold text-[9.5pt]">[{item.code}] {mod?.naam}</td>
                                        <td className="border border-gray-400 p-2 text-[9.5pt]">{out?.name}</td>
                                        {i === 0 && (
                                            <td rowSpan={row.items.length} className="border border-gray-400 p-2 font-bold text-center bg-gray-100 whitespace-nowrap">{row.ec}</td>
                                        )}
                                    </tr>
                                );
                            })
                        ))
                    )}
                </tbody>
            </table>

            <div className="flex gap-10 mt-10 break-inside-avoid">
                <div className="flex-1">
                    <div className="text-[10pt] mb-1">Handtekening Student:</div>
                    <div className="border-b-[1pt] border-black h-10 mb-2"></div>
                </div>
                <div className="flex-1">
                    <div className="text-[10pt] mb-1">Handtekening Studiecoach:</div>
                    <div className="border-b-[1pt] border-black h-10 mb-2"></div>
                </div>
            </div>
        </div>
    );
}
