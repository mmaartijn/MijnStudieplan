'use client';

interface Step1Props {
    onSelectOpleiding: (url: string) => void;
    loading: boolean;
}

export default function Step1({ onSelectOpleiding, loading }: Step1Props) {
    const opleidingen = [
        { name: 'Informatica ICT', url: 'leeruitkomsten/Leeruitkomsten-ICT.json', icon: '💻', code: 'ICT' },
        { name: 'Communication & Multimedia Design', url: 'leeruitkomsten/Leeruitkomsten-CMD.json', icon: '🎨', code: 'CMD' }
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold mb-2">Stap 1: Opleiding kiezen</h2>
                <p className="text-muted text-sm">Selecteer je opleiding om het studieplan in te laden.</p>
            </div>

            <div className="flex gap-5 flex-wrap">
                {opleidingen.map(opl => (
                    <div
                        key={opl.code}
                        onClick={() => !loading && onSelectOpleiding(opl.url)}
                        className={`flex-1 min-w-[200px] max-w-[280px] bg-card border-2 border-border-subtle rounded-xl p-7 text-center flex flex-col items-center gap-3 cursor-pointer transition-all duration-200 hover:border-primary hover:-translate-y-1 hover:shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="text-4xl">{opl.icon}</div>
                        <div className="font-semibold text-base">{opl.name}</div>
                        <div className="text-xs text-muted bg-bg-app px-2 py-1 rounded">Module {opl.code}</div>
                    </div>
                ))}
            </div>

            {loading && (
                <div className="text-center text-muted p-6">Laden...</div>
            )}
        </div>
    );
}
