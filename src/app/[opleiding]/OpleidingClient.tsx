'use client';

import { parseJSON, distributeItemsByStudiepad } from '@/lib/utils';
import { Toaster, toast } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Step2 from '@/components/Step2';
import { CurriculumData, StudentInfo, PlanGrid, ToetsonderdeelState } from '@/lib/types';
import PrintModal from '@/components/PrintModal';
import PrintView from '@/components/PrintView';

interface OpleidingClientProps {
    opleiding: string;
    displayName: string;
    jsonUrl: string;
}

export default function OpleidingClient({ opleiding, displayName, jsonUrl }: OpleidingClientProps) {
    const storageKey = `mijnStudieplan_${opleiding}`;

    const [view, setView] = useState<'uitleg' | 'plan'>('uitleg');
    const [curriculum, setCurriculum] = useState<CurriculumData | null>(null);
    const [selectedPad, setSelectedPad] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [savedData, setSavedData] = useState<Record<string, unknown> | null>(null);

    const [student, setStudent] = useState<StudentInfo>({
        name: '',
        number: '',
        coach: '',
        date: new Date().toISOString().split('T')[0],
    });

    const [planGrid, setPlanGrid] = useState<PlanGrid>({});
    const [achieved, setAchieved] = useState<Set<string>>(new Set());
    const [numYears, setNumYears] = useState<number>(4);
    const [commentOpen, setCommentOpen] = useState<Set<string>>(new Set());
    const [toetsonderdeelStates, setToetsonderdeelStates] = useState<Map<string, ToetsonderdeelState>>(new Map());
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.timestamp) setSavedData(parsed);
            } catch {
                // ignore malformed data
            }
        }
    }, [storageKey]);

    const loadAndGoToPlan = async (fromSaved: boolean) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(jsonUrl);
            if (!res.ok) throw new Error('Kon JSON niet laden');
            const rawData = await res.json();

            const parsedModules = parseJSON(rawData);
            const data: CurriculumData = {
                naamOpleiding: rawData.naamOpleiding,
                studiepaden: rawData.studiepaden || {},
                modules: parsedModules,
            };
            setCurriculum(data);

            if (fromSaved && savedData) {
                setSelectedPad((savedData.selectedPad as string) || '');
                setPlanGrid((savedData.planGrid as PlanGrid) || {});
                setAchieved(new Set((savedData.achieved as string[]) || []));
                setCommentOpen(new Set((savedData.commentOpen as string[]) || []));
                if (savedData.numYears) setNumYears(savedData.numYears as number);
                if (savedData.student) setStudent(savedData.student as StudentInfo);
                if (savedData.toetsonderdeelStates) {
                    setToetsonderdeelStates(new Map(savedData.toetsonderdeelStates as [string, ToetsonderdeelState][]));
                }
                toast.success('Studieplan hervat!');
            } else {
                const pads = Object.keys(data.studiepaden);
                if (pads.length > 0) {
                    setSelectedPad(pads[0]);
                    setPlanGrid(distributeItemsByStudiepad(data.modules, data.studiepaden[pads[0]]));
                } else {
                    setError('De opleiding heeft geen studiepaden ingevuld.');
                    return;
                }
            }

            setView('plan');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Onbekende fout');
        } finally {
            setLoading(false);
        }
    };

    const toggleToetsonderdeel = (key: string) => {
        setToetsonderdeelStates(prev => {
            const next = new Map(prev);
            const current = next.get(key) ?? 'unchecked';
            next.set(key, current === 'unchecked' ? 'checked' : 'unchecked');
            return next;
        });
    };

    // Sync LU achieved state whenever TO states change
    useEffect(() => {
        if (!curriculum) return;
        setAchieved(prev => {
            const next = new Set(prev);
            for (const mod of curriculum.modules) {
                const outcomes = mod.outcomes ?? [];
                for (let i = 0; i < outcomes.length; i++) {
                    const numTO = outcomes[i].toetsonderdelen?.length ?? 0;
                    if (numTO === 0) continue;
                    const luKey = `${mod.code}|${i}`;
                    const allChecked = Array.from({ length: numTO }, (_, ti) =>
                        toetsonderdeelStates.get(`${mod.code}|${i}|${ti}`) === 'checked'
                    ).every(Boolean);
                    if (allChecked) next.add(luKey);
                    else next.delete(luKey);
                }
            }
            return next;
        });
    }, [toetsonderdeelStates, curriculum]);

    const handleNewStart = () => {
        localStorage.removeItem(storageKey);
        setSavedData(null);
        loadAndGoToPlan(false);
    };

    const handleSave = () => {
        const data = {
            selectedPad,
            planGrid,
            achieved: Array.from(achieved),
            commentOpen: Array.from(commentOpen),
            toetsonderdeelStates: Array.from(toetsonderdeelStates.entries()),
            student,
            numYears,
            timestamp: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(data));
        toast.success('Studieplan opgeslagen! (Lokaal)');
    };

    return (
        <div className="min-h-screen bg-bg-app flex flex-col print:bg-white text-text-main">
            <Header
                backLabel={view === 'plan' ? 'Uitleg over mijn studieplan' : undefined}
                onBack={view === 'plan' ? () => setView('uitleg') : undefined}
                showActions={view === 'plan'}
                onSave={handleSave}
                onPrint={() => setIsPrintModalOpen(true)}
            />

            <main className="flex-1 w-full max-w-[1140px] mx-auto px-6 py-7 print:hidden">
                {error && (
                    <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-radius mb-6">{error}</div>
                )}

                {view === 'uitleg' && (
                    <UitlegScherm
                        savedData={savedData}
                        loading={loading}
                        onStart={() => loadAndGoToPlan(false)}
                        onResume={() => loadAndGoToPlan(true)}
                        onNewStart={handleNewStart}
                    />
                )}

                {view === 'plan' && curriculum && (
                    <Step2
                        curriculum={curriculum}
                        selectedPad={selectedPad}
                        setSelectedPad={setSelectedPad}
                        planGrid={planGrid}
                        setPlanGrid={setPlanGrid}
                        achieved={achieved}
                        setAchieved={setAchieved}
                        commentOpen={commentOpen}
                        setCommentOpen={setCommentOpen}
                        numYears={numYears}
                        setNumYears={setNumYears}
                        toetsonderdeelStates={toetsonderdeelStates}
                        setToetsonderdeelStates={setToetsonderdeelStates}
                        toggleToetsonderdeel={toggleToetsonderdeel}
                    />
                )}
            </main>

            {isPrintModalOpen && view === 'plan' && (
                <PrintModal
                    student={student}
                    setStudent={setStudent}
                    onClose={() => setIsPrintModalOpen(false)}
                    onConfirm={() => {
                        setIsPrintModalOpen(false);
                        setTimeout(() => window.print(), 100);
                    }}
                />
            )}

            <PrintView
                step={view === 'plan' ? 2 : 1}
                student={student}
                curriculum={curriculum}
                displayName={displayName}
                planGrid={planGrid}
                achieved={achieved}
                numYears={numYears}
            />

            <Toaster position="bottom-right" />
        </div>
    );
}

// ── Uitleg scherm ──────────────────────────────────────────────────────────────

interface UitlegSchermProps {
    savedData: Record<string, unknown> | null;
    loading: boolean;
    onStart: () => void;
    onResume: () => void;
    onNewStart: () => void;
}

function UitlegScherm({ savedData, loading, onStart, onResume, onNewStart }: UitlegSchermProps) {
    const formattedDate = savedData?.timestamp
        ? new Date(savedData.timestamp as string).toLocaleString('nl-NL')
        : null;

    const ctaButton = (
        <button
            onClick={onStart}
            disabled={loading}
            className="px-5 py-2.5 bg-success text-white font-semibold rounded-radius shadow-sm hover:bg-success-dark transition-colors disabled:opacity-50 text-[0.95rem] cursor-pointer whitespace-nowrap"
        >
            {loading ? 'Laden...' : 'Ga naar mijn studieplan'}
        </button>
    );

    return (
        <div className="animate-fade-in flex justify-center">
            <div className="w-full max-w-[1080px] bg-card border border-border-subtle rounded-xl shadow-sm p-8 flex flex-col gap-8">

                {/* Knop rechtsboven — alleen als er geen opgeslagen plan is */}
                {!savedData && (
                    <div className="flex justify-end -mb-2">{ctaButton}</div>
                )}

                {/* Hervatten-banner */}
                {savedData && (
                    <div className="bg-primary-light border-2 border-primary rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap shadow-sm">
                        <div>
                            <h3 className="text-primary font-bold text-lg mb-1">Opgeslagen studieplan gevonden</h3>
                            <p className="text-text-main text-sm">Laatst opgeslagen op {formattedDate}.</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onNewStart}
                                disabled={loading}
                                className="bg-card text-text-main border border-border-subtle hover:bg-bg-app px-4 py-2 font-semibold text-sm rounded transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                Nieuw starten
                            </button>
                            <button
                                onClick={onResume}
                                disabled={loading}
                                className="bg-success text-white border-none hover:bg-success-dark px-4 py-2 font-semibold text-sm rounded shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                {loading ? 'Laden...' : 'Hervatten'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Sectie 1: Het studieadvies */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold">Het studieadvies</h2>
                    <p className="text-[0.97rem] leading-relaxed text-text-main">
                        Aan het einde van je eerste jaar geeft Avans je een studieadvies. Dat advies is geen eindoordeel, maar een signaal: hoe staat het er voor, en wat is een realistisch vervolg? Avans onderscheidt drie soorten adviezen.
                    </p>
                    <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                            <span className="mt-[6px] shrink-0 w-3 h-3 rounded-full bg-emerald-500"></span>
                            <p className="text-[0.97rem] leading-relaxed text-text-main">
                                <strong>Positief</strong> — Je hebt 45 EC of meer behaald. Je stroomt normaal door naar jaar 2.
                            </p>
                        </div>
                        <div className="flex gap-3 items-start">
                            <span className="mt-[6px] shrink-0 w-3 h-3 rounded-full bg-yellow-400"></span>
                            <p className="text-[0.97rem] leading-relaxed text-text-main">
                                <strong>Advies passend studietraject</strong> — Je hebt minder dan 45 EC behaald, maar er is vertrouwen dat je de opleiding succesvol kunt afronden. Je kunt jaar 1 overdoen, of je vraagt de examencommissie om toestemming om toch (een deel van) jaar 2 te volgen. Daarvoor heb je een goedgekeurd studieplan nodig.
                            </p>
                        </div>
                        <div className="flex gap-3 items-start">
                            <span className="mt-[6px] shrink-0 w-3 h-3 rounded-full bg-red-400"></span>
                            <p className="text-[0.97rem] leading-relaxed text-text-main">
                                <strong>Verwijsadvies</strong> — Je hebt minder dan 45 EC behaald en er is onvoldoende vertrouwen dat de opleiding bij jou past. Doorstromen naar jaar 2 is in principe niet mogelijk. Je slb&apos;er begeleidt je richting Student Support of een andere studiekeuze. In uitzonderlijke gevallen kan de examencommissie toch toestemming verlenen, maar ook dan is een studieplan vereist.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sectie 2: Het studieplan */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-bold">Het studieplan</h2>
                    <p className="text-[0.97rem] leading-relaxed text-text-main">
                        Bij een <strong>advies passend studietraject</strong> of <strong>verwijsadvies</strong> stel je een studieplan op. Dit plan is <em>van en voor jou</em>: jij bent zelf verantwoordelijk voor het opstellen, bijhouden en indienen ervan. Het is geen eenmalig formulier, maar een levend document dat je elke periode bijwerkt in overleg met je studieloopbaanbegeleider (slb&apos;er).
                    </p>
                    <p className="text-[0.97rem] leading-relaxed text-text-main">
                        In het studieplan leg je vast welke leeruitkomsten je wanneer wilt behalen, in welke volgorde, en hoe realistisch dat is gezien je persoonlijke situatie. Je slb&apos;er kijkt met je mee: kloppen de combinaties van modules, is de werkdruk haalbaar, en houd je rekening met de aanbieding van modules per periode? Uiteindelijk beslist de examencommissie of je op basis van dit plan door mag naar jaar 2.
                    </p>
                    <p className="text-[0.97rem] leading-relaxed text-text-main">
                        Heb je toestemming gekregen? Dan legt de slb&apos;er zijn goedkeuring vast in Osiris, zodat de examencommissie dit kan inzien.
                    </p>
                </div>

                {/* Sectie 3: Tijdlijn */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-bold">Wanneer en hoe?</h2>
                    <p className="text-[0.97rem] leading-relaxed text-text-main">
                        Het proces rondom het studieadvies loopt over het hele eerste jaar, met vaste contactmomenten:
                    </p>
                    <div className="border-l-2 border-primary-light pl-5 space-y-4">
                        <div>
                            <p className="font-semibold text-[0.97rem]">Periode 2</p>
                            <p className="text-[0.93rem] text-muted leading-relaxed">Je slb&apos;er bespreekt je studievoortgang in een individueel gesprek. Op basis van de resultaten uit periode 1 ontvang je vóór 1 februari een eerste studiesignaal én een officiële brief van de examencommissie. Als je al een studieplan hebt, bespreek je de haalbaarheid ervan.</p>
                        </div>
                        <div>
                            <p className="font-semibold text-[0.97rem]">Periode 3</p>
                            <p className="text-[0.93rem] text-muted leading-relaxed">Het proces van de studieadviezen wordt toegelicht aan alle studenten. Je slb&apos;er bespreekt dit in het groepsgesprek en in het individuele gesprek.</p>
                        </div>
                        <div>
                            <p className="font-semibold text-[0.97rem]">Periode 4, week 10–11</p>
                            <p className="text-[0.93rem] text-muted leading-relaxed">De definitieve cijfers komen binnen. Op maandag van week 11 stemmen slb&apos;ers en de examencommissie de adviezen op elkaar af. Op dinsdag bespreek je samen met je slb&apos;er het definitieve studieplan, keurt de slb&apos;er het goed en dien je het in bij de examencommissie. Vrijdag van week 11 neemt de examencommissie een besluit.</p>
                        </div>
                    </div>
                </div>

                {/* Sectie 4: Hoe gebruik je dit hulpmiddel */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-bold">Hoe gebruik je dit hulpmiddel?</h2>
                    <p className="text-[0.97rem] leading-relaxed text-text-main">
                        Met dit hulpmiddel maak je jouw studieplan concreet en inzichtelijk. Je sleept leeruitkomsten naar de periode waarin jij ze wilt behalen en houdt bij welke je al hebt gehaald. Zo bouw je, op basis van jouw eigen inzichten en prioriteiten, een persoonlijk plan op dat aansluit bij jouw situatie.
                    </p>
                    <p className="text-[0.97rem] leading-relaxed text-text-main">
                        Je hoeft dus niet te wachten op je slb&apos;er om aan de slag te gaan. Juist het omgekeerde: door al voorbereid aan je gesprek te beginnen, kun je de tijd met je slb&apos;er gebruiken om jouw plan te toetsen en aan te scherpen in plaats van het van nul te beginnen.
                    </p>
                    <p className="text-[0.97rem] leading-relaxed text-text-main">
                        Wanneer je plan klaar is, druk je het af als PDF via de knop &apos;Afdrukken / PDF&apos; in de menubalk. Dit document onderteken je en upload je vervolgens samen met je verzoek in Osiris, zodat de examencommissie het kan beoordelen.
                    </p>
                </div>

                {/* Disclaimer */}
                <div className="bg-bg-app border border-border-subtle rounded-lg p-4 text-[0.85rem] text-muted leading-relaxed space-y-1">
                    <p className="font-semibold text-text-main">Let op: jouw gegevens blijven bij jou</p>
                    <p>Dit hulpmiddel slaat alles uitsluitend lokaal op in jouw browser. Er zijn geen koppelingen met Osiris of andere onderwijssystemen. Wij hebben geen enkele inzage in wat je hier invult. Dat betekent ook dat je zelf volledig verantwoordelijk bent voor het bewaren, bijhouden en tijdig indienen van je studieplan. Gebruik steeds dezelfde browser en computer om verder te gaan waar je gebleven was.</p>
                </div>

                {/* Knop rechtsonder — alleen als er geen opgeslagen plan is */}
                {!savedData && (
                    <div className="flex justify-end -mt-2">{ctaButton}</div>
                )}

            </div>
        </div>
    );
}
