import Link from 'next/link';
import Image from 'next/image';

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
                    <div className="flex items-center gap-2.5">
                        <Image src="/ATD-small.png" alt="ATD logo" width={36} height={36} className="object-contain" />
                        <h1 className="text-xl font-bold text-success whitespace-nowrap">Mijn Studieplan</h1>
                    </div>
                    {backLabel && backHref && (
                        <Link
                            href={backHref}
                            className="text-[0.85rem] font-medium text-muted hover:text-accent hover:underline whitespace-nowrap"
                        >
                            {backLabel}
                        </Link>
                    )}
                    {backLabel && onBack && (
                        <button
                            onClick={onBack}
                            className="text-[0.85rem] font-medium text-muted hover:text-accent hover:underline whitespace-nowrap bg-transparent border-none cursor-pointer p-0"
                        >
                            {backLabel}
                        </button>
                    )}
                </div>

                {showActions && (
                    <div className="flex gap-2.5 items-center">
                        <button
                            onClick={onSave}
                            className="px-4 py-1.5 bg-success text-white border border-success-dark rounded text-[0.85rem] font-semibold hover:bg-success-dark transition-all shadow-sm cursor-pointer"
                        >
                            💾 Opslaan
                        </button>
                        <button
                            onClick={onPrint}
                            className="px-3.5 py-1.5 bg-success text-white rounded-radius text-[0.82rem] font-medium hover:bg-success-dark transition-colors cursor-pointer"
                        >
                            🖨 Afdrukken / PDF
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
