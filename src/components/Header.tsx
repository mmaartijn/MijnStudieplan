import Link from 'next/link';

interface HeaderProps {
    backLabel?: string;
    backHref?: string;
    onBack?: () => void;
    showActions?: boolean;
    onSave?: () => void;
    onPrint?: () => void;
}

export default function Header({ backLabel, backHref, onBack, showActions, onSave, onPrint }: HeaderProps) {
    return (
        <header className="bg-card border-b border-border-subtle p-3.5 px-6 sticky top-0 z-50 shadow-sm print:hidden">
            <div className="max-w-[1140px] mx-auto flex items-center justify-between gap-6 flex-wrap">
                <div className="flex items-center gap-4 flex-wrap">
                    <h1 className="text-xl font-bold text-primary whitespace-nowrap">Mijn Studieplan</h1>
                    {backLabel && backHref && (
                        <Link
                            href={backHref}
                            className="text-[0.85rem] font-medium text-muted hover:text-primary hover:underline whitespace-nowrap"
                        >
                            {backLabel}
                        </Link>
                    )}
                    {backLabel && onBack && (
                        <button
                            onClick={onBack}
                            className="text-[0.85rem] font-medium text-muted hover:text-primary hover:underline whitespace-nowrap bg-transparent border-none cursor-pointer p-0"
                        >
                            {backLabel}
                        </button>
                    )}
                </div>

                {showActions && (
                    <div className="flex gap-2.5 items-center">
                        <button
                            onClick={onSave}
                            className="px-4 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-300 rounded text-[0.85rem] font-semibold hover:bg-emerald-100 transition-all shadow-sm cursor-pointer"
                        >
                            💾 Opslaan
                        </button>
                        <button
                            onClick={onPrint}
                            className="px-3.5 py-1.5 bg-slate-800 text-white rounded-radius text-[0.82rem] font-medium hover:bg-slate-900 transition-colors cursor-pointer"
                        >
                            🖨 Afdrukken / PDF
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
