import React, { Dispatch, SetStateAction, useState } from 'react';
import { CurriculumData, PlanGrid, ToetsonderdeelState } from '@/lib/types';
import InfoModal from './InfoModal';
import { distributeItemsByStudiepad } from '@/lib/utils';
interface Step2Props {
    curriculum: CurriculumData;
    selectedPad: string;
    setSelectedPad: Dispatch<SetStateAction<string>>;
    planGrid: PlanGrid;
    setPlanGrid: Dispatch<SetStateAction<PlanGrid>>;
    achieved: Set<string>;
    setAchieved: Dispatch<SetStateAction<Set<string>>>;
    commentOpen: Set<string>;
    setCommentOpen: Dispatch<SetStateAction<Set<string>>>;
    numYears: number;
    setNumYears: Dispatch<SetStateAction<number>>;
    toetsonderdeelStates: Map<string, ToetsonderdeelState>;
    setToetsonderdeelStates: Dispatch<SetStateAction<Map<string, ToetsonderdeelState>>>;
    toggleToetsonderdeel: (key: string) => void;
}

export default function Step2({
    curriculum, selectedPad, setSelectedPad, planGrid, setPlanGrid, achieved, setAchieved, commentOpen, setCommentOpen, numYears, setNumYears, toetsonderdeelStates, setToetsonderdeelStates, toggleToetsonderdeel
}: Step2Props) {

    const [draggedItem, setDraggedItem] = useState<{ code: string, idx: number, fromKey: string } | null>(null);
    const [infoModalItem, setInfoModalItem] = useState<{ code: string, activeIdx?: number } | null>(null);
    const [pendingPad, setPendingPad] = useState<string | null>(null);

    const pads = Object.keys(curriculum.studiepaden);

    // Calculate Progress
    const totalEC = curriculum.modules.reduce((acc, mod) => acc + (mod.outcomes || []).reduce((s, o) => s + (o.studiepunten || 0), 0), 0);
    const achievedEC = Array.from(achieved).reduce((sum, key) => {
        const [modCode, idxStr] = key.split('|');
        const mod = curriculum.modules.find(m => m.code === modCode);
        const outcome = mod?.outcomes?.[parseInt(idxStr, 10)];
        return sum + (outcome?.studiepunten || 0);
    }, 0);
    const pct = totalEC ? Math.round((achievedEC / totalEC) * 100) : 0;

    const handlePadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newPad = e.target.value;
        const initialGrid = distributeItemsByStudiepad(curriculum.modules, curriculum.studiepaden[selectedPad] || []);
        const isDirty = JSON.stringify(planGrid) !== JSON.stringify(initialGrid);

        if (isDirty) {
            setPendingPad(newPad);
        } else {
            applyPadChange(newPad);
        }
    };

    const applyPadChange = (pad: string) => {
        setSelectedPad(pad);
        setPlanGrid(distributeItemsByStudiepad(curriculum.modules, curriculum.studiepaden[pad] || []));
        setPendingPad(null);
    };

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

    const onDragStart = (e: React.DragEvent, code: string, idx: number, fromKey: string) => {
        setDraggedItem({ code, idx, fromKey });
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const onDrop = (e: React.DragEvent, toKey: string) => {
        e.preventDefault();
        if (!draggedItem) return;
        const { code, idx, fromKey } = draggedItem;
        if (fromKey === toKey) return;

        // Mark checked toetsonderdelen as 'vervallen' when dragging to a different year
        const fromYear = parseInt(fromKey.split('_')[0]);
        const toYear = parseInt(toKey.split('_')[0]);
        if (fromYear !== toYear) {
            const mod = curriculum.modules.find(m => m.code === code);
            const numToetsonderdelen = mod?.outcomes?.[idx]?.toetsonderdelen?.length ?? 0;
            if (numToetsonderdelen > 0) {
                setToetsonderdeelStates(prev => {
                    const next = new Map(prev);
                    for (let ti = 0; ti < numToetsonderdelen; ti++) {
                        const key = `${code}|${idx}|${ti}`;
                        if (next.get(key) === 'checked') {
                            next.set(key, 'vervallen');
                        }
                    }
                    return next;
                });
            }
        }

        setPlanGrid(prev => {
            const g = { ...prev };
            // deeply clone arrays
            g[fromKey] = { ...g[fromKey], items: [...g[fromKey].items] };
            g[toKey] = { ...g[toKey], items: [...g[toKey].items] };

            // filter out from fromKey
            g[fromKey].items = g[fromKey].items.filter(item => !(item.code === code && item.idx === idx));
            // push to toKey
            g[toKey].items.push({ code, idx });

            return g;
        });
        setDraggedItem(null);
    };

    const toggleComment = (key: string) => {
        setCommentOpen(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAchieved = (code: string, idx: number) => {
        const key = `${code}|${idx}`;
        setAchieved(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
        <div className="animate-fade-in">
            <div className="flex flex-wrap gap-5 justify-between mb-5 items-start">
                <div>
                    <h2 className="text-2xl font-bold mb-1">Studieplan</h2>
                    <p className="text-sm text-muted">Vink behaalde leeruitkomsten aan. Sleep een leeruitkomst naar een andere periode.</p>
                </div>
                <div className="min-w-[210px]">
                    <div className="text-sm text-muted mb-1">Behaald: {achievedEC} / {totalEC} &nbsp;({pct}%)</div>
                    <div className="h-2 bg-border-subtle rounded-full overflow-hidden">
                        <div className="h-full bg-success rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border-subtle rounded-radius p-4 mb-6 shadow-sm">
                <div className="flex items-center gap-4 flex-wrap">
                    <label className="font-semibold text-[0.95rem]">Studiepad:</label>
                    <select
                        className="flex-1 max-w-[320px] bg-bg-app border border-border-subtle rounded-md px-3 py-2 text-[0.95rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-all"
                        value={selectedPad}
                        onChange={handlePadChange}
                    >
                        {pads.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto pb-4">
                <div className="grid grid-cols-[56px_repeat(4,minmax(160px,1fr))] gap-2 min-w-[700px]">
                    <div className="block"></div>
                    {[1, 2, 3, 4].map(p => <div key={p} className="bg-primary text-white text-[0.78rem] font-semibold text-center py-[7px] px-1 rounded-radius">Periode {p}</div>)}

                    {Array.from({ length: numYears }, (_, i) => i + 1).map(y => (
                        <React.Fragment key={y}>
                            <div className="flex items-center justify-center text-[0.75rem] font-bold text-primary bg-primary-light rounded-radius p-1 text-center" style={{ writingMode: 'horizontal-tb' }}>Jaar {y}</div>
                            {[1, 2, 3, 4].map(p => {
                                const key = `${y}_${p}`;
                                const cell = planGrid[key];
                                const hasComment = commentOpen.has(key) || !!cell?.comment;

                                let cellEC = 0;
                                cell?.items.forEach(i => {
                                    const m = curriculum.modules.find(x => x.code === i.code);
                                    cellEC += m?.outcomes?.[i.idx]?.studiepunten || 0;
                                });

                                const isDragTarget = draggedItem && draggedItem.fromKey !== key;
                                const dragOffered = isDragTarget ? isOfferedInPeriod(draggedItem!.code, p) : null;

                                return (
                                    <div key={p} className="bg-card border border-border-subtle rounded-radius p-2 flex flex-col gap-1 min-h-[130px]">
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className="text-[0.7rem] font-bold text-primary bg-primary-light rounded-full px-2 py-[1px]">{cellEC} EC</span>
                                            <button
                                                onClick={() => toggleComment(key)}
                                                className={`w-[22px] h-[22px] border rounded flex items-center justify-center text-[0.78rem] transition-colors
                          ${hasComment ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 'bg-transparent border-border-subtle text-muted hover:bg-bg-app hover:border-primary hover:text-primary'}
                        `}
                                            >
                                                {hasComment ? '💬' : '+'}
                                            </button>
                                        </div>

                                        <div
                                            className={`flex-1 flex flex-col gap-1 rounded border-2 border-dashed p-1 relative transition-colors ${
                                                isDragTarget
                                                    ? dragOffered
                                                        ? 'border-green-400 bg-green-50'
                                                        : 'border-orange-400 bg-orange-50'
                                                    : 'border-transparent'
                                            }`}
                                            onDragOver={onDragOver}
                                            onDrop={(e) => onDrop(e, key)}
                                        >
                                            {(!cell?.items || cell.items.length === 0) && <span className="absolute bottom-1 w-full text-center text-[0.72rem] text-muted opacity-50 pointer-events-none">Leeg</span>}
                                            {cell?.items.map((item, idx) => {
                                                const m = curriculum.modules.find(x => x.code === item.code);
                                                const out = m?.outcomes?.[item.idx];
                                                if (!out) return null;
                                                const kString = `${item.code}|${item.idx}`;
                                                const isDone = achieved.has(kString);
                                                const offeredHere = isOfferedInPeriod(item.code, p);

                                                const itemSpan = item.code.includes('-') ? 2 : 1;

                                                return (
                                                    <div
                                                        key={`${item.code}-${item.idx}`}
                                                        draggable
                                                        onDragStart={(e) => onDragStart(e, item.code, item.idx, key)}
                                                        onClick={() => setInfoModalItem({ code: item.code, activeIdx: item.idx })}
                                                        className={`flex items-center gap-1.5 p-1.5 border rounded cursor-grab transition-opacity select-none active:cursor-grabbing hover:shadow-sm hover:border-primary shrink-0
                              ${isDone ? 'bg-success-light border-[var(--color-success)] opacity-75' : offeredHere ? 'bg-white border-border-subtle' : 'bg-orange-50 border-orange-300'}
                            `}
                                                        style={{
                                                            width: itemSpan > 1 ? `calc(${itemSpan * 100}% + ${(itemSpan - 1) * 2.2}rem)` : '100%',
                                                            position: 'relative',
                                                            zIndex: itemSpan > 1 ? 10 : 1,
                                                        }}
                                                    >
                                                        <div className="flex-[1] min-w-0 overflow-hidden" style={{ minWidth: 0 }}>
                                                            <span className="text-[0.62rem] font-bold bg-primary-light text-primary rounded px-1 py-[1px] whitespace-nowrap mr-1">{item.code} <span className="font-normal opacity-80">{m.naam}</span></span>
                                                            <span className={`block whitespace-nowrap overflow-hidden text-ellipsis text-[0.78rem] leading-tight ${isDone ? 'line-through text-muted' : ''}`}>{out.name}</span>
                                                        </div>
                                                        {out.studiepunten > 0 && <span className="text-[0.68rem] font-bold text-primary shrink-0">{out.studiepunten}</span>}
                                                        {!offeredHere && !isDone && (
                                                            <span
                                                                title="Let op: Hier moet je goedkeuring aan de examencommissie voor vragen"
                                                                className="text-orange-500 shrink-0 cursor-help text-[0.85rem] leading-none"
                                                            >⚠️</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {commentOpen.has(key) && (
                                            <textarea
                                                className="w-full border border-yellow-400 bg-yellow-50 rounded p-1.5 text-[0.75rem] outline-none mt-1 resize-y min-h-[50px] text-text-main"
                                                placeholder={`Opmerking voor Jaar ${y}, Periode ${p}...`}
                                                value={cell.comment || ''}
                                                onChange={(e) => {
                                                    setPlanGrid(prev => ({
                                                        ...prev,
                                                        [key]: { ...prev[key], comment: e.target.value }
                                                    }));
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="flex justify-center mt-4">
                <button
                    onClick={() => {
                        const newY = numYears + 1;
                        setPlanGrid(prev => {
                            const g = { ...prev };
                            for (let p = 1; p <= 4; p++) {
                                g[`${newY}_${p}`] = { items: [], comment: '' };
                            }
                            return g;
                        });
                        setNumYears(newY);
                    }}
                    className="flex items-center gap-2 px-5 py-2 border-2 border-dashed border-border-subtle rounded-radius text-muted text-[0.9rem] hover:border-primary hover:text-primary transition-colors cursor-pointer"
                >
                    + Jaar toevoegen
                </button>
            </div>

            {infoModalItem && (
                <InfoModal
                    code={infoModalItem.code}
                    highlightIdx={infoModalItem.activeIdx}
                    curriculum={curriculum}
                    achieved={achieved}
                    toggleAchieved={toggleAchieved}
                    toetsonderdeelStates={toetsonderdeelStates}
                    toggleToetsonderdeel={toggleToetsonderdeel}
                    onClose={() => setInfoModalItem(null)}
                />
            )}

            {pendingPad && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center p-4">
                    <div className="bg-card rounded-radius shadow-xl w-full max-w-[450px] p-6 text-center animate-fade-in" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-3 text-text-main">Studiepad wijzigen?</h3>
                        <p className="text-[0.95rem] text-muted mb-6">
                            Je hebt wijzigingen aangebracht in de planning. Als je overschakelt naar een ander studiepad, worden deze overschreven door de standaardindeling.
                            <br /><br />
                            Weet je zeker dat je wilt wijzigen?
                        </p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => setPendingPad(null)}
                                className="px-5 py-2 text-[0.95rem] font-medium border border-border-subtle rounded bg-bg-app text-text-main hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                                Annuleren
                            </button>
                            <button
                                onClick={() => applyPadChange(pendingPad)}
                                className="px-5 py-2 text-[0.95rem] font-medium border border-primary bg-primary text-white rounded hover:bg-primary-dark transition-colors cursor-pointer"
                            >
                                Ja, overschrijven
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
