import { useEffect, useRef } from 'react';
import { CurriculumData, ToetsonderdeelState } from '@/lib/types';

interface InfoModalProps {
    code: string;
    highlightIdx?: number;
    curriculum: CurriculumData;
    achieved: Set<string>;
    toggleAchieved: (code: string, idx: number) => void;
    toetsonderdeelStates: Map<string, ToetsonderdeelState>;
    toggleToetsonderdeel: (key: string) => void;
    onClose: () => void;
}

export default function InfoModal({ code, highlightIdx, curriculum, achieved, toggleAchieved, toetsonderdeelStates, toggleToetsonderdeel, onClose }: InfoModalProps) {
    const mod = curriculum.modules.find(m => m.code === code);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (highlightIdx !== undefined && containerRef.current) {
            setTimeout(() => {
                const el = containerRef.current?.querySelector('.highlighted');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }
    }, [highlightIdx]);

    if (!mod) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center p-4">
            <div
                className="bg-card rounded-radius shadow-xl w-full max-w-[650px] max-h-[85vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-border-subtle p-5">
                    <h2 className="text-[1.3rem] font-bold m-0 flex gap-2.5 items-center">
                        <span className="text-[1rem] bg-primary-light text-primary rounded px-2 py-[2px] font-bold">{mod.code}</span>
                        {mod.naam}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full border-none bg-transparent hover:bg-red-50 hover:text-red-600 text-[1.5rem] flex items-center justify-center leading-none text-muted transition-colors cursor-pointer"
                    >
                        &times;
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 pb-8 flex flex-col gap-4" ref={containerRef}>
                    {mod.outcomes?.map((o, i) => {
                        const isHighlighted = i === highlightIdx;
                        const isAchieved = achieved.has(`${code}|${i}`);

                        return (
                            <div
                                key={i}
                                className={`block border rounded-radius p-4 transition-all ${isHighlighted ? 'highlighted border-primary bg-primary-light shadow-[0_0_0_2px_var(--color-primary-light)]' : 'border-border-subtle bg-bg-app'}`}
                            >
                                {/* Header: naam + EC + vinkje leeruitkomst */}
                                <div className="flex justify-between items-baseline mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            type="checkbox"
                                            className="w-[18px] h-[18px] accent-[var(--color-success)] cursor-pointer"
                                            checked={isAchieved}
                                            onChange={() => toggleAchieved(code, i)}
                                        />
                                        <h4 className="text-primary text-[1.05rem] font-bold m-0">{o.name}</h4>
                                    </div>
                                    <span className="text-[0.8rem] font-bold bg-primary-light text-primary rounded-[10px] px-2 py-[1px] whitespace-nowrap">{o.studiepunten} EC</span>
                                </div>

                                {/* Toetsonderdelen */}
                                {o.toetsonderdelen && o.toetsonderdelen.length > 0 && (
                                    <div className="mb-3 p-3 bg-card rounded border border-border-subtle">
                                        <p className="text-[0.72rem] font-semibold text-muted uppercase tracking-wide mb-2">Toetsonderdelen</p>
                                        <div className="flex flex-col gap-1">
                                            {o.toetsonderdelen.map((t, ti) => {
                                                const toKey = `${code}|${i}|${ti}`;
                                                const state: ToetsonderdeelState = toetsonderdeelStates.get(toKey) ?? 'unchecked';
                                                const isChecked = state === 'checked';
                                                const isVervallen = state === 'vervallen';

                                                return (
                                                    <label
                                                        key={ti}
                                                        className="flex items-center gap-2 py-[3px] cursor-pointer group"
                                                        onClick={() => toggleToetsonderdeel(toKey)}
                                                    >
                                                        <span className={`w-4 h-4 rounded shrink-0 border flex items-center justify-center text-[0.7rem] transition-colors
                                                            ${isVervallen ? 'bg-orange-100 border-orange-400 text-orange-600' :
                                                              isChecked  ? 'bg-[var(--color-success)] border-[var(--color-success)] text-white' :
                                                                           'border-border-subtle bg-white group-hover:border-primary'}`}
                                                        >
                                                            {isChecked && '✓'}
                                                            {isVervallen && '!'}
                                                        </span>
                                                        <span className={`text-[0.88rem] leading-snug ${isVervallen ? 'line-through text-muted' : 'text-text-main'}`}>
                                                            {t.titel}
                                                        </span>
                                                        {isVervallen && (
                                                            <span className="text-[0.75rem] text-orange-600 font-medium whitespace-nowrap">vervalt</span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Beschrijving */}
                                <div className="text-[0.9rem] leading-[1.6] text-text-main" dangerouslySetInnerHTML={{ __html: (o.description || 'Geen uitgebreide omschrijving beschikbaar.').replace(/\n/g, '<br>') }} />
                            </div>
                        );
                    })}
                </div>

                <div className="border-t border-border-subtle p-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-[0.9rem] font-medium border border-border-subtle rounded bg-card text-text-main hover:bg-bg-app transition-colors cursor-pointer"
                    >
                        Sluiten
                    </button>
                </div>
            </div>

            <div className="absolute inset-0 -z-10" onClick={onClose}></div>
        </div>
    );
}
